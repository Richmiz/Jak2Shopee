"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CircleDashed, ImageIcon, Link2, PackageSearch, Play, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/workspace/page-header";
import { formatMoney } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

type ImportMode = "single" | "batch";
type Step = 1 | 2 | 3 | 4;

const initialProduct = {
  title: "Logitech Wireless Mouse M331",
  sku: "LOG-M331",
  sourcePrice: 175000,
  sellingPrice: 210000,
  stock: 37,
  weightGrams: 250,
  category: "",
  description: "Quiet wireless mouse with an ergonomic shape, reliable wireless connection, and long battery life.",
};

function validateJakMallUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && (url.hostname === "jakmall.com" || url.hostname.endsWith(".jakmall.com"));
  } catch {
    return false;
  }
}

function Provenance({ children, warning = false }: { children: string; warning?: boolean }) {
  const { t } = useLanguage();
  return <Badge variant="outline" className={warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{t(children)}</Badge>;
}

function Field({ id, label, value, onChange, type = "text", provenance = "Extracted" }: { id: string; label: string; value: string | number; onChange: (value: string) => void; type?: string; provenance?: string }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><Label htmlFor={id}>{t(label)}</Label><Provenance>{provenance}</Provenance></div>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function ImportWorkspace({ initialMode = "single" }: { initialMode?: ImportMode }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [step, setStep] = useState<Step>(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [markup, setMarkup] = useState("20");
  const [publishMode, setPublishMode] = useState("dry-run");
  const [validateImages, setValidateImages] = useState(true);
  const [detectDuplicates, setDetectDuplicates] = useState(true);
  const [requireReview, setRequireReview] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [product, setProduct] = useState(initialProduct);

  const parsedBatch = useMemo(() => batchUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url, valid: validateJakMallUrl(url) })), [batchUrls]);
  const singleUrlValid = validateJakMallUrl(sourceUrl);
  const progress = step === 1 ? 15 : step === 2 ? 45 : step === 3 ? 75 : 100;

  function reset() {
    setStep(1);
    setFeedback("");
    setProcessing(false);
    setProduct(initialProduct);
  }

  function extract() {
    if (mode === "batch") {
      const validCount = parsedBatch.filter((item) => item.valid).length;
      if (validCount === 0) {
        setFeedback("Add at least one valid HTTPS JakMall product URL.");
        return;
      }
      setStep(2);
      setFeedback(t(validCount === 1 ? "{count} valid URL prepared. Invalid rows were excluded." : "{count} valid URLs prepared. Invalid rows were excluded.", { count: validCount }));
      return;
    }

    if (!singleUrlValid) {
      setFeedback("Use a valid HTTPS URL from jakmall.com before extraction.");
      return;
    }

    setProcessing(true);
    setStep(2);
    setFeedback("Extracting and validating the product data…");
    window.setTimeout(() => {
      const sourcePrice = initialProduct.sourcePrice;
      setProduct({ ...initialProduct, sellingPrice: Math.round(sourcePrice * (1 + Number(markup || 0) / 100)) });
      setProcessing(false);
      setStep(3);
      setFeedback("Extraction complete. Category confirmation is required before the dry run can finish.");
    }, 650);
  }

  function completeDryRun() {
    if (!product.category) {
      setFeedback("Select a Shopee category to resolve the remaining blocking field.");
      return;
    }
    setStep(4);
    setFeedback(publishMode === "dry-run" ? "Dry run completed. The mapped listing payload is ready; no external changes were made." : "Live publishing is not connected yet. The validated listing was saved as Ready.");
  }

  const steps = ["Source", "Extract", "Review", "Result"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controlled workflow"
        title="Import from JakMall"
        description="Extract supplier data, validate the normalized product, and stop for human review when a field cannot be mapped safely."
        actions={<Button variant="outline" onClick={reset}>{t("Reset workspace")}</Button>}
      />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4">
            {steps.map((label, index) => {
              const current = index + 1;
              const complete = step > current;
              const active = step === current;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold", complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "bg-muted text-muted-foreground")}>{complete ? <Check className="size-4" /> : current}</span>
                  <div><p className={cn("text-sm font-medium", active || complete ? "text-foreground" : "text-muted-foreground")}>{t(label)}</p><p className="text-xs text-muted-foreground">{t(active ? "Current step" : complete ? "Complete" : "Pending")}</p></div>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="mt-4 h-1.5" />
        </CardContent>
      </Card>

      {feedback ? (
        <div role="status" className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", feedback.includes("valid") || feedback.includes("required") || feedback.includes("Select") ? "border-amber-200 bg-amber-50 text-amber-900" : "border-primary/20 bg-primary/[0.04] text-foreground")}>
          {processing ? <CircleDashed className="mt-0.5 size-4 animate-spin text-primary" /> : feedback.includes("required") || feedback.includes("valid") || feedback.includes("Select") ? <AlertTriangle className="mt-0.5 size-4 text-amber-700" /> : <ShieldCheck className="mt-0.5 size-4 text-primary" />}
          <p className="leading-6">{t(feedback)}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,27rem),1fr))] items-start gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle>{t("Source and automation rules")}</CardTitle><CardDescription>{t("Configure one controlled import job.")}</CardDescription></div>
              <div className="inline-flex w-fit rounded-lg border bg-muted/50 p-1">
                <Button size="sm" variant={mode === "single" ? "default" : "ghost"} onClick={() => { setMode("single"); reset(); }}>{t("Single")}</Button>
                <Button size="sm" variant={mode === "batch" ? "default" : "ghost"} onClick={() => { setMode("batch"); reset(); }}>{t("Batch")}</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {mode === "single" ? (
              <div className="space-y-2">
                <Label htmlFor="source-url">{t("JakMall product URL")}</Label>
                <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="source-url" className="pl-9" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} aria-invalid={sourceUrl.length > 0 && !singleUrlValid} /></div>
                <p className={cn("text-xs", singleUrlValid ? "text-emerald-700" : "text-muted-foreground")}>{t(singleUrlValid ? "Valid JakMall host" : "Only HTTPS URLs from jakmall.com are accepted.")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label htmlFor="batch-urls">{t("JakMall URLs")}</Label><span className="text-xs text-muted-foreground">{t("{count} rows", { count: parsedBatch.length })}</span></div>
                <Textarea id="batch-urls" className="min-h-32 font-mono text-xs" value={batchUrls} onChange={(event) => setBatchUrls(event.target.value)} />
                <div className="space-y-2">
                  {parsedBatch.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><span className={item.valid ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-rose-500"} /><span className="min-w-0 flex-1 truncate font-mono">{item.url}</span><span className={item.valid ? "text-emerald-700" : "text-rose-700"}>{t(item.valid ? "Valid" : "Excluded")}</span></div>)}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="markup">{t("Default markup (%)")}</Label><Input id="markup" min="0" max="500" type="number" value={markup} onChange={(event) => setMarkup(event.target.value)} /></div>
              <div className="space-y-2"><Label>{t("Publishing mode")}</Label><Select value={publishMode} onValueChange={setPublishMode}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dry-run">{t("Dry run · no submission")}</SelectItem><SelectItem value="live">{t("Live · not connected")}</SelectItem></SelectContent></Select></div>
            </div>

            <Separator />
            <div className="space-y-4">
              {[
                { title: "Validate product images", description: "Check format, dimensions, availability, and MIME type.", checked: validateImages, onCheckedChange: setValidateImages },
                { title: "Detect duplicate products", description: "Compare canonical URL, source ID, and seller SKU.", checked: detectDuplicates, onCheckedChange: setDetectDuplicates },
                { title: "Require review when uncertain", description: "Pause instead of guessing required marketplace attributes.", checked: requireReview, onCheckedChange: setRequireReview },
              ].map(({ title, description, checked, onCheckedChange }) => (
                <div key={title} className="flex items-center justify-between gap-6">
                  <div><p className="text-sm font-medium">{t(title)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(description)}</p></div>
                  <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={t(title)} />
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={extract} disabled={processing}>
              {processing ? <><CircleDashed className="size-4 animate-spin" />{t("Extracting product…")}</> : <><Play className="size-4" />{t(mode === "single" ? "Extract product" : "Prepare batch queue")}</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("Extraction preview")}</CardTitle><CardDescription>{t("Normalized data before marketplace mapping")}</CardDescription></CardHeader>
          <CardContent>
            {step < 3 ? (
              <div className="grid min-h-[430px] place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
                <div><span className="mx-auto grid size-14 place-items-center rounded-xl bg-primary/10 text-primary"><PackageSearch className="size-6" /></span><p className="mt-4 font-medium">{t("Waiting for validated source data")}</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{t("Run a single product extraction to populate the review workspace.")}</p></div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid aspect-[16/8] place-items-center rounded-xl bg-gradient-to-br from-violet-100 via-indigo-50 to-slate-100 text-violet-700"><div className="text-center"><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-medium">{t("5 validated product images")}</p></div></div>
                <div><div className="flex items-center gap-2"><Badge variant="outline">JakMall</Badge><ArrowRight className="size-3 text-muted-foreground" /><Badge className="bg-orange-500 text-white">Shopee</Badge></div><h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{product.title}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku}</p></div>
                <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("Source price")}</p><p className="mt-1 font-mono text-sm font-semibold">{formatMoney(product.sourcePrice)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("Selling price")}</p><p className="mt-1 font-mono text-sm font-semibold">{formatMoney(product.sellingPrice)}</p></div></div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-1 size-4 shrink-0" /><p><strong>{t("One blocking field:")}</strong> {t("Shopee category requires operator confirmation because source and destination schemas do not map 1:1.")}</p></div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {step >= 3 ? (
        <Card>
          <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{t("Review and normalize")}</CardTitle><CardDescription>{t("Confirm only the fields automation cannot infer safely.")}</CardDescription></div><Badge className={step === 4 ? "bg-emerald-600" : "bg-amber-500"}>{t(step === 4 ? "Dry run complete" : "1 field needs review")}</Badge></div></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
              <Field id="title" label="Product title" value={product.title} onChange={(title) => setProduct((current) => ({ ...current, title }))} />
              <Field id="sku" label="Seller SKU" value={product.sku} onChange={(sku) => setProduct((current) => ({ ...current, sku }))} />
              <Field id="source-price" label="Source price" type="number" value={product.sourcePrice} onChange={(sourcePrice) => setProduct((current) => ({ ...current, sourcePrice: Number(sourcePrice) }))} />
              <Field id="selling-price" label="Selling price" type="number" value={product.sellingPrice} onChange={(sellingPrice) => setProduct((current) => ({ ...current, sellingPrice: Number(sellingPrice) }))} provenance="Pricing rule" />
              <Field id="stock" label="Stock" type="number" value={product.stock} onChange={(stock) => setProduct((current) => ({ ...current, stock: Number(stock) }))} />
              <Field id="weight" label="Weight (grams)" type="number" value={product.weightGrams} onChange={(weightGrams) => setProduct((current) => ({ ...current, weightGrams: Number(weightGrams) }))} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>{t("Shopee category")}</Label><Provenance warning>Needs confirmation</Provenance></div><Select value={product.category} onValueChange={(category) => setProduct((current) => ({ ...current, category }))}><SelectTrigger className="w-full"><SelectValue placeholder={t("Select a destination category")} /></SelectTrigger><SelectContent><SelectItem value="Computer Accessories > Mouse">{t("Computer Accessories · Mouse")}</SelectItem><SelectItem value="Computer Accessories > USB Hubs">{t("Computer Accessories · USB Hubs")}</SelectItem><SelectItem value="Home & Living > Lighting">{t("Home & Living · Lighting")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="description">{t("Description")}</Label><Provenance>Extracted</Provenance></div><Textarea id="description" className="min-h-28" value={product.description} onChange={(event) => setProduct((current) => ({ ...current, description: event.target.value }))} /></div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-muted-foreground"><strong className="text-foreground">{t("Safe default:")}</strong> {t("Dry runs validate the listing without submitting it to Shopee.")}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setFeedback("Draft saved.")}>{t("Save draft")}</Button><Button onClick={completeDryRun}>{t(publishMode === "dry-run" ? "Complete dry run" : "Save as ready")}<ArrowRight className="size-4" /></Button></div></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
