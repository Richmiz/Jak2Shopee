/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { AlertTriangle, Download, ExternalLink, ImageIcon, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/workspace/page-header";
import { ProductAvatar } from "@/components/workspace/product-avatar";
import { StatusBadge } from "@/components/workspace/status-badge";
import { formatMoney, formatStatus, type Product, type ProductDetails, type ProductDetailImage, type ProductStatus } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

const statuses: Array<"ALL" | ProductStatus> = ["ALL", "PUBLISHED", "READY", "PROCESSING", "NEEDS_REVIEW", "FAILED", "DRAFT"];

type DetailState =
  | { status: "loading" }
  | { status: "success"; product: ProductDetails }
  | { status: "error"; message: string };

function formatDetailDate(value: string, language: "en" | "id") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function DetailImage({ image, className }: { image: ProductDetailImage; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}><ImageIcon className="size-7" /></div>;
  return <img src={image.sourceUrl} alt={image.alt} className={cn("bg-white object-contain", className)} onError={() => setFailed(true)} />;
}

function DetailGallery({ product }: { product: ProductDetails }) {
  const { t } = useLanguage();
  const images = product.images.filter((image) => image.status !== "INVALID");
  const [active, setActive] = useState(0);

  if (!images.length) {
    return <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><ImageIcon className="size-5" /></span><p className="mt-3 text-sm font-medium">{t("No product images were saved")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Re-run extraction after confirming the source images are available.")}</p></div></div>;
  }

  return <div className="space-y-3">
    <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm"><DetailImage image={images[active]} className="aspect-[4/3] size-full" /><span className="absolute bottom-3 left-3 rounded-full border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">{t("{count} usable images", { count: images.length })}</span></div>
    {images.length > 1 ? <div className="grid grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))] gap-2">{images.slice(0, 6).map((image, index) => <button key={`${image.sourceUrl}-${index}`} type="button" onClick={() => setActive(index)} aria-label={t("Show image {count}", { count: index + 1 })} className={cn("overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active === index && "border-primary ring-2 ring-primary/20")}><DetailImage image={image} className="aspect-square size-full" /></button>)}</div> : null}
  </div>;
}

function DetailsLoading({ summary }: { summary: Product }) {
  return <div className="grid gap-6 p-5 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.35fr)] sm:p-6"><ProductAvatar accent={summary.accent} className="aspect-[4/3] size-full rounded-2xl" /><div className="space-y-4"><div className="h-6 w-28 animate-pulse rounded-full bg-muted" /><div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div><div className="h-32 animate-pulse rounded-xl bg-muted" /></div></div>;
}

function ProductDetailsDialog({ summary, onClose }: { summary: Product; onClose: () => void }) {
  const { language, t } = useLanguage();
  const [requestVersion, setRequestVersion] = useState(0);
  const [detailState, setDetailState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(summary.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ProductDetails & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Product details could not be loaded.");
        return payload;
      })
      .then((product) => setDetailState({ status: "success", product }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDetailState({ status: "error", message: error instanceof Error ? error.message : "Product details could not be loaded." });
      });
    return () => controller.abort();
  }, [summary.id, requestVersion]);

  const retry = () => {
    setDetailState({ status: "loading" });
    setRequestVersion((value) => value + 1);
  };
  const product = detailState.status === "success" ? detailState.product : null;
  const attributeEntries = product ? Object.entries(product.attributes) : [];

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="product-detail-dialog max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><DialogTitle className="text-lg leading-6 sm:text-xl">{summary.name}</DialogTitle><DialogDescription className="mt-1.5">{t("Normalized product record · {sku}", { sku: summary.sku })}</DialogDescription></div>
          <StatusBadge status={product?.status ?? summary.status} className="w-fit shrink-0" />
        </div>
      </DialogHeader>

      <div className="min-h-0 overflow-y-auto">
        {detailState.status === "loading" ? <DetailsLoading summary={summary} /> : null}
        {detailState.status === "error" ? <div className="grid min-h-80 place-items-center p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="size-5" /></span><h3 className="mt-4 font-semibold">{t("Product details unavailable")}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{t(detailState.message)}</p><Button className="mt-5" variant="outline" onClick={retry}><RefreshCw className="size-4" />{t("Try again")}</Button></div></div> : null}
        {product ? <div className="space-y-6 p-5 sm:p-6">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.35fr)]">
            <DetailGallery key={product.id} product={product} />
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl border p-3.5"><dt className="text-xs text-muted-foreground">{t("Source price")}</dt><dd className="mt-1 font-mono font-semibold">{formatMoney(product.sourcePrice)}</dd></div><div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3.5"><dt className="text-xs text-muted-foreground">{t("Selling price")}</dt><dd className="mt-1 font-mono font-semibold text-primary">{formatMoney(product.sellingPrice)}</dd></div><div className="rounded-xl border p-3.5"><dt className="text-xs text-muted-foreground">{t("Stock")}</dt><dd className="mt-1 font-mono font-semibold">{product.stock}</dd></div><div className="rounded-xl border p-3.5"><dt className="text-xs text-muted-foreground">{t("Weight")}</dt><dd className="mt-1 font-mono font-semibold">{product.weightGrams} g</dd></div></dl>
              {product.warnings.length ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><h3 className="text-sm font-semibold">{t("Review warnings")}</h3><ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5">{product.warnings.map((warning) => <li key={warning}>{t(warning)}</li>)}</ul></div></div></section> : null}
              <section><h3 className="text-sm font-semibold">{t("Product details")}</h3><dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">{t("Seller SKU")}</dt><dd className="mt-1 break-all font-mono text-xs">{product.sku}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Source product ID")}</dt><dd className="mt-1 break-all font-mono text-xs">{product.sourceProductId || t("Not recorded")}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Category")}</dt><dd className="mt-1">{t(product.category)}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Currency")}</dt><dd className="mt-1 font-mono text-xs">{product.currency}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Extracted at")}</dt><dd className="mt-1 text-xs">{formatDetailDate(product.extractedAt, language)}</dd></div><div><dt className="text-xs text-muted-foreground">{t("Last updated")}</dt><dd className="mt-1 text-xs">{formatDetailDate(product.updatedAtIso, language)}</dd></div></dl></section>
              <Button asChild variant="outline" className="w-full sm:w-auto"><a href={product.canonicalUrl || product.sourceUrl} target="_blank" rel="noreferrer">{t("Open JakMall source")}<ExternalLink className="size-4" /></a></Button>
            </div>
          </div>

          <Separator />
          <section><h3 className="text-sm font-semibold">{t("Description")}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{product.description || t("No description was recorded.")}</p></section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t("Extracted attributes")}</h3><span className="text-xs text-muted-foreground">{attributeEntries.length}</span></div>{attributeEntries.length ? <dl className="mt-3 divide-y">{attributeEntries.map(([name, value]) => <div key={name} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-2.5 text-xs"><dt className="text-muted-foreground">{name}</dt><dd className="break-words text-right font-medium">{value}</dd></div>)}</dl> : <p className="mt-3 text-sm text-muted-foreground">{t("No source attributes were recorded.")}</p>}</section>
            <section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t("Variants")}</h3><span className="text-xs text-muted-foreground">{product.variants.length}</span></div>{product.variants.length ? <div className="mt-3 space-y-2">{product.variants.map((variant, index) => <div key={`${variant.sku}-${index}`} className="rounded-xl bg-muted/35 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{variant.name}: {variant.option}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{variant.sku || t("No SKU")}</p></div>{variant.price !== null ? <span className="shrink-0 font-mono text-xs font-semibold">{formatMoney(variant.price)}</span> : null}</div>{variant.stock !== null ? <p className="mt-2 text-xs text-muted-foreground">{t("Stock")}: {variant.stock}</p> : null}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{t("No product variants were recorded.")}</p>}</section>
          </div>

          <section className="rounded-xl bg-muted/30 p-4"><h3 className="text-sm font-semibold">{t("Source record")}</h3><dl className="mt-3 space-y-2 text-xs"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-4"><dt className="text-muted-foreground">{t("Source URL")}</dt><dd className="break-all font-mono sm:text-right">{product.sourceUrl}</dd></div><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-4"><dt className="text-muted-foreground">{t("Canonical URL")}</dt><dd className="break-all font-mono sm:text-right">{product.canonicalUrl}</dd></div></dl></section>
        </div> : null}
      </div>
    </DialogContent>
  </Dialog>;
}

export function ProductsView({ initialProducts, initialSelectedId }: { initialProducts: Product[]; initialSelectedId?: string }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<"ALL" | ProductStatus>("ALL");
  const [selected, setSelected] = useState<Product | null>(
    initialProducts.find((product) => product.id === initialSelectedId) ?? null,
  );
  const [notice, setNotice] = useState("");

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filtered = initialProducts.filter((product) => {
    const matchesStatus = status === "ALL" || product.status === status;
    const matchesQuery = !normalizedQuery || product.name.toLowerCase().includes(normalizedQuery) || product.sku.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Normalized catalog" title="Products" description="Review every extracted, validated, and published product in one operational view." actions={<Button asChild><Link href="/imports/new"><Plus className="size-4" />{t("Import product")}</Link></Button>} />

      {notice ? <div role="status" className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">{notice}</div> : null}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-[1_1_18rem]"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label={t("Search products")} className="pl-9" placeholder={t("Search product or SKU")} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <Select value={status} onValueChange={(value) => setStatus(value as "ALL" | ProductStatus)}><SelectTrigger className="w-full lg:w-auto lg:min-w-48" aria-label={t("Filter by status")}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item === "ALL" ? t("All statuses") : t(formatStatus(item))}</SelectItem>)}</SelectContent></Select>
            <div className="lg:ml-auto"><Button variant="outline" onClick={() => setNotice(t("CSV export is not available yet."))}><Download className="size-4" />{t("Export CSV")}</Button></div>
          </div>
        </CardContent>
      </Card>

      <Card className="adaptive-records overflow-hidden">
        <div className="adaptive-records__compact divide-y">
          {filtered.length ? filtered.map((product) => <button type="button" key={product.id} onClick={() => setSelected(product)} className="flex min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/45"><ProductAvatar accent={product.accent} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{product.sku} · {formatMoney(product.sellingPrice)}</span></span><StatusBadge status={product.status} className="max-w-[8.5rem] shrink-0" /></button>) : <div className="px-4 py-12 text-center"><p className="font-medium">{t("No products found")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Try another search term or status.")}</p></div>}
        </div>
        <div className="adaptive-records__table">
          <Table className="table-fixed">
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-[32%]">{t("Product")}</TableHead><TableHead className="priority-low">{t("Source price")}</TableHead><TableHead>{t("Selling price")}</TableHead><TableHead className="priority-medium">{t("Stock")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="priority-low">{t("Updated")}</TableHead><TableHead className="w-12"><span className="sr-only">{t("Actions")}</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((product) => (
                <TableRow key={product.id} className="cursor-pointer transition-colors duration-200" tabIndex={0} onClick={() => setSelected(product)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(product); } }}>
                  <TableCell><div className="flex items-center gap-3"><ProductAvatar accent={product.accent} /><div><p className="font-medium">{product.name}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.sku}</p></div></div></TableCell>
                  <TableCell className="priority-low whitespace-nowrap font-mono text-xs">{formatMoney(product.sourcePrice)}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs font-medium">{formatMoney(product.sellingPrice)}</TableCell><TableCell className="priority-medium font-mono text-xs">{product.stock}</TableCell><TableCell><StatusBadge status={product.status} /></TableCell><TableCell className="priority-low whitespace-nowrap text-sm text-muted-foreground">{t(product.updatedAt)}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`${t("Actions")} · ${product.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{t("Product actions")}</DropdownMenuLabel><DropdownMenuItem onClick={() => setSelected(product)}>{t("View details")}</DropdownMenuItem><DropdownMenuItem onClick={() => setNotice(t("Sync requires a connected Shopee publisher."))}>{t("Queue sync")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={7} className="h-40 text-center"><p className="font-medium">{t("No products found")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Try another search term or status.")}</p></TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selected ? <ProductDetailsDialog key={selected.id} summary={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
