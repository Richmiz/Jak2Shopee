/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  ImageIcon,
  Link2,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/workspace/page-header";
import { formatMoney } from "@/lib/catalog-data";
import { extractListedRupiahPrice, formatGroupedInteger } from "@/lib/product-pricing.mts";
import { cn } from "@/lib/utils";

type ImportMode = "single" | "batch";
type Step = 1 | 2 | 3 | 4;
type FeedbackTone = "info" | "warning" | "error" | "success";

type PreviewImage = { sourceUrl: string; alt: string; status: string };
type PreviewProduct = {
  id: string;
  title: string;
  sku: string;
  sourcePrice: number;
  sellingPrice: number;
  stock: number;
  weightGrams: number;
  category: string;
  description: string;
  images: PreviewImage[];
  warnings: string[];
};

type ApiJob = {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  stage: string;
  error_message?: string;
  product?: Record<string, unknown> & { images?: unknown[] };
};

type ImportStatus = { status: string; workerOnline: boolean; jobs: ApiJob[] };
type Message = { text: string; variables?: Record<string, string | number> };
type Notice = Message & { tone: FeedbackTone };

const stageProgress: Record<string, number> = {
  QUEUED: 24,
  VALIDATING_SOURCE: 32,
  NAVIGATING: 45,
  WAITING_FOR_INPUT: 52,
  EXTRACTING: 66,
  VALIDATING_IMAGES: 80,
  NORMALIZING: 92,
  DUPLICATE_CHECK: 96,
};

function validateJakMallUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && (url.hostname === "jakmall.com" || url.hostname.endsWith(".jakmall.com"));
  } catch {
    return false;
  }
}

