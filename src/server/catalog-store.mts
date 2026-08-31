import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ImportOptions, NormalizedProduct } from "./catalog-types.mts";
import type { Job, JobEvent, Product, ProductStatus } from "../lib/catalog-data.ts";

type JobRow = {
  id: string;
  import_id: string;
  product_id: string | null;
  status: string;
  stage: string;
  source_url: string;
  options_json: string;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  evidence_path: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type ProductRow = {
  id: string;
  source_url: string;
  title: string;
  sku: string;
  source_price: number;
  selling_price: number;
  status: ProductStatus;
  stock: number;
  weight_grams: number;
  category: string;
  updated_at: string;
};

type ImportRow = {
  id: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at: string;
  updated_at: string;
};

let singleton: DatabaseSync | undefined;

export function databasePath() {
  return path.resolve(/* turbopackIgnore: true */ process.env.CATALOGBRIDGE_DB_PATH || path.join(process.cwd(), "data", "catalogbridge.db"));
}

export function openCatalogDatabase(filename = databasePath()) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  initializeSchema(database);
  return database;
}

export function getCatalogDatabase() {
  singleton ??= openCatalogDatabase();
  return singleton;
}

export function closeCatalogDatabase() {
  singleton?.close();
  singleton = undefined;
}

function initializeSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      total_jobs INTEGER NOT NULL,
      completed_jobs INTEGER NOT NULL DEFAULT 0,
      failed_jobs INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      source_product_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      source_price INTEGER NOT NULL,
      selling_price INTEGER NOT NULL,
      currency TEXT NOT NULL,
      sku TEXT NOT NULL,
      stock INTEGER NOT NULL,
      weight_grams INTEGER NOT NULL,
      category TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      status TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      extracted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      position INTEGER NOT NULL,
      alt TEXT NOT NULL,
      mime_type TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      option_value TEXT NOT NULL,
      sku TEXT NOT NULL,
      price INTEGER,
      stock INTEGER,
      attributes_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      source_url TEXT NOT NULL,
      options_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      error_code TEXT,
      error_message TEXT,
      evidence_path TEXT,
      available_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      locked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      stage TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id TEXT PRIMARY KEY,
      last_seen_at TEXT NOT NULL,
      current_job_id TEXT,
      version TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(status, available_at, created_at);
    CREATE INDEX IF NOT EXISTS jobs_created_idx ON jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS products_status_idx ON products(status, updated_at DESC);
  `);
}

function now() {
  return new Date().toISOString();
}

export function createImport(urls: string[], options: ImportOptions, database = getCatalogDatabase()) {
  const timestamp = now();
  const importId = `IMP-${randomUUID().slice(0, 8).toUpperCase()}`;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("INSERT INTO imports (id,status,total_jobs,created_at,updated_at) VALUES (?,?,?,?,?)").run(importId, "QUEUED", urls.length, timestamp, timestamp);
    const statement = database.prepare("INSERT INTO jobs (id,import_id,status,stage,source_url,options_json,available_at,created_at) VALUES (?,?,?,?,?,?,?,?)");
    const jobs = urls.map((url) => {
      const id = `JOB-${randomUUID().slice(0, 8).toUpperCase()}`;
      statement.run(id, importId, "QUEUED", "QUEUED", url, JSON.stringify(options), timestamp, timestamp);
      database.prepare("INSERT INTO job_events (job_id,level,stage,message,created_at) VALUES (?,?,?,?,?)").run(id, "INFO", "QUEUED", "Import queued for local extraction.", timestamp);
      return { id, sourceUrl: url };
    });
    database.exec("COMMIT");
    return { id: importId, status: "QUEUED", jobs, createdAt: timestamp };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function claimNextJob(database = getCatalogDatabase()) {
  const timestamp = now();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT * FROM jobs WHERE status='QUEUED' AND available_at <= ? ORDER BY created_at LIMIT 1").get(timestamp) as JobRow | undefined;
    if (!row) {
      database.exec("COMMIT");
      return null;
    }
    database.prepare("UPDATE jobs SET status='RUNNING', stage='VALIDATING_SOURCE', attempts=attempts+1, started_at=COALESCE(started_at,?), locked_at=? WHERE id=?").run(timestamp, timestamp, row.id);
    database.prepare("UPDATE imports SET status='RUNNING', updated_at=? WHERE id=?").run(timestamp, row.import_id);
    database.exec("COMMIT");
    return { ...row, status: "RUNNING", stage: "VALIDATING_SOURCE", attempts: row.attempts + 1, options: JSON.parse(row.options_json) as ImportOptions };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function updateJobStage(jobId: string, stage: string, message: string, level: JobEvent["level"] = "INFO", database = getCatalogDatabase()) {
  const timestamp = now();
  database.prepare("UPDATE jobs SET stage=? WHERE id=?").run(stage, jobId);
  addJobEvent(jobId, level, stage, message, {}, database, timestamp);
}

export function addJobEvent(jobId: string, level: JobEvent["level"], stage: string, message: string, metadata: Record<string, unknown> = {}, database = getCatalogDatabase(), timestamp = now()) {
  database.prepare("INSERT INTO job_events (job_id,level,stage,message,metadata_json,created_at) VALUES (?,?,?,?,?,?)").run(jobId, level, stage, message, JSON.stringify(metadata), timestamp);
}

function productFingerprint(product: NormalizedProduct) {
  return createHash("sha256").update(`${product.canonicalUrl.toLowerCase()}|${product.sourceProductId}|${product.sku.toLowerCase()}`).digest("hex");
}

export function findDuplicate(product: NormalizedProduct, database = getCatalogDatabase()) {
  const fingerprint = productFingerprint(product);
  return database.prepare("SELECT id,title,sku FROM products WHERE fingerprint=? OR canonical_url=? OR (source_product_id<>'' AND source_product_id=?) OR (sku<>'' AND sku=?) LIMIT 1").get(fingerprint, product.canonicalUrl, product.sourceProductId, product.sku) as { id: string; title: string; sku: string } | undefined;
}

export function saveProduct(jobId: string, product: NormalizedProduct, status: ProductStatus, database = getCatalogDatabase()) {
  const timestamp = now();
  const id = `PRD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const job = database.prepare("SELECT import_id FROM jobs WHERE id=?").get(jobId) as { import_id: string } | undefined;
  if (!job) throw new Error(`Job ${jobId} does not exist.`);
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(`INSERT INTO products (id,source_url,canonical_url,source_product_id,title,description,source_price,selling_price,currency,sku,stock,weight_grams,category,attributes_json,warnings_json,status,fingerprint,extracted_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, product.sourceUrl, product.canonicalUrl, product.sourceProductId, product.title, product.description,
      product.sourcePrice, product.sellingPrice, product.currency, product.sku, product.stock, product.weightGrams,
      product.category, JSON.stringify(product.attributes), JSON.stringify(product.warnings), status,
      productFingerprint(product), product.extractedAt, timestamp, timestamp,
    );
    const imageStatement = database.prepare("INSERT INTO product_images (id,product_id,source_url,position,alt,mime_type,status) VALUES (?,?,?,?,?,?,?)");
    product.images.forEach((image) => imageStatement.run(randomUUID(), id, image.sourceUrl, image.position, image.alt, image.mimeType ?? null, image.status));
    const variantStatement = database.prepare("INSERT INTO product_variants (id,product_id,name,option_value,sku,price,stock,attributes_json) VALUES (?,?,?,?,?,?,?,?)");
    product.variants.forEach((variant) => variantStatement.run(randomUUID(), id, variant.name, variant.option, variant.sku, variant.price, variant.stock, JSON.stringify(variant.attributes)));
    database.prepare("UPDATE jobs SET product_id=?,status='SUCCEEDED',stage='COMPLETE',finished_at=?,locked_at=NULL WHERE id=?").run(id, timestamp, jobId);
    database.prepare("INSERT INTO job_events (job_id,level,stage,message,metadata_json,created_at) VALUES (?,?,?,?,?,?)").run(jobId, "SUCCESS", "COMPLETE", "Normalized product saved for review.", JSON.stringify({ productId: id, warnings: product.warnings.length }), timestamp);
    refreshImport(job.import_id, database, timestamp);
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function markDuplicate(jobId: string, duplicate: { id: string; title: string; sku: string }, database = getCatalogDatabase()) {
  const timestamp = now();
  const job = database.prepare("SELECT import_id FROM jobs WHERE id=?").get(jobId) as { import_id: string };
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE jobs SET product_id=?,status='FAILED',stage='DUPLICATE_CHECK',error_code='DUPLICATE_PRODUCT',error_message=?,finished_at=?,locked_at=NULL WHERE id=?").run(duplicate.id, `Duplicate of ${duplicate.title} (${duplicate.sku}).`, timestamp, jobId);
    database.prepare("INSERT INTO job_events (job_id,level,stage,message,metadata_json,created_at) VALUES (?,?,?,?,?,?)").run(jobId, "WARNING", "DUPLICATE_CHECK", "Duplicate product detected; no new record was created.", JSON.stringify({ duplicateProductId: duplicate.id }), timestamp);
    refreshImport(job.import_id, database, timestamp);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function failOrRetryJob(job: Pick<JobRow, "id" | "import_id" | "attempts" | "max_attempts">, code: string, message: string, retryable: boolean, evidencePath?: string, database = getCatalogDatabase()) {
  const timestamp = now();
  const shouldRetry = retryable && job.attempts < job.max_attempts;
  const delaySeconds = Math.min(2 ** Math.max(job.attempts - 1, 0), 8);
  const availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    if (shouldRetry) {
      database.prepare("UPDATE jobs SET status='QUEUED',stage='QUEUED',error_code=?,error_message=?,evidence_path=?,available_at=?,locked_at=NULL WHERE id=?").run(code, message, evidencePath ?? null, availableAt, job.id);
      database.prepare("INSERT INTO job_events (job_id,level,stage,message,metadata_json,created_at) VALUES (?,?,?,?,?,?)").run(job.id, "WARNING", "QUEUED", `Attempt failed; retry ${job.attempts + 1}/${job.max_attempts} queued.`, JSON.stringify({ code, delaySeconds }), timestamp);
    } else {
      database.prepare("UPDATE jobs SET status='FAILED',error_code=?,error_message=?,evidence_path=?,finished_at=?,locked_at=NULL WHERE id=?").run(code, message, evidencePath ?? null, timestamp, job.id);
      database.prepare("INSERT INTO job_events (job_id,level,stage,message,metadata_json,created_at) VALUES (?,?,?,?,?,?)").run(job.id, "ERROR", "FAILED", message, JSON.stringify({ code }), timestamp);
      refreshImport(job.import_id, database, timestamp);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function refreshImport(importId: string, database: DatabaseSync, timestamp: string) {
  const counts = database.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='SUCCEEDED' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN status IN ('QUEUED','RUNNING') THEN 1 ELSE 0 END) AS active FROM jobs WHERE import_id=?`).get(importId) as { total: number; completed: number | null; failed: number | null; active: number | null };
  const status = counts.active ? "RUNNING" : counts.failed === counts.total ? "FAILED" : counts.failed ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  database.prepare("UPDATE imports SET status=?,completed_jobs=?,failed_jobs=?,updated_at=? WHERE id=?").run(status, counts.completed ?? 0, counts.failed ?? 0, timestamp, importId);
}

