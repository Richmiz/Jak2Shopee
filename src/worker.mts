import { randomUUID } from "node:crypto";
import {
  claimNextJob,
  failOrRetryJob,
  findDuplicate,
  markDuplicate,
  recordHeartbeat,
  saveProduct,
  updateJobStage,
} from "./server/catalog-store.mts";
import { CatalogError } from "./server/catalog-types.mts";
import { JakMallExtractor } from "./server/extraction/jakmall-extractor.mts";

const workerId = `local-${randomUUID().slice(0, 8)}`;
const pollInterval = Number(process.env.CATALOGBRIDGE_WORKER_POLL_MS || 1500);
const once = process.argv.includes("--once");
const extractor = new JakMallExtractor();
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function processJob(job: NonNullable<ReturnType<typeof claimNextJob>>) {
  recordHeartbeat(workerId, job.id);
  try {
    const product = await extractor.extract(job.id, job.source_url, job.options, (stage, message, level = "INFO") => {
      updateJobStage(job.id, stage, message, level);
    });
    updateJobStage(job.id, "DUPLICATE_CHECK", "Checking canonical URL, source identity, and seller SKU.");
    const duplicate = job.options.detectDuplicates ? findDuplicate(product) : undefined;
    if (duplicate) {
      markDuplicate(job.id, duplicate);
      return;
    }
    const needsReview = job.options.requireReview && product.warnings.length > 0;
    saveProduct(job.id, product, needsReview ? "NEEDS_REVIEW" : "READY");
  } catch (error) {
    const catalogError = error instanceof CatalogError ? error : new CatalogError("WORKER_ERROR", error instanceof Error ? error.message : "Unknown local worker error.");
    failOrRetryJob(job, catalogError.code, catalogError.message, catalogError.retryable, catalogError.evidencePath);
  } finally {
    recordHeartbeat(workerId, null);
  }
}

async function main() {
  console.log(`[CatalogBridge] Local worker ${workerId} started.`);
  try {
    while (!stopping) {
      recordHeartbeat(workerId, null);
      const job = claimNextJob();
      if (job) await processJob(job);
      else if (once) break;
      else await new Promise((resolve) => setTimeout(resolve, pollInterval));
      if (once) break;
    }
  } finally {
    await extractor.close();
    console.log("[CatalogBridge] Local worker stopped.");
  }
}

await main();
