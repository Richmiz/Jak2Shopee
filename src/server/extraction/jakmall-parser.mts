import * as cheerio from "cheerio";
import type { ImportOptions, NormalizedProduct, ProductVariant } from "../catalog-types.mts";
import { CatalogError } from "../catalog-types.mts";

type JsonRecord = Record<string, unknown>;

export type RenderedProductHints = {
  title?: string;
  sourcePrice?: number;
  description?: string;
  sku?: string;
  stock?: number;
  weightGrams?: number;
  images?: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function flattenJsonLd(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const record = asRecord(value);
  if (!record) return [];
  return [record, ...flattenJsonLd(record["@graph"])];
}

function typeIncludes(record: JsonRecord, name: string) {
  const type = record["@type"];
  return Array.isArray(type) ? type.includes(name) : type === name;
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean) ?? "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = text(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function imagesFrom(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imagesFrom);
  const record = asRecord(value);
  return record ? imagesFrom(record.url ?? record.contentUrl) : [];
}

function offerRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(offerRecords);
  const record = asRecord(value);
  if (!record) return [];
  if (typeIncludes(record, "AggregateOffer")) return offerRecords(record.offers);
  return [record];
}

function extractAttributes($: cheerio.CheerioAPI, product: JsonRecord) {
  const attributes: Record<string, string> = {};
  const properties = Array.isArray(product.additionalProperty) ? product.additionalProperty : [product.additionalProperty];
  properties.forEach((property) => {
    const record = asRecord(property);
    const name = firstText(record?.name, record?.propertyID);
    const value = firstText(record?.value, record?.valueReference);
    if (name && value) attributes[name] = value;
  });
  $("table tr").each((_index, element) => {
    const cells = $(element).find("th,td").map((_cellIndex, cell) => $(cell).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length >= 2 && cells[0] && cells[1] && cells[0].length < 80) attributes[cells[0]] ??= cells.slice(1).join(" ");
  });
  return attributes;
}

function findWeight(attributes: Record<string, string>, body: string) {
  const entry = Object.entries(attributes).find(([name]) => /weight|berat/i.test(name));
  const candidate = entry?.[1] || body.match(/(?:weight|berat)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(kg|g|gram)/i)?.[0] || "";
  const match = candidate.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram)/i);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  return Math.round(match[2].toLowerCase() === "kg" ? amount * 1000 : amount);
}

function breadcrumbCategory(records: JsonRecord[]) {
  const breadcrumb = records.find((record) => typeIncludes(record, "BreadcrumbList"));
  const items = Array.isArray(breadcrumb?.itemListElement) ? breadcrumb.itemListElement : [];
  return items.map((item) => firstText(asRecord(item)?.name, asRecord(asRecord(item)?.item)?.name)).filter(Boolean).slice(1, -1).join(" > ");
}

function variantsFromOffers(offers: JsonRecord[], fallbackSku: string): ProductVariant[] {
  if (offers.length <= 1) return [];
  return offers.map((offer, index) => ({
    name: "Variant",
    option: firstText(offer.name, offer.sku, `Option ${index + 1}`),
    sku: firstText(offer.sku, `${fallbackSku}-${index + 1}`),
    price: parseNumber(offer.price) || null,
    stock: /instock/i.test(text(offer.availability)) ? 1 : null,
    attributes: {},
  }));
}

export function parseJakMallProduct(html: string, sourceUrl: string, options: ImportOptions, hints: RenderedProductHints = {}): NormalizedProduct {
  const $ = cheerio.load(html);
  const records: JsonRecord[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try { records.push(...flattenJsonLd(JSON.parse($(element).text()))); } catch { /* Ignore malformed third-party JSON-LD. */ }
  });
  const product = records.find((record) => typeIncludes(record, "Product")) ?? {};
  const offers = offerRecords(product.offers);
  const primaryOffer = offers[0] ?? {};
  const canonicalUrl = firstText($("link[rel='canonical']").attr("href"), product.url, sourceUrl).split("#")[0].split("?")[0];
  const title = firstText(product.name, $('meta[property="og:title"]').attr("content"), $("h1").first().text(), hints.title);
  const description = firstText(product.description, $('meta[property="og:description"]').attr("content"), $('meta[name="description"]').attr("content"), hints.description);
  const sourcePrice = Math.round(parseNumber(primaryOffer.price ?? asRecord(product.offers)?.lowPrice ?? $('meta[property="product:price:amount"]').attr("content") ?? $('[itemprop="price"]').first().attr("content") ?? $('[itemprop="price"]').first().text() ?? hints.sourcePrice) || hints.sourcePrice || 0);
  const sku = firstText(product.sku, primaryOffer.sku, $("[data-sku]").first().attr("data-sku"), hints.sku);
  const sourceProductId = firstText(product.productID, product.mpn, sku, new URL(canonicalUrl).pathname.split("/").filter(Boolean).at(-1));
  const attributes = extractAttributes($, product);
  const body = $("body").text().replace(/\s+/g, " ");
  const stockText = firstText(primaryOffer.inventoryLevel, primaryOffer.availability, attributes.Stock, attributes.Stok);
  const stock = parseNumber(stockText) || (/instock/i.test(stockText) ? 1 : 0) || hints.stock || 0;
  const weightGrams = findWeight(attributes, body) || hints.weightGrams || 0;
  const category = firstText(product.category, breadcrumbCategory(records));
  const metaImages = $('meta[property="og:image"]').toArray().map((element) => $(element).attr("content") ?? "");
  const imageUrls = unique([...imagesFrom(product.image), ...metaImages, ...(hints.images ?? [])]).filter((value) => {
    try { return ["http:", "https:"].includes(new URL(value, canonicalUrl).protocol); } catch { return false; }
  }).map((value) => new URL(value, canonicalUrl).toString()).slice(0, 12);
  const warnings: string[] = [];
  if (!description) warnings.push("Description was not found.");
  if (!sku) warnings.push("Seller SKU was not found.");
  if (!stock) warnings.push("Stock quantity needs confirmation.");
  if (!weightGrams) warnings.push("Shipping weight needs confirmation.");
  if (!category) warnings.push("Destination category needs confirmation.");
  if (!imageUrls.length) warnings.push("No product images were found.");
  if (!title || sourcePrice <= 0) throw new CatalogError("REQUIRED_FIELD_MISSING", "JakMall did not expose a product title and valid price.");

  return {
    sourceUrl,
    canonicalUrl,
    sourceProductId,
    title,
    description,
    sourcePrice,
    sellingPrice: Math.round(sourcePrice * (1 + options.markupPercent / 100)),
    currency: "IDR",
    sku,
    stock,
    weightGrams,
    category,
    attributes,
    images: imageUrls.map((url, position) => ({ sourceUrl: url, alt: title, position, status: "PENDING" })),
    variants: variantsFromOffers(offers, sku || sourceProductId),
    warnings,
    extractedAt: new Date().toISOString(),
  };
}