export function recordHeartbeat(workerId: string, currentJobId: string | null, database = getCatalogDatabase()) {
  database.prepare("INSERT INTO worker_heartbeats (id,last_seen_at,current_job_id,version) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,current_job_id=excluded.current_job_id,version=excluded.version").run(workerId, now(), currentJobId, "stage-1");
}

export function isWorkerOnline(database = getCatalogDatabase()) {
  const row = database.prepare("SELECT MAX(last_seen_at) AS last_seen_at FROM worker_heartbeats").get() as { last_seen_at: string | null };
  return Boolean(row.last_seen_at && Date.now() - Date.parse(row.last_seen_at) < 15_000);
}

export function getImport(importId: string, database = getCatalogDatabase()) {
  const record = database.prepare("SELECT * FROM imports WHERE id=?").get(importId) as ImportRow | undefined;
  if (!record) return null;
  const jobs = database.prepare("SELECT * FROM jobs WHERE import_id=? ORDER BY created_at").all(importId) as unknown as JobRow[];
  return { ...record, workerOnline: isWorkerOnline(database), jobs: jobs.map((job) => serializeJob(job, database)) };
}

export function getJob(jobId: string, database = getCatalogDatabase()) {
  const row = database.prepare("SELECT * FROM jobs WHERE id=?").get(jobId) as JobRow | undefined;
  return row ? serializeJob(row, database) : null;
}

