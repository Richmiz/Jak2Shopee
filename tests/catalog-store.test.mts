import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { claimNextJob, createImport, deleteProduct, findDuplicate, getImport, getProductDetails, listProducts, openCatalogDatabase, saveProduct } from "../src/server/catalog-store.mts";
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
