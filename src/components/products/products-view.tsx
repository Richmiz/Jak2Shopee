"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Download, MoreHorizontal, Plus, Search } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/workspace/page-header";
import { ProductAvatar } from "@/components/workspace/product-avatar";
import { StatusBadge } from "@/components/workspace/status-badge";
import { formatMoney, formatStatus, type Product, type ProductStatus } from "@/lib/catalog-data";

const statuses: Array<"ALL" | ProductStatus> = ["ALL", "PUBLISHED", "READY", "PROCESSING", "NEEDS_REVIEW", "FAILED", "DRAFT"];

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

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl">
          {selected ? <><DialogHeader><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{t("Normalized product record · {sku}", { sku: selected.sku })}</DialogDescription></DialogHeader><div className="grid gap-5 sm:grid-cols-[180px_1fr]"><ProductAvatar accent={selected.accent} className="size-full min-h-44 rounded-xl" /><div className="space-y-4"><StatusBadge status={selected.status} /><dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("Source price")}</dt><dd className="mt-1 font-mono font-medium">{formatMoney(selected.sourcePrice)}</dd></div><div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("Selling price")}</dt><dd className="mt-1 font-mono font-medium">{formatMoney(selected.sellingPrice)}</dd></div><div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("Stock")}</dt><dd className="mt-1 font-mono font-medium">{selected.stock}</dd></div><div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("Weight")}</dt><dd className="mt-1 font-mono font-medium">{selected.weightGrams} g</dd></div></dl><p className="text-sm leading-6 text-muted-foreground">{t(selected.category)}</p></div></div></> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
