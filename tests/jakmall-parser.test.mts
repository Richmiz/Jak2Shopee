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

test("uses rendered browser hints when JakMall omits structured product fields", () => {
  const product = parseJakMallProduct(
    "<html><head><link rel='canonical' href='https://www.jakmall.com/store/rendered-product'></head><body></body></html>",
    "https://www.jakmall.com/store/rendered-product",
    { markupPercent: 20, validateImages: true, detectDuplicates: true, requireReview: true },
    {
      title: "Rendered JakMall Product",
      sourcePrice: 60900,
      description: "Product description extracted from the rendered page.",
      sku: "SKU-RENDERED",
      stock: 1,
      weightGrams: 1300,
      images: ["https://cdn.example.test/rendered.jpg"],
    },
  );
  assert.equal(product.title, "Rendered JakMall Product");
  assert.equal(product.sourcePrice, 60900);
  assert.equal(product.sellingPrice, 73080);
  assert.equal(product.sku, "SKU-RENDERED");
  assert.equal(product.stock, 1);
  assert.equal(product.weightGrams, 1300);
});

test("applies persisted pricing policy deterministically", () => {
  const product = parseJakMallProduct(
    `<script type="application/ld+json">{"@type":"Product","name":"Jual Pricing example","sku":"PRICE-1","offers":{"@type":"Offer","price":"607000","inventoryLevel":5}}</script>`,
    "https://www.jakmall.com/store/pricing-example",
    { markupPercent: 20, minimumMarginPercent: 25, marketplaceBuffer: 5000, roundingRule: 1000 },
  );
  assert.equal(product.title, "Pricing example");
  assert.equal(product.stock, 5);
  assert.equal(product.sellingPrice, 764000);
});

test("prefers the visible product description and reconciles the listed JakMall price", () => {
  const html = `<html><head>
    <link rel="canonical" href="https://www.jakmall.com/store/bolde-supermop">
    <meta property="og:description" content="Pembersih Rumah BOLDe Supermop harga Rp 309 . 000 dikirim dari Tangerang.">
    <script type="application/ld+json">{"@type":"Product","name":"Jual BOLDe Supermop","sku":"6703613588075Garansi","description":"SEO product summary","offers":{"@type":"Offer","price":"11600"}}</script>
  </head><body></body></html>`;
  const visibleDescription = "Bolde Supermop ELEGANTE\nKapasitas 7 liter\nBerat paket: 6 kg.";
  const product = parseJakMallProduct(
    html,
    "https://www.jakmall.com/store/bolde-supermop",
    { markupPercent: 20, validateImages: true, detectDuplicates: true, requireReview: true },
    { title: "BOLDe Supermop", sourcePrice: 11_600, description: visibleDescription, sku: "6703613588075", weightGrams: 6000 },
  );

  assert.equal(product.title, "BOLDe Supermop");
  assert.equal(product.sku, "6703613588075");
  assert.equal(product.description, visibleDescription);
  assert.equal(product.sourcePrice, 309_000);
  assert.equal(product.sellingPrice, 370_800);
  assert.equal(product.weightGrams, 6000);
});

test("removes adjacent storefront labels and keeps the exact stock quantity", async () => {
  const html = await readFile(new URL("./fixtures/jakmall-visible-stock.html", import.meta.url), "utf8");
  const product = parseJakMallProduct(
    html,
    "https://www.jakmall.com/store/jacal-electric-kettle",
    { markupPercent: 20, validateImages: false, detectDuplicates: true, requireReview: true },
  );

  assert.equal(product.title, "JACAL Teko Listrik Kopi Pemanas Air Leher Angsa Pour Over");
  assert.equal(product.sku, "7CHWVUGY");
  assert.equal(product.stock, 5);
  assert.equal(product.warnings.includes("Exact stock quantity needs confirmation."), false);
});
