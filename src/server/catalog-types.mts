import { z } from "zod";

export const importOptionsSchema = z.object({
  markupPercent: z.coerce.number().min(0).max(500).default(20),
  minimumMarginPercent: z.coerce.number().min(0).max(500).default(10),
  marketplaceBuffer: z.coerce.number().int().min(0).max(100_000_000).default(0),
  roundingRule: z.union([z.literal(0), z.literal(500), z.literal(1000)]).default(0),
  validateImages: z.boolean().default(true),
  detectDuplicates: z.boolean().default(true),
  requireReview: z.boolean().default(true),
  automaticRetry: z.boolean().default(true),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(3),
  pauseOnVerification: z.boolean().default(true),
  browserTimeoutSeconds: z.coerce.number().int().min(15).max(180).default(45),
});

export const workspaceSettingsSchema = z.object({
  publisherMode: z.literal("dry-run").default("dry-run"),
  defaultMarkupPercent: z.coerce.number().min(0).max(500).default(20),
  minimumMarginPercent: z.coerce.number().min(0).max(500).default(10),
  marketplaceBuffer: z.coerce.number().int().min(0).max(100_000_000).default(0),
  roundingRule: z.union([z.literal(0), z.literal(500), z.literal(1000)]).default(1000),
  automaticRetry: z.boolean().default(true),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(3),
  pauseOnVerification: z.boolean().default(true),
  validateImagesByDefault: z.boolean().default(true),
  detectDuplicatesByDefault: z.boolean().default(true),
  requireReviewByDefault: z.boolean().default(true),
  maximumConcurrentJobs: z.coerce.number().int().min(1).max(3).default(1),
  browserTimeoutSeconds: z.coerce.number().int().min(15).max(180).default(45),
  sessionTimeoutHours: z.coerce.number().int().min(1).max(72).default(8),
});

export const defaultWorkspaceSettings = workspaceSettingsSchema.parse({});

export const jakMallUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "jakmall.com" || url.hostname.endsWith(".jakmall.com"));
  }, "Only HTTPS JakMall URLs are accepted.");

export const createImportSchema = z.object({
  urls: z.array(jakMallUrlSchema).min(1).max(20),
  options: importOptionsSchema.partial().default({}),
});

export const updateProductSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(20_000),
  sku: z.string().trim().max(100),
  sourcePrice: z.coerce.number().int().min(0),
  sellingPrice: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  weightGrams: z.coerce.number().int().min(0),
  category: z.string().trim().max(240),
});

export type ImportOptions = z.infer<typeof importOptionsSchema>;
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export type ProductImage = {
  sourceUrl: string;
  alt: string;
  position: number;
  status: "PENDING" | "VALID" | "INVALID";
  mimeType?: string;
};

export type ProductVariant = {
  name: string;
  option: string;
  sku: string;
  price: number | null;
  stock: number | null;
  attributes: Record<string, string>;
};

export type NormalizedProduct = {
  sourceUrl: string;
  canonicalUrl: string;
  sourceProductId: string;
  title: string;
  description: string;
  sourcePrice: number;
  sellingPrice: number;
  currency: "IDR";
  sku: string;
  stock: number;
  weightGrams: number;
  category: string;
  attributes: Record<string, string>;
  images: ProductImage[];
  variants: ProductVariant[];
  warnings: string[];
  extractedAt: string;
};

export type CatalogErrorCode =
  | "INVALID_SOURCE_URL"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_VERIFICATION_REQUIRED"
  | "EXTRACTION_TIMEOUT"
  | "REQUIRED_FIELD_MISSING"
  | "IMAGE_VALIDATION_FAILED"
  | "DUPLICATE_PRODUCT"
  | "JOB_CANCELLED"
  | "WORKER_ERROR";

export class CatalogError extends Error {
  code: CatalogErrorCode;
  retryable: boolean;
  evidencePath?: string;

  constructor(code: CatalogErrorCode, message: string, retryable = false, evidencePath?: string) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
    this.retryable = retryable;
    this.evidencePath = evidencePath;
  }
}

export function assertJakMallUrl(value: string) {
  const parsed = jakMallUrlSchema.safeParse(value);
  if (!parsed.success) throw new CatalogError("INVALID_SOURCE_URL", parsed.error.issues[0]?.message ?? "Invalid JakMall URL.");
  return new URL(parsed.data);
}