function serializeJob(row: JobRow, database: DatabaseSync) {
  const events = database.prepare("SELECT level,stage,message,metadata_json,created_at FROM job_events WHERE job_id=? ORDER BY id").all(row.id);
  const product = row.product_id ? database.prepare("SELECT * FROM products WHERE id=?").get(row.product_id) : null;
  const images = row.product_id ? database.prepare("SELECT source_url AS sourceUrl,position,alt,mime_type AS mimeType,status FROM product_images WHERE product_id=? ORDER BY position").all(row.product_id) : [];
  const variants = row.product_id ? database.prepare("SELECT name,option_value AS option,sku,price,stock,attributes_json AS attributesJson FROM product_variants WHERE product_id=?").all(row.product_id) : [];
  return { ...row, options: JSON.parse(row.options_json), events: events.map((event) => ({ ...event, metadata: JSON.parse(String(event.metadata_json)) })), product: product ? { ...product, images, variants: variants.map((variant) => ({ ...variant, attributes: JSON.parse(String(variant.attributesJson)) })) } : null };
}

function relativeTime(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds || 1}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const accents = ["from-violet-100 to-indigo-100 text-violet-700", "from-sky-100 to-cyan-100 text-sky-700", "from-amber-100 to-orange-100 text-amber-700", "from-emerald-100 to-teal-100 text-emerald-700"];

