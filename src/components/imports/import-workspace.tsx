"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CircleDashed, ImageIcon, Link2, PackageSearch, Play, ShieldCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ImportMode = "single" | "batch";
type Step = 1 | 2 | 3 | 4;
type FeedbackTone = "info" | "warning" | "error" | "success";

type PreviewProduct = {
  id: string; title: string; sku: string; sourcePrice: number; sellingPrice: number;
  stock: number; weightGrams: number; category: string; description: string;
  imageCount: number; warnings: string[];
};

type ApiJob = {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  stage: string;
  error_message?: string;
  product?: Record<string, unknown> & { images?: unknown[] };
};

type ImportStatus = { status: string; workerOnline: boolean; jobs: ApiJob[] };

function validateJakMallUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && (url.hostname === "jakmall.com" || url.hostname.endsWith(".jakmall.com"));
  } catch { return false; }
}

function toPreview(raw: NonNullable<ApiJob["product"]>): PreviewProduct {
  let warnings: string[] = [];
  try { warnings = JSON.parse(String(raw.warnings_json ?? "[]")) as string[]; } catch { /* Keep the safe empty value. */ }
  return {
    id: String(raw.id), title: String(raw.title ?? ""), sku: String(raw.sku ?? ""),
    sourcePrice: Number(raw.source_price ?? 0), sellingPrice: Number(raw.selling_price ?? 0),
    stock: Number(raw.stock ?? 0), weightGrams: Number(raw.weight_grams ?? 0),
    category: String(raw.category ?? ""), description: String(raw.description ?? ""),
    imageCount: raw.images?.length ?? 0, warnings,
  };
}

