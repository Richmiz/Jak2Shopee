import { randomUUID } from "node:crypto";
import {
  claimNextJob,
  completeCancelledJob,
  failOrRetryJob,
  findDuplicate,
  getWorkspaceSettings,
  markDuplicate,
  recordHeartbeat,
  saveProduct,
  isJobCancellationRequested,
  replaceProductFromExtraction,
  updateJobStage,
} from "./server/catalog-store.mts";
import { CatalogError } from "./server/catalog-types.mts";
import { configuredBrowserMode, JakMallExtractor } from "./server/extraction/jakmall-extractor.mts";

const workerId = `local-${randomUUID().slice(0, 8)}`;
const pollInterval = Number(process.env.CATALOGBRIDGE_WORKER_POLL_MS || 1500);
const once = process.argv.includes("--once");
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function processJob(job: NonNullable<ReturnType<typeof claimNextJob>>, slotId: string, extractor: JakMallExtractor) {
  recordHeartbeat(slotId, job.id);
  try {
    const product = await extractor.extract(job.id, job.source_url, job.options, (stage, message, level = "INFO") => {
      if (isJobCancellationRequested(job.id)) throw new CatalogError("JOB_CANCELLED", "The job was cancelled by the operator.");
      updateJobStage(job.id, stage, message, level);
    });
    if (isJobCancellationRequested(job.id)) throw new CatalogError("JOB_CANCELLED", "The job was cancelled by the operator.");
    updateJobStage(job.id, "DUPLICATE_CHECK", "Checking canonical URL, source identity, and seller SKU.");
    const targetProductId = job.job_kind === "REEXTRACT" ? job.product_id ?? undefined : undefined;
    const duplicate = job.options.detectDuplicates ? findDuplicate(product, undefined, targetProductId) : undefined;
    if (duplicate) {
      markDuplicate(job.id, duplicate);
      return;
    }
    const needsReview = job.options.requireReview && product.warnings.length > 0;
    if (targetProductId) replaceProductFromExtraction(job.id, targetProductId, product, needsReview ? "NEEDS_REVIEW" : "READY");
    else saveProduct(job.id, product, needsReview ? "NEEDS_REVIEW" : "READY");
  } catch (error) {
    const catalogError = error instanceof CatalogError ? error : new CatalogError("WORKER_ERROR", error instanceof Error ? error.message : "Unknown local worker error.");
    if (catalogError.code === "JOB_CANCELLED") completeCancelledJob(job.id);
    else failOrRetryJob(job, catalogError.code, catalogError.message, catalogError.retryable, catalogError.evidencePath);
  } finally {
    recordHeartbeat(slotId, null);
  }
}

async function runSlot(slot: number) {
  const slotId = `${workerId}-${slot + 1}`;
  const extractor = new JakMallExtractor(slot ? `worker-${slot + 1}` : "");
  try {
    while (!stopping) {
      const allowedConcurrency = configuredBrowserMode() === "headless" ? getWorkspaceSettings().maximumConcurrentJobs : 1;
      if (slot >= allowedConcurrency) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }
      recordHeartbeat(slotId, null);
      const job = claimNextJob();
      if (job) await processJob(job, slotId, extractor);
      else if (once) break;
      else await new Promise((resolve) => setTimeout(resolve, pollInterval));
      if (once) break;
    }
  } finally {
    await extractor.close();
  }
}

async function main() {
  console.log(`[CatalogBridge] Local worker ${workerId} started.`);
  try {
    await Promise.all(Array.from({ length: once ? 1 : 3 }, (_value, slot) => runSlot(slot)));
  } finally {
    console.log("[CatalogBridge] Local worker stopped.");
  }
}

await main();