export function listProducts(database = getCatalogDatabase()): Product[] {
  const rows = database.prepare("SELECT id,source_url,title,sku,source_price,selling_price,status,stock,weight_grams,category,updated_at FROM products ORDER BY updated_at DESC").all() as unknown as ProductRow[];
  return rows.map((row, index) => ({ id: row.id, sourceUrl: row.source_url, name: row.title, sku: row.sku || "No SKU", sourcePrice: row.source_price, sellingPrice: row.selling_price, status: row.status, updatedAt: relativeTime(row.updated_at), stock: row.stock, weightGrams: row.weight_grams, category: row.category || "Category requires review", accent: accents[index % accents.length] }));
}

function jobProductStatus(status: string, productStatus?: ProductStatus): ProductStatus {
  if (productStatus) return productStatus;
  if (status === "RUNNING" || status === "QUEUED") return "PROCESSING";
  if (status === "FAILED") return "FAILED";
  return "DRAFT";
}

export function listJobs(database = getCatalogDatabase()): Job[] {
  const rows = database.prepare("SELECT j.*,p.title AS product_title,p.status AS product_status FROM jobs j LEFT JOIN products p ON p.id=j.product_id ORDER BY j.created_at DESC LIMIT 100").all() as unknown as Array<JobRow & { product_title: string | null; product_status: ProductStatus | null }>;
  return rows.map((row) => {
    const events = database.prepare("SELECT level,message,created_at FROM job_events WHERE job_id=? ORDER BY id").all(row.id) as Array<{ level: JobEvent["level"]; message: string; created_at: string }>;
    const end = row.finished_at ? Date.parse(row.finished_at) : Date.now();
    const start = row.started_at ? Date.parse(row.started_at) : Date.parse(row.created_at);
    return { id: row.id, productName: row.product_title || new URL(row.source_url).pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Queued JakMall product", status: jobProductStatus(row.status, row.product_status ?? undefined), stage: row.stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (value) => value.toUpperCase()), attempts: row.attempts, duration: row.status === "RUNNING" ? "Running" : `${Math.max(0, (end - start) / 1000).toFixed(1)}s`, startedAt: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at)), evidencePath: row.evidence_path ?? undefined, errorMessage: row.error_message ?? undefined, events: events.map((event) => ({ time: new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(event.created_at)), level: event.level, message: event.message })) };
  });
}

export function retryJob(jobId: string, database = getCatalogDatabase()) {
  const timestamp = now();
  const result = database.prepare("UPDATE jobs SET status='QUEUED',stage='QUEUED',attempts=0,error_code=NULL,error_message=NULL,finished_at=NULL,available_at=?,locked_at=NULL WHERE id=? AND status='FAILED'").run(timestamp, jobId);
  if (Number(result.changes)) addJobEvent(jobId, "INFO", "QUEUED", "Manual retry queued.", {}, database);
  return Number(result.changes) > 0;
}

export function updateProduct(productId: string, values: { title: string; description: string; sku: string; sourcePrice: number; sellingPrice: number; stock: number; weightGrams: number; category: string }, database = getCatalogDatabase()) {
  const timestamp = now();
  const imageCount = (database.prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id=? AND status<>'INVALID'").get(productId) as { count: number }).count;
  const status: ProductStatus = values.title && values.sellingPrice > 0 && values.category && imageCount > 0 ? "READY" : "NEEDS_REVIEW";
  const result = database.prepare("UPDATE products SET title=?,description=?,sku=?,source_price=?,selling_price=?,stock=?,weight_grams=?,category=?,status=?,updated_at=? WHERE id=?").run(values.title, values.description, values.sku, values.sourcePrice, values.sellingPrice, values.stock, values.weightGrams, values.category, status, timestamp, productId);
  return Number(result.changes) ? { id: productId, status, updatedAt: timestamp } : null;
}