function toPreview(raw: NonNullable<ApiJob["product"]>): PreviewProduct {
  let warnings: string[] = [];
  try {
    warnings = JSON.parse(String(raw.warnings_json ?? "[]")) as string[];
  } catch {
    // Keep the safe empty value.
  }
  const images = (raw.images ?? []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const image = entry as Record<string, unknown>;
    const sourceUrl = String(image.sourceUrl ?? "");
    return sourceUrl ? [{ sourceUrl, alt: String(image.alt ?? raw.title ?? "Product image"), status: String(image.status ?? "PENDING") }] : [];
  });
  const storedSourcePrice = Number(raw.source_price ?? 0);
  const storedSellingPrice = Number(raw.selling_price ?? 0);
  const description = String(raw.description ?? "");
  const listedSourcePrice = extractListedRupiahPrice(description);
  const sourcePrice = listedSourcePrice ?? storedSourcePrice;
  const pricingMultiplier = storedSourcePrice > 0 && storedSellingPrice > 0 ? storedSellingPrice / storedSourcePrice : 1.2;
  const sellingPrice = listedSourcePrice && listedSourcePrice !== storedSourcePrice
    ? Math.round(listedSourcePrice * pricingMultiplier)
    : storedSellingPrice;
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    sku: String(raw.sku ?? ""),
    sourcePrice,
    sellingPrice,
    stock: Number(raw.stock ?? 0),
    weightGrams: Number(raw.weight_grams ?? 0),
    category: String(raw.category ?? ""),
    description,
    images,
    warnings,
  };
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    QUEUED: "Waiting for the local worker",
    VALIDATING_SOURCE: "Validating the JakMall URL",
    NAVIGATING: "Opening the product page",
    WAITING_FOR_INPUT: "Waiting for verification",
    EXTRACTING: "Extracting product details",
    VALIDATING_IMAGES: "Validating product images",
    NORMALIZING: "Normalizing product data",
    DUPLICATE_CHECK: "Checking for duplicates",
    FAILED: "Extraction needs attention",
  };
  return labels[stage] ?? stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Provenance({ children, warning = false }: { children: string; warning?: boolean }) {
  const { t } = useLanguage();
  return <Badge variant="outline" className={warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{t(children)}</Badge>;
}

function Field({ id, label, value, onChange, type = "text", provenance = "Extracted" }: { id: string; label: string; value: string | number; onChange: (value: string) => void; type?: string; provenance?: string }) {
  const { t } = useLanguage();
  return <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor={id}>{t(label)}</Label><Provenance>{provenance}</Provenance></div><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function AffixedNumberField({ id, label, value, onChange, prefix, suffix, provenance = "Extracted" }: { id: string; label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; provenance?: string }) {
  const { t } = useLanguage();
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2"><Label htmlFor={id}>{t(label)}</Label><Provenance>{provenance}</Provenance></div>
    <div className="relative">
      {prefix ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">{prefix}</span> : null}
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatGroupedInteger(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(Number(event.currentTarget.value.replace(/\D/g, "")) || 0)}
        className={cn("font-mono tabular-nums", prefix && "pl-10", suffix && "pr-10")}
      />
      {suffix ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">{suffix}</span> : null}
    </div>
  </div>;
}

function ProductImage({ image, className }: { image: PreviewImage; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}><ImageIcon className="size-6" /></div>;
  return <img src={image.sourceUrl} alt={image.alt} className={cn("bg-white object-contain", className)} onError={() => setFailed(true)} />;
}

function ProductGallery({ product }: { product: PreviewProduct }) {
  const { t } = useLanguage();
  const images = product.images.filter((image) => image.status !== "INVALID");
  const [active, setActive] = useState(0);

  if (!images.length) {
    return <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed bg-muted/30 text-center"><div><ImageIcon className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{t("No usable product image")}</p></div></div>;
  }

  return <div className="space-y-3">
    <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
      <ProductImage image={images[active]} className="aspect-[4/3] size-full" />
      <Badge className="absolute bottom-3 left-3 bg-background/90 text-foreground shadow-sm backdrop-blur">{t("{count} images", { count: images.length })}</Badge>
    </div>
    {images.length > 1 ? <div className="grid grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))] gap-2">
      {images.slice(0, 6).map((image, index) => <button key={`${image.sourceUrl}-${index}`} type="button" onClick={() => setActive(index)} className={cn("overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active === index && "border-primary ring-2 ring-primary/20")} aria-label={t("Show image {count}", { count: index + 1 })}><ProductImage image={image} className="aspect-square size-full" /></button>)}
    </div> : null}
  </div>;
}

export function ImportWorkspace({ initialMode = "single" }: { initialMode?: ImportMode }) {
  const { t } = useLanguage();
  const pollToken = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [step, setStep] = useState<Step>(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [markup, setMarkup] = useState("20");
  const [validateImages, setValidateImages] = useState(true);
  const [detectDuplicates, setDetectDuplicates] = useState(true);
  const [requireReview, setRequireReview] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<Message | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("info");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const [importId, setImportId] = useState("");
  const [currentStage, setCurrentStage] = useState("QUEUED");
  const [jobCounts, setJobCounts] = useState({ total: 1, complete: 0, failed: 0 });

  const parsedBatch = useMemo(() => batchUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url, valid: validateJakMallUrl(url) })), [batchUrls]);
  const singleUrlValid = validateJakMallUrl(sourceUrl);
  const progress = step === 1 ? 15 : step === 2 ? stageProgress[currentStage] ?? 45 : step === 3 ? 75 : 100;

  useEffect(() => {
    if (step > 1) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  function showFeedback(text: string, tone: FeedbackTone = "info", variables?: Record<string, string | number>) {
    setFeedback({ text, variables });
    setFeedbackTone(tone);
  }

  function showNotice(text: string, tone: FeedbackTone, variables?: Record<string, string | number>) {
    setNotice({ text, tone, variables });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(null), 7000);
  }

  function reset() {
    pollToken.current += 1;
    setStep(1);
    setFeedback(null);
    setProcessing(false);
    setProduct(null);
    setImportId("");
    setCurrentStage("QUEUED");
    setNotice(null);
  }

  async function pollImport(id: string, token: number) {
    let offlineNoticeShown = false;
    for (let attempt = 0; attempt < 300 && pollToken.current === token; attempt += 1) {
      const response = await fetch(`/api/imports/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The import status could not be loaded.");
      const status = await response.json() as ImportStatus;
      const active = status.jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
      const current = status.jobs.find((job) => job.status === "RUNNING") ?? status.jobs.find((job) => job.status === "QUEUED");
      const succeeded = status.jobs.filter((job) => job.status === "SUCCEEDED");
      const failed = status.jobs.filter((job) => job.status === "FAILED");
      setJobCounts({ total: status.jobs.length, complete: succeeded.length, failed: failed.length });
      if (current?.stage) setCurrentStage(current.stage);

      if (!status.workerOnline && attempt >= 2 && !offlineNoticeShown) {
        offlineNoticeShown = true;
        showFeedback("Import saved. Start the local worker with npm run worker to continue extraction.", "warning");
      } else if (status.workerOnline && active) {
        const waiting = current?.stage === "WAITING_FOR_INPUT";
        showFeedback(waiting ? "Complete the JakMall verification in the temporary Chrome window." : stageLabel(current?.stage ?? "QUEUED"), waiting ? "warning" : "info");
      }

      if (!active) {
        setProcessing(false);
        if (mode === "single" && succeeded[0]?.product) {
          const preview = toPreview(succeeded[0].product);
          const message = preview.warnings.length === 1 ? "Extraction complete with {count} item requiring review." : preview.warnings.length > 1 ? "Extraction complete with {count} items requiring review." : "Extraction complete. Review the product before saving.";
          const variables = preview.warnings.length ? { count: preview.warnings.length } : undefined;
          setProduct(preview);
          setStep(3);
          showFeedback(message, preview.warnings.length ? "warning" : "success", variables);
          showNotice(message, preview.warnings.length ? "warning" : "success", variables);
        } else if (mode === "batch") {
          const message = succeeded.length === 1 ? "{saved} product saved; {failed} failed." : "{saved} products saved; {failed} failed.";
          const variables = { saved: succeeded.length, failed: failed.length };
          setStep(4);
          showFeedback(message, failed.length ? "warning" : "success", variables);
          showNotice(message, failed.length ? "warning" : "success", variables);
        } else {
          const message = failed[0]?.error_message || "Extraction failed. Inspect Processing history for evidence.";
          setCurrentStage("FAILED");
          showFeedback(message, "error");
          showNotice(message, "error");
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    if (pollToken.current === token) {
      setProcessing(false);
      showFeedback("The import is still queued. Its progress is preserved in Processing history.", "warning");
    }
  }

  async function extract() {
    const urls = mode === "single" ? (singleUrlValid ? [sourceUrl.trim()] : []) : parsedBatch.filter((item) => item.valid).map((item) => item.url);
    if (!urls.length) {
      showFeedback(mode === "single" ? "Use a valid HTTPS URL from jakmall.com before extraction." : "Add at least one valid HTTPS JakMall product URL.", "error");
      return;
    }
    const token = pollToken.current + 1;
    pollToken.current = token;
    setProcessing(true);
    setCurrentStage("QUEUED");
    setJobCounts({ total: urls.length, complete: 0, failed: 0 });
    setStep(2);
    showFeedback(urls.length === 1 ? "Preparing {count} product for extraction." : "Preparing {count} products for extraction.", "info", { count: urls.length });
    try {
      const response = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls, options: { markupPercent: Number(markup || 0), validateImages, detectDuplicates, requireReview } }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "The import could not be started.");
      setImportId(result.id);
      await pollImport(result.id, token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The import could not be started.";
      setProcessing(false);
      setCurrentStage("FAILED");
      showFeedback(message, "error");
      showNotice(message, "error");
    }
  }

  async function saveReview() {
    if (!product) return;
    if (!product.category) {
      showFeedback("Add a destination category before marking the product ready.", "warning");
      showNotice("Add a destination category before marking the product ready.", "warning");
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The reviewed product could not be saved.");
      const message = result.status === "READY" ? "Review saved. The product is ready for the later Shopee mapping stage." : "Review saved. Some required source data still needs attention.";
      setStep(4);
      showFeedback(message, result.status === "READY" ? "success" : "warning");
      showNotice(message, result.status === "READY" ? "success" : "warning");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The reviewed product could not be saved.";
      showFeedback(message, "error");
      showNotice(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  const steps = ["Source", "Extract", "Review", "Result"];
  const feedbackStyle = feedbackTone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : feedbackTone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : feedbackTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-primary/20 bg-primary/[0.04] text-foreground";

  return <div className="space-y-5">
    {notice ? <div role="status" aria-live="polite" className={cn("fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-2xl border bg-background p-4 shadow-2xl animate-in slide-in-from-top-2", notice.tone === "error" ? "border-rose-200" : notice.tone === "warning" ? "border-amber-200" : "border-emerald-200")}>
      {notice.tone === "error" ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" /> : notice.tone === "warning" ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
      <div className="min-w-0 flex-1"><p className="font-medium">{t(notice.tone === "error" ? "Extraction needs attention" : "Extraction update")}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{t(notice.text, notice.variables)}</p></div>
      <Button size="icon-sm" variant="ghost" onClick={() => setNotice(null)} aria-label={t("Dismiss notification")}><X className="size-4" /></Button>
    </div> : null}

    <PageHeader eyebrow="Local extraction" title="Import from JakMall" description="Extract supplier data into a reviewable local product record." actions={<Button variant="outline" onClick={reset}>{t(step === 1 ? "Reset workspace" : "Import another")}</Button>} />

    <Card><CardContent className="p-4 sm:p-5"><div className="import-step-grid">{steps.map((label, index) => { const current = index + 1; const complete = step > current; const active = step === current; return <div key={label} className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left"><span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors", complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{complete ? <Check className="size-4" /> : current}</span><div className="min-w-0"><p className={cn("truncate text-xs font-medium sm:text-sm", active || complete ? "text-foreground" : "text-muted-foreground")}>{t(label)}</p><p className="hidden text-xs text-muted-foreground sm:block">{t(active ? "Current step" : complete ? "Complete" : "Pending")}</p></div></div>; })}</div><Progress value={progress} className="mt-4 h-1.5 transition-all" /></CardContent></Card>

    {feedback ? <div role="status" className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", feedbackStyle)}>{processing ? <CircleDashed className="mt-0.5 size-4 animate-spin text-primary" /> : feedbackTone === "error" || feedbackTone === "warning" ? <AlertTriangle className="mt-0.5 size-4" /> : <ShieldCheck className="mt-0.5 size-4" />}<div><p className="leading-6">{t(feedback.text, feedback.variables)}</p>{importId ? <p className="mt-1 font-mono text-[10px] opacity-65">{importId}</p> : null}</div></div> : null}

    {step === 1 ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,25rem),1fr))] items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
      <Card><CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{t("Source and extraction rules")}</CardTitle><CardDescription>{t("Configure one durable local import.")}</CardDescription></div><div className="inline-flex w-fit rounded-lg border bg-muted/50 p-1"><Button size="sm" variant={mode === "single" ? "default" : "ghost"} onClick={() => { setMode("single"); reset(); }}>{t("Single")}</Button><Button size="sm" variant={mode === "batch" ? "default" : "ghost"} onClick={() => { setMode("batch"); reset(); }}>{t("Batch")}</Button></div></div></CardHeader><CardContent className="space-y-6">
        {mode === "single" ? <div className="space-y-2"><Label htmlFor="source-url">{t("JakMall product URL")}</Label><div className="relative"><Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="source-url" className="pl-9" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} aria-invalid={sourceUrl.length > 0 && !singleUrlValid} placeholder="https://www.jakmall.com/..." /></div><p className={cn("text-xs", singleUrlValid ? "text-emerald-700" : "text-muted-foreground")}>{t(singleUrlValid ? "Valid JakMall host" : "Only HTTPS URLs from jakmall.com are accepted.")}</p></div> : <div className="space-y-3"><div className="flex items-center justify-between"><Label htmlFor="batch-urls">{t("JakMall URLs")}</Label><span className="text-xs text-muted-foreground">{t("{count} rows", { count: parsedBatch.length })}</span></div><Textarea id="batch-urls" className="min-h-32 font-mono text-xs" value={batchUrls} onChange={(event) => setBatchUrls(event.target.value)} placeholder="https://www.jakmall.com/..." /><div className="space-y-2">{parsedBatch.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><span className={item.valid ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-rose-500"} /><span className="min-w-0 flex-1 truncate font-mono">{item.url}</span><span className={item.valid ? "text-emerald-700" : "text-rose-700"}>{t(item.valid ? "Valid" : "Excluded")}</span></div>)}</div></div>}
        <div className="space-y-2"><Label htmlFor="markup">{t("Default markup (%)")}</Label><Input id="markup" min="0" max="500" type="number" value={markup} onChange={(event) => setMarkup(event.target.value)} /></div><Separator />
        <div className="space-y-4">{[
          { title: "Validate product images", description: "Check availability and MIME type before saving.", checked: validateImages, onCheckedChange: setValidateImages },
          { title: "Detect duplicate products", description: "Compare canonical URL, source identity, and seller SKU.", checked: detectDuplicates, onCheckedChange: setDetectDuplicates },
          { title: "Require review when uncertain", description: "Pause instead of guessing missing operational fields.", checked: requireReview, onCheckedChange: setRequireReview },
        ].map(({ title, description, checked, onCheckedChange }) => <div key={title} className="flex items-center justify-between gap-6"><div><p className="text-sm font-medium">{t(title)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(description)}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={t(title)} /></div>)}</div>
        <Button className="w-full" onClick={() => void extract()}><Play className="size-4" />{t(mode === "single" ? "Start extraction" : "Start batch extraction")}</Button>
      </CardContent></Card>
    </div> : null}

    {step === 2 ? <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2"><CardContent className="grid min-h-[430px] place-items-center p-6 text-center sm:p-10"><div className="w-full max-w-xl">
      <span className={cn("mx-auto grid size-16 place-items-center rounded-2xl", currentStage === "FAILED" ? "bg-rose-50 text-rose-600" : currentStage === "WAITING_FOR_INPUT" ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary")}>{currentStage === "FAILED" ? <AlertTriangle className="size-7" /> : currentStage === "WAITING_FOR_INPUT" ? <FileSearch className="size-7" /> : <CircleDashed className="size-7 animate-spin" />}</span>
      <Badge variant="outline" className="mt-5">{t(mode === "single" ? "Single product" : "Batch import")}</Badge>
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{t(stageLabel(currentStage))}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t(currentStage === "WAITING_FOR_INPUT" ? "Complete the one-time JakMall verification in the temporary Chrome window. Extraction resumes automatically." : currentStage === "FAILED" ? "The job evidence is preserved. Open Processing history for the exact failure details or return to the source and try again." : "The form is locked while the worker extracts and validates this product. The result will replace this screen automatically.")}</p>
      <div className="mt-7 rounded-2xl border bg-muted/20 p-4 text-left"><div className="flex items-center justify-between gap-4 text-sm"><span className="font-medium">{t("Overall progress")}</span><span className="font-mono text-xs text-muted-foreground">{Math.round(progress)}%</span></div><Progress value={progress} className="mt-3 h-2" /><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t("{complete} of {total} products complete", { complete: jobCounts.complete, total: jobCounts.total })}</span>{jobCounts.failed ? <span className="text-rose-600">{t("{count} failed", { count: jobCounts.failed })}</span> : <span>{t("Your job is saved locally")}</span>}</div></div>
      {currentStage === "FAILED" ? <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button variant="outline" onClick={reset}><RefreshCw className="size-4" />{t("Back to source")}</Button><Button asChild><Link href="/jobs">{t("Open Processing history")}<ArrowRight className="size-4" /></Link></Button></div> : null}
    </div></CardContent></Card> : null}

    {step === 3 && product ? <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2"><div className="h-1 bg-gradient-to-r from-emerald-400 via-primary to-violet-500" /><CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-emerald-600"><CheckCircle2 className="size-3" />{t("Extraction complete")}</Badge>{product.warnings.length ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{t("{count} items need review", { count: product.warnings.length })}</Badge> : null}</div><CardTitle className="mt-3">{t("Review extracted product")}</CardTitle><CardDescription>{t("Images and normalized fields are ready for confirmation.")}</CardDescription></div><Button onClick={() => void saveReview()} disabled={processing}>{processing ? <CircleDashed className="size-4 animate-spin" /> : <Check className="size-4" />}{t("Save reviewed product")}</Button></div></CardHeader><CardContent>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.35fr)]">
        <div className="space-y-4"><ProductGallery key={product.id} product={product} /><div className="rounded-2xl border p-4"><div className="flex items-center gap-2"><Badge variant="outline">JakMall</Badge><ArrowRight className="size-3 text-muted-foreground" /><Badge variant="secondary">{t("Normalized")}</Badge></div><h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{product.title}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku || t("No source SKU")}</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{t("Source price")}</p><p className="mt-1 font-mono text-sm font-semibold">{formatMoney(product.sourcePrice)}</p></div><div className="rounded-xl bg-primary/[0.06] p-3"><p className="text-xs text-muted-foreground">{t("Selling price")}</p><p className="mt-1 font-mono text-sm font-semibold text-primary">{formatMoney(product.sellingPrice)}</p></div></div></div>{product.warnings.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><strong>{t("Review required")}</strong><ul className="mt-1 list-disc pl-4">{product.warnings.slice(0, 5).map((warning) => <li key={warning}>{t(warning)}</li>)}</ul></div></div></div> : null}</div>
        <div className="space-y-6"><div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4"><Field id="title" label="Product title" value={product.title} onChange={(title) => setProduct({ ...product, title })} /><Field id="sku" label="Seller SKU" value={product.sku} onChange={(sku) => setProduct({ ...product, sku })} /><AffixedNumberField id="source-price" label="Source price" prefix="Rp" value={product.sourcePrice} onChange={(sourcePrice) => setProduct({ ...product, sourcePrice, sellingPrice: Math.round(sourcePrice * (1 + (Number(markup) || 0) / 100)) })} /><AffixedNumberField id="selling-price" label="Selling price" prefix="Rp" value={product.sellingPrice} onChange={(sellingPrice) => setProduct({ ...product, sellingPrice })} provenance="Pricing rule" /><Field id="stock" label="Stock" type="number" value={product.stock} onChange={(value) => setProduct({ ...product, stock: Number(value) })} /><AffixedNumberField id="weight" label="Weight" suffix="g" value={product.weightGrams} onChange={(weightGrams) => setProduct({ ...product, weightGrams })} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="category">{t("Destination category")}</Label><Provenance warning>Needs confirmation</Provenance></div><Input id="category" value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} placeholder={t("Enter the category to use during Shopee mapping")} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="description">{t("Description")}</Label><Provenance>Extracted</Provenance></div><Textarea id="description" className="min-h-40" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></div><Separator /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-sm leading-6 text-muted-foreground">{t("Saving changes updates only the local product record.")}</p><Button onClick={() => void saveReview()} disabled={processing}>{t("Save reviewed product")}<ArrowRight className="size-4" /></Button></div></div>
      </div>
    </CardContent></Card> : null}

    {step === 4 ? <Card className="overflow-hidden animate-in zoom-in-95"><div className="h-1 bg-emerald-500" /><CardContent className="grid min-h-[390px] place-items-center p-6 text-center sm:p-10"><div className="max-w-lg"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-8" /></span><Badge variant="outline" className="mt-5 border-emerald-200 bg-emerald-50 text-emerald-700">{t("Saved locally")}</Badge><h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{t(mode === "single" ? "Product review saved" : "Batch extraction complete")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{feedback ? t(feedback.text, feedback.variables) : null}</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button variant="outline" onClick={reset}><RefreshCw className="size-4" />{t("Import another")}</Button><Button asChild><Link href="/products">{t("Open Products")}<ArrowRight className="size-4" /></Link></Button></div></div></CardContent></Card> : null}
  </div>;
}
