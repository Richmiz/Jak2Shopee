const trailingSkuLabels = [
  "garansi",
  "warranty",
  "stok",
  "stock",
  "berat",
  "weight",
  "harga",
  "price",
  "tersedia",
];

export function normalizeSellerSku(value: unknown) {
  let sku = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  sku = sku.replace(/^\s*(?:kode\s+)?sku\s*:\s*/i, "").trim();
  for (const label of trailingSkuLabels) {
    sku = sku.replace(new RegExp(`(?:\\s*[-|:/]\\s*|\\s+)${label}\\b.*$`, "i"), "").trim();
    sku = sku.replace(new RegExp(`${label}$`, "i"), "").trim();
  }
  return sku.replace(/^[|:;,\s]+|[|:;,\s]+$/g, "").slice(0, 100);
}

export function normalizeProductTitle(value: unknown) {
  const title = typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() : "";
  return title.replace(/^jual\s+(?=\S)/i, "").trim();
}

export function extractExactStock(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const candidate of [record.value, record.amount, record.quantity, record.inventoryLevel]) {
      const parsed = extractExactStock(candidate);
      if (parsed !== undefined) return parsed;
    }
    return undefined;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || /^https?:/i.test(normalized)) return undefined;
  const labelled = normalized.match(/(?:stok|stock|inventory|quantity|tersedia|tersisa|available)\D{0,24}(\d[\d.,]*)/i)
    ?? normalized.match(/(\d[\d.,]*)\s*(?:pcs|buah|unit)\s*(?:tersedia|tersisa|available|in stock)/i);
  const plain = /^\s*\d[\d.,]*\s*$/.test(normalized) ? normalized : labelled?.[1];
  if (!plain) return undefined;
  const parsed = Number(plain.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
}

export function extractStockFromText(value: string) {
  const normalized = value.replace(/\s+/g, " ");
  const patterns = [
    /(?:stok|stock)(?:\s+(?:tersedia|tersisa|tinggal|sisa|available|remaining|left))?\s*:?\s*(\d[\d.,]*)/i,
    /(?:tersedia|tersisa|available)\s*:?\s*(\d[\d.,]*)\s*(?:pcs|buah|unit)?/i,
    /(\d[\d.,]*)\s*(?:pcs|buah|unit)\s*(?:tersedia|tersisa|available|in stock)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1].replace(/[^\d]/g, ""));
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return undefined;
}
