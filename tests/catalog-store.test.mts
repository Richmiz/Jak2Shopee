import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { claimNextJob, completeCancelledJob, createImport, createReextraction, deleteProduct, exportProductsCsv, findDuplicate, getImport, getProductDetails, getWorkspaceSettings, listProducts, openCatalogDatabase, replaceProductFromExtraction, requestJobCancellation, retryJob, saveProduct, updateWorkspaceSettings } from "../src/server/catalog-store.mts";
import type { NormalizedProduct } from "../src/server/catalog-types.mts";

const directory = mkdtempSync(path.join(tmpdir(), "catalogbridge-test-"));
const database = openCatalogDatabase(path.join(directory, "test.db"));
after(() => { database.close(); rmSync(directory, { recursive: true, force: true }); });

test("persists and deletes a normalized product without deleting processing history", () => {
  const created = createImport(["https://www.jakmall.com/store/example"], { markupPercent: 20, validateImages: true, detectDuplicates: true, requireReview: true }, database);
  const job = claimNextJob(database);
  assert.ok(job);
  const product: NormalizedProduct = {
    sourceUrl: job.source_url, canonicalUrl: job.source_url, sourceProductId: "JM-1", title: "Example product",
    description: "Complete description", sourcePrice: 100000, sellingPrice: 120000, currency: "IDR", sku: "SKU-1",
    stock: 2, weightGrams: 200, category: "Accessories", attributes: {}, warnings: [], extractedAt: new Date().toISOString(),
    images: [{ sourceUrl: "https://cdn.example.test/1.jpg", alt: "Example", position: 0, status: "VALID", mimeType: "image/jpeg" }], variants: [],
  };
  assert.equal(findDuplicate(product, database), undefined);
  saveProduct(job.id, product, "READY", database);
  const listed = listProducts(database);
  assert.equal(listed.length, 1);
  const details = getProductDetails(listed[0].id, database);
  assert.equal(details?.description, "Complete description");
  assert.equal(details?.images[0]?.sourceUrl, "https://cdn.example.test/1.jpg");
  assert.deepEqual(details?.warnings, []);
  assert.equal(getImport(created.id, database)?.status, "COMPLETED");
  assert.equal(findDuplicate(product, database)?.sku, "SKU-1");
  assert.equal(deleteProduct(listed[0].id, database), true);
  assert.equal(getProductDetails(listed[0].id, database), null);
  assert.equal(listProducts(database).length, 0);
  assert.equal(getImport(created.id, database)?.jobs.length, 1);
});

test("persists validated workspace settings", () => {
  const current = getWorkspaceSettings(database);
  const updated = updateWorkspaceSettings({ ...current, defaultMarkupPercent: 25, marketplaceBuffer: 5000, maximumConcurrentJobs: 2, sessionTimeoutHours: 12 }, database);
  assert.equal(updated.settings.defaultMarkupPercent, 25);
  assert.equal(getWorkspaceSettings(database).marketplaceBuffer, 5000);
  assert.equal(getWorkspaceSettings(database).maximumConcurrentJobs, 2);
});

test("refreshes an existing product instead of creating a duplicate", () => {
  const created = createImport(["https://www.jakmall.com/store/refresh-example"], { markupPercent: 20 }, database);
  const job = claimNextJob(database);
  assert.ok(job);
  const original: NormalizedProduct = {
    sourceUrl: job.source_url, canonicalUrl: job.source_url, sourceProductId: "REF-1", title: "Jual Refresh example",
    description: "Original", sourcePrice: 100000, sellingPrice: 120000, currency: "IDR", sku: "REF-1Garansi",
    stock: 1, weightGrams: 200, category: "Accessories", attributes: {}, warnings: [], extractedAt: new Date().toISOString(), images: [], variants: [],
  };
  const productId = saveProduct(job.id, original, "NEEDS_REVIEW", database);
  const refresh = createReextraction(productId, database);
  assert.ok(refresh);
  const refreshJob = claimNextJob(database);
  assert.equal(refreshJob?.id, refresh.jobId);
  assert.equal(refreshJob?.job_kind, "REEXTRACT");
  const replacement = { ...original, title: "Refresh example", sku: "REF-1", stock: 5, description: "Updated source description", extractedAt: new Date().toISOString() };
  replaceProductFromExtraction(refresh.jobId, productId, replacement, "READY", database);
  assert.equal(getProductDetails(productId, database)?.stock, 5);
  assert.equal(getProductDetails(productId, database)?.sku, "REF-1");
  assert.equal(listProducts(database).filter((product) => product.id === productId).length, 1);
  assert.match(exportProductsCsv({}, database), /Refresh example/);
  assert.equal(getImport(created.id, database)?.status, "COMPLETED");
});

test("cancels a queued job and allows an explicit retry", () => {
  const created = createImport(["https://www.jakmall.com/store/cancel-example"], { markupPercent: 20 }, database);
  const jobId = created.jobs[0].id;
  assert.equal(requestJobCancellation(jobId, database), true);
  assert.equal(getImport(created.id, database)?.jobs[0]?.status, "CANCELLED");
  assert.equal(retryJob(jobId, database), true);
  const claimed = claimNextJob(database);
  assert.equal(claimed?.id, jobId);
  assert.equal(completeCancelledJob(jobId, database), true);
});
