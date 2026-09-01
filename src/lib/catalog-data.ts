export type ProductStatus =
  | "PUBLISHED"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "DRAFT"
  | "READY"
  | "BLOCKED"
  | "DUPLICATE"
  | "CANCELLED";

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
  latestJobId?: string;
  parserVersion?: string;
  needsRefresh?: boolean;
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
export type JobRunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type Job = { id: string; productId?: string; sourceUrl: string; productName: string; status: ProductStatus; runStatus: JobRunStatus; stage: string; attempts: number; maxAttempts: number; duration: string; startedAt: string; evidencePath?: string; errorCode?: string; errorMessage?: string; events: JobEvent[] };
export type JobsPage = { jobs: Job[]; page: number; pageSize: number; total: number; totalPages: number };

export function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function formatStatus(status: ProductStatus) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
