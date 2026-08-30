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

export type JobEvent = { time: string; level: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; message: string };
export type Job = { id: string; productName: string; status: ProductStatus; stage: string; attempts: number; duration: string; startedAt: string; events: JobEvent[] };

export const products: Product[] = [
  { id: "prd_m331", name: "Logitech Wireless Mouse M331", sku: "LOG-M331", sourcePrice: 175000, sellingPrice: 210000, status: "PUBLISHED", updatedAt: "2 min ago", stock: 37, weightGrams: 250, category: "Computer Accessories · Mouse", accent: "from-violet-100 to-indigo-100 text-violet-700" },
  { id: "prd_hub710", name: "7-in-1 USB-C Hub", sku: "HUB-710", sourcePrice: 120000, sellingPrice: 144000, status: "PROCESSING", updatedAt: "4 min ago", stock: 22, weightGrams: 180, category: "Computer Accessories · USB Hubs", accent: "from-sky-100 to-cyan-100 text-sky-700" },
  { id: "prd_led042", name: "Portable LED Desk Lamp", sku: "LED-042", sourcePrice: 48000, sellingPrice: 58000, status: "NEEDS_REVIEW", updatedAt: "8 min ago", stock: 50, weightGrams: 320, category: "Category confirmation required", accent: "from-amber-100 to-orange-100 text-amber-700" },
  { id: "prd_keyk8", name: "Mechanical Keyboard K8", sku: "KEY-K8", sourcePrice: 250000, sellingPrice: 300000, status: "FAILED", updatedAt: "12 min ago", stock: 12, weightGrams: 780, category: "Computer Accessories · Keyboards", accent: "from-rose-100 to-red-100 text-rose-700" },
  { id: "prd_spkmini", name: "Bluetooth Speaker Mini", sku: "SPK-MINI", sourcePrice: 89000, sellingPrice: 107000, status: "DRAFT", updatedAt: "26 min ago", stock: 18, weightGrams: 410, category: "Audio · Speakers", accent: "from-fuchsia-100 to-pink-100 text-fuchsia-700" },
  { id: "prd_stand02", name: "Adjustable Laptop Stand", sku: "STAND-02", sourcePrice: 138000, sellingPrice: 166000, status: "READY", updatedAt: "41 min ago", stock: 29, weightGrams: 640, category: "Computer Accessories · Stands", accent: "from-emerald-100 to-teal-100 text-emerald-700" },
];

export const jobs: Job[] = [
  { id: "JOB-1042", productName: "Logitech Wireless Mouse M331", status: "PUBLISHED", stage: "Published", attempts: 1, duration: "11.8s", startedAt: "Today, 09:42", events: [
    { time: "09:42:18", level: "INFO", message: "JakMall source URL accepted" }, { time: "09:42:19", level: "SUCCESS", message: "12 product fields extracted" }, { time: "09:42:20", level: "SUCCESS", message: "5 images validated" }, { time: "09:42:22", level: "WARNING", message: "Category confirmed by operator" }, { time: "09:42:30", level: "SUCCESS", message: "Shopee result recorded" },
  ] },
  { id: "JOB-1041", productName: "7-in-1 USB-C Hub", status: "PROCESSING", stage: "Image validation", attempts: 1, duration: "Running", startedAt: "Today, 09:39", events: [
    { time: "09:39:02", level: "INFO", message: "Extraction worker started" }, { time: "09:39:07", level: "SUCCESS", message: "Normalized product payload saved" }, { time: "09:39:09", level: "INFO", message: "Validating 7 source images" },
  ] },
  { id: "JOB-1040", productName: "Portable LED Desk Lamp", status: "NEEDS_REVIEW", stage: "Category mapping", attempts: 1, duration: "8.2s", startedAt: "Today, 09:31", events: [
    { time: "09:31:04", level: "SUCCESS", message: "Product data extracted" }, { time: "09:31:08", level: "WARNING", message: "Category confidence 76%; review required" },
  ] },
  { id: "JOB-1039", productName: "Mechanical Keyboard K8", status: "FAILED", stage: "Image upload", attempts: 3, duration: "32.7s", startedAt: "Today, 09:24", events: [
    { time: "09:24:13", level: "INFO", message: "Publish dry run started" }, { time: "09:24:20", level: "WARNING", message: "Image upload timed out; retrying" }, { time: "09:24:45", level: "ERROR", message: "Image upload timed out after attempt 3/3" },
  ] },
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function formatStatus(status: ProductStatus) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