function Provenance({ children, warning = false }: { children: string; warning?: boolean }) {
  const { t } = useLanguage();
  return <Badge variant="outline" className={warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{t(children)}</Badge>;
}

function Field({ id, label, value, onChange, type = "text", provenance = "Extracted" }: { id: string; label: string; value: string | number; onChange: (value: string) => void; type?: string; provenance?: string }) {
  const { t } = useLanguage();
  return <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor={id}>{t(label)}</Label><Provenance>{provenance}</Provenance></div><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

export function ImportWorkspace({ initialMode = "single" }: { initialMode?: ImportMode }) {
  const { t } = useLanguage();
  const pollToken = useRef(0);
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [step, setStep] = useState<Step>(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [markup, setMarkup] = useState("20");
  const [validateImages, setValidateImages] = useState(true);
  const [detectDuplicates, setDetectDuplicates] = useState(true);
  const [requireReview, setRequireReview] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("info");
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const [importId, setImportId] = useState("");

  const parsedBatch = useMemo(() => batchUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url, valid: validateJakMallUrl(url) })), [batchUrls]);
  const singleUrlValid = validateJakMallUrl(sourceUrl);
  const progress = step === 1 ? 15 : step === 2 ? 45 : step === 3 ? 75 : 100;

  function showFeedback(message: string, tone: FeedbackTone = "info") { setFeedback(message); setFeedbackTone(tone); }
  function reset() { pollToken.current += 1; setStep(1); setFeedback(""); setProcessing(false); setProduct(null); setImportId(""); }

  async function pollImport(id: string, token: number) {
    let offlineNoticeShown = false;
    for (let attempt = 0; attempt < 300 && pollToken.current === token; attempt += 1) {
      const response = await fetch(`/api/imports/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The import status could not be loaded.");
      const status = await response.json() as ImportStatus;
      const active = status.jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
      if (!status.workerOnline && attempt >= 2 && !offlineNoticeShown) {
        offlineNoticeShown = true;
        showFeedback("Import queued. Start the local worker with npm run worker to continue extraction.", "warning");
      } else if (status.workerOnline && active) {
        const current = status.jobs.find((job) => job.status === "RUNNING") ?? status.jobs.find((job) => job.status === "QUEUED");
        const waiting = current?.stage === "WAITING_FOR_INPUT";
        showFeedback(waiting ? "Complete the JakMall verification in the Chrome window opened by the local worker." : `Local extraction is running · ${current?.stage.replaceAll("_", " ").toLowerCase() ?? "queued"}.`, waiting ? "warning" : "info");
      }
      if (!active) {
        const succeeded = status.jobs.filter((job) => job.status === "SUCCEEDED");
        const failed = status.jobs.filter((job) => job.status === "FAILED");
        setProcessing(false);
        if (mode === "single" && succeeded[0]?.product) {
          const preview = toPreview(succeeded[0].product);
          setProduct(preview); setStep(3);
          showFeedback(preview.warnings.length ? `Extraction complete with ${preview.warnings.length} item${preview.warnings.length === 1 ? "" : "s"} requiring review.` : "Extraction complete. The normalized product is ready.", preview.warnings.length ? "warning" : "success");
        } else if (mode === "batch") {
          setStep(4);
          showFeedback(`${succeeded.length} product${succeeded.length === 1 ? "" : "s"} saved; ${failed.length} failed. Open Products or Processing history for details.`, failed.length ? "warning" : "success");
        } else showFeedback(failed[0]?.error_message || "Extraction failed. Inspect Processing history for evidence.", "error");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    if (pollToken.current === token) { setProcessing(false); showFeedback("The import is still queued. Its progress is preserved in Processing history.", "warning"); }
  }

  async function extract() {
    const urls = mode === "single" ? (singleUrlValid ? [sourceUrl.trim()] : []) : parsedBatch.filter((item) => item.valid).map((item) => item.url);
    if (!urls.length) { showFeedback(mode === "single" ? "Use a valid HTTPS URL from jakmall.com before extraction." : "Add at least one valid HTTPS JakMall product URL.", "error"); return; }
    const token = pollToken.current + 1; pollToken.current = token; setProcessing(true); setStep(2);
    showFeedback(`Submitting ${urls.length} product${urls.length === 1 ? "" : "s"} to the local extraction queue.`);
    try {
      const response = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls, options: { markupPercent: Number(markup || 0), validateImages, detectDuplicates, requireReview } }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "The import could not be queued.");
      setImportId(result.id); await pollImport(result.id, token);
    } catch (error) { setProcessing(false); showFeedback(error instanceof Error ? error.message : "The import could not be queued.", "error"); }
  }

  async function saveReview() {
    if (!product) return;
    if (!product.category) { showFeedback("Add a destination category before marking the product ready.", "warning"); return; }
    setProcessing(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The reviewed product could not be saved.");
      setStep(4); showFeedback(result.status === "READY" ? "Review saved. The product is ready for the later Shopee mapping stage." : "Review saved. Some required source data still needs attention.", result.status === "READY" ? "success" : "warning");
    } catch (error) { showFeedback(error instanceof Error ? error.message : "The reviewed product could not be saved.", "error"); }
    finally { setProcessing(false); }
  }

  const steps = ["Source", "Extract", "Review", "Result"];
  const feedbackStyle = feedbackTone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : feedbackTone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : feedbackTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-primary/20 bg-primary/[0.04] text-foreground";

  return <div className="space-y-6">
    <PageHeader eyebrow="Local extraction" title="Import from JakMall" description="Queue supplier URLs, extract them in local Chrome, and review normalized records before any marketplace integration." actions={<Button variant="outline" onClick={reset}>{t("Reset workspace")}</Button>} />

    <Card><CardContent className="p-4 sm:p-5"><div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4">{steps.map((label, index) => { const current = index + 1; const complete = step > current; const active = step === current; return <div key={label} className="flex items-center gap-3"><span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold", complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "bg-muted text-muted-foreground")}>{complete ? <Check className="size-4" /> : current}</span><div><p className={cn("text-sm font-medium", active || complete ? "text-foreground" : "text-muted-foreground")}>{t(label)}</p><p className="text-xs text-muted-foreground">{t(active ? "Current step" : complete ? "Complete" : "Pending")}</p></div></div>; })}</div><Progress value={progress} className="mt-4 h-1.5" /></CardContent></Card>

    {feedback ? <div role="status" className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", feedbackStyle)}>{processing ? <CircleDashed className="mt-0.5 size-4 animate-spin text-primary" /> : feedbackTone === "error" || feedbackTone === "warning" ? <AlertTriangle className="mt-0.5 size-4" /> : <ShieldCheck className="mt-0.5 size-4" />}<div><p className="leading-6">{t(feedback)}</p>{importId ? <p className="mt-1 font-mono text-[10px] opacity-65">{importId}</p> : null}</div></div> : null}

    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,27rem),1fr))] items-start gap-4">
      <Card><CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{t("Source and extraction rules")}</CardTitle><CardDescription>{t("Create one durable local import queue.")}</CardDescription></div><div className="inline-flex w-fit rounded-lg border bg-muted/50 p-1"><Button size="sm" variant={mode === "single" ? "default" : "ghost"} onClick={() => { setMode("single"); reset(); }}>{t("Single")}</Button><Button size="sm" variant={mode === "batch" ? "default" : "ghost"} onClick={() => { setMode("batch"); reset(); }}>{t("Batch")}</Button></div></div></CardHeader><CardContent className="space-y-6">
        {mode === "single" ? <div className="space-y-2"><Label htmlFor="source-url">{t("JakMall product URL")}</Label><div className="relative"><Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="source-url" className="pl-9" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} aria-invalid={sourceUrl.length > 0 && !singleUrlValid} /></div><p className={cn("text-xs", singleUrlValid ? "text-emerald-700" : "text-muted-foreground")}>{t(singleUrlValid ? "Valid JakMall host" : "Only HTTPS URLs from jakmall.com are accepted.")}</p></div> : <div className="space-y-3"><div className="flex items-center justify-between"><Label htmlFor="batch-urls">{t("JakMall URLs")}</Label><span className="text-xs text-muted-foreground">{t("{count} rows", { count: parsedBatch.length })}</span></div><Textarea id="batch-urls" className="min-h-32 font-mono text-xs" value={batchUrls} onChange={(event) => setBatchUrls(event.target.value)} /><div className="space-y-2">{parsedBatch.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><span className={item.valid ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-rose-500"} /><span className="min-w-0 flex-1 truncate font-mono">{item.url}</span><span className={item.valid ? "text-emerald-700" : "text-rose-700"}>{t(item.valid ? "Valid" : "Excluded")}</span></div>)}</div></div>}
        <div className="space-y-2"><Label htmlFor="markup">{t("Default markup (%)")}</Label><Input id="markup" min="0" max="500" type="number" value={markup} onChange={(event) => setMarkup(event.target.value)} /></div><Separator />
        <div className="space-y-4">{[
          { title: "Validate product images", description: "Check availability and MIME type before saving.", checked: validateImages, onCheckedChange: setValidateImages },
          { title: "Detect duplicate products", description: "Compare canonical URL, source identity, and seller SKU.", checked: detectDuplicates, onCheckedChange: setDetectDuplicates },
          { title: "Require review when uncertain", description: "Pause instead of guessing missing operational fields.", checked: requireReview, onCheckedChange: setRequireReview },
        ].map(({ title, description, checked, onCheckedChange }) => <div key={title} className="flex items-center justify-between gap-6"><div><p className="text-sm font-medium">{t(title)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(description)}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={t(title)} /></div>)}</div>
        <Button className="w-full" onClick={() => void extract()} disabled={processing}>{processing ? <><CircleDashed className="size-4 animate-spin" />{t("Extracting product…")}</> : <><Play className="size-4" />{t(mode === "single" ? "Queue product extraction" : "Queue batch extraction")}</>}</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{t("Extraction preview")}</CardTitle><CardDescription>{t("Normalized data persisted before marketplace mapping")}</CardDescription></CardHeader><CardContent>{!product ? <div className="grid min-h-[430px] place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-xl bg-primary/10 text-primary"><PackageSearch className="size-6" /></span><p className="mt-4 font-medium">{t(processing ? "Local extraction in progress" : "Waiting for validated source data")}</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{t(processing ? "You can leave this page; the queued job and its evidence are persisted." : "Queue a single product extraction to populate the review workspace.")}</p></div></div> : <div className="space-y-5"><div className="grid aspect-[16/8] place-items-center rounded-xl bg-gradient-to-br from-violet-100 via-indigo-50 to-slate-100 text-violet-700"><div className="text-center"><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-medium">{t("{count} product images recorded", { count: product.imageCount })}</p></div></div><div><div className="flex items-center gap-2"><Badge variant="outline">JakMall</Badge><ArrowRight className="size-3 text-muted-foreground" /><Badge variant="secondary">{t("Normalized")}</Badge></div><h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{product.title}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku || t("No source SKU")}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("Source price")}</p><p className="mt-1 font-mono text-sm font-semibold">{formatMoney(product.sourcePrice)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("Selling price")}</p><p className="mt-1 font-mono text-sm font-semibold">{formatMoney(product.sellingPrice)}</p></div></div>{product.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-1 size-4 shrink-0" /><div><strong>{t("Review required")}</strong><ul className="mt-1 list-disc pl-4">{product.warnings.slice(0, 4).map((warning) => <li key={warning}>{t(warning)}</li>)}</ul></div></div></div> : null}</div>}</CardContent></Card>
    </div>

    {product ? <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{t("Review and normalize")}</CardTitle><CardDescription>{t("Confirm only the fields the extractor could not establish safely.")}</CardDescription></div><Badge className={step === 4 ? "bg-emerald-600" : "bg-amber-500"}>{t(step === 4 ? "Review saved" : `${product.warnings.length} items need review`)}</Badge></div></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4"><Field id="title" label="Product title" value={product.title} onChange={(title) => setProduct({ ...product, title })} /><Field id="sku" label="Seller SKU" value={product.sku} onChange={(sku) => setProduct({ ...product, sku })} /><Field id="source-price" label="Source price" type="number" value={product.sourcePrice} onChange={(value) => setProduct({ ...product, sourcePrice: Number(value) })} /><Field id="selling-price" label="Selling price" type="number" value={product.sellingPrice} onChange={(value) => setProduct({ ...product, sellingPrice: Number(value) })} provenance="Pricing rule" /><Field id="stock" label="Stock" type="number" value={product.stock} onChange={(value) => setProduct({ ...product, stock: Number(value) })} /><Field id="weight" label="Weight (grams)" type="number" value={product.weightGrams} onChange={(value) => setProduct({ ...product, weightGrams: Number(value) })} /></div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="category">{t("Destination category")}</Label><Provenance warning>Needs confirmation</Provenance></div><Input id="category" value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} placeholder={t("Enter the category to use during Shopee mapping")} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="description">{t("Description")}</Label><Provenance>Extracted</Provenance></div><Textarea id="description" className="min-h-28" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></div></div><Separator /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("Saving this review changes only the local normalized record. Shopee publishing is not part of Stage 1.")}</p><Button onClick={() => void saveReview()} disabled={processing}>{t("Save reviewed product")}<ArrowRight className="size-4" /></Button></div></CardContent></Card> : null}
  </div>;
}
