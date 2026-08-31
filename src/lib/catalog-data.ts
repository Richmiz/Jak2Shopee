export type ProductStatus =
  | "PUBLISHED"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "DRAFT"
  | "READY"
  | "BLOCKED"
  | "DUPLICATE";

export type Product = {
  id: string;
  sourceUrl?: string;
  name: string;
  sku: string;
  sourcePrice: number;
  sellingPrice: number;
  status: ProductStatus;
  updatedAt: string;
  stock: number;
  weightGrams: number;
  category: string;
  accent: string;
};

export type ProductDetailImage = {
  sourceUrl: string;
  position: number;
  alt: string;
  mimeType?: string;
  status: "PENDING" | "VALID" | "INVALID";
};

export type ProductDetailVariant = {
  name: string;
  option: string;
  sku: string;
  price: number | null;
  stock: number | null;
  attributes: Record<string, string>;
};

export type ProductDetails = Product & {
  canonicalUrl: string;
  sourceProductId: string;
  description: string;
  currency: string;
  attributes: Record<string, string>;
  warnings: string[];
  images: ProductDetailImage[];
  variants: ProductDetailVariant[];
  extractedAt: string;
  updatedAtIso: string;
};

export type JobEvent = { time: string; level: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; message: string };
export type Job = { id: string; productName: string; status: ProductStatus; stage: string; attempts: number; duration: string; startedAt: string; evidencePath?: string; errorMessage?: string; events: JobEvent[] };

export function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function formatStatus(status: ProductStatus) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
