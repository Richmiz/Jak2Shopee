import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseJakMallProduct } from "../src/server/extraction/jakmall-parser.mts";
import { jakMallUrlSchema } from "../src/server/catalog-types.mts";

test("accepts only HTTPS JakMall hosts", () => {
  assert.equal(jakMallUrlSchema.safeParse("https://www.jakmall.com/store/product").success, true);
  assert.equal(jakMallUrlSchema.safeParse("http://jakmall.com/store/product").success, false);
  assert.equal(jakMallUrlSchema.safeParse("https://jakmall.com.example.test/product").success, false);
});

test("normalizes JSON-LD product data", async () => {
  const html = await readFile(new URL("./fixtures/jakmall-product.html", import.meta.url), "utf8");
  const product = parseJakMallProduct(html, "https://www.jakmall.com/store/example-product", { markupPercent: 20, validateImages: true, detectDuplicates: true, requireReview: true });
  assert.equal(product.title, "Portable Mechanical Keyboard");
  assert.equal(product.sourcePrice, 250000);
  assert.equal(product.sellingPrice, 300000);
  assert.equal(product.weightGrams, 720);
  assert.equal(product.images.length, 2);
  assert.equal(product.attributes.Switch, "Brown");
});
