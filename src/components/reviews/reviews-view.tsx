"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleAlert, Tags } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { ProductAvatar } from "@/components/workspace/product-avatar";
import type { Product } from "@/lib/catalog-data";

export function ReviewsView({ products }: { products: Product[] }) {
  const { t } = useLanguage();
  return <div className="space-y-6">
    <PageHeader eyebrow="Human-in-the-loop" title="Review queue" description="Resolve the extracted records that could not be completed safely." actions={<Badge variant="outline" className="h-8 border-amber-200 bg-amber-50 px-3 text-amber-800">{t("{count} items need attention", { count: products.length })}</Badge>} />
    <div className="grid gap-4">{products.length ? products.map((product) => {
      const failed = product.status === "FAILED" || product.status === "BLOCKED" || product.status === "DUPLICATE";
      const Icon = failed ? CircleAlert : Tags;
      return <Card key={product.id} className="transition-transform duration-200 hover:-translate-y-0.5"><CardContent className="grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"><ProductAvatar accent={product.accent} className="size-14" /><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold tracking-[-0.01em]">{product.name}</p><Badge variant="secondary" className="font-mono text-[11px]">{product.sku}</Badge></div><div className="mt-3 flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800"><Icon className="size-4" /></span><div><p className="text-sm font-medium">{t(failed ? "Extraction failure" : "Normalized fields need confirmation")}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t(failed ? "Inspect the recorded job evidence before deciding whether to retry." : product.category)}</p></div></div></div><div className="flex flex-wrap gap-2 md:justify-end"><Button asChild variant="outline"><Link href={product.latestJobId ? `/jobs?job=${product.latestJobId}` : "/jobs"}>{t("View evidence")}</Link></Button><Button asChild><Link href={`/products?selected=${product.id}`}>{t("Review item")}<ArrowRight className="size-4" /></Link></Button></div></CardContent></Card>;
    }) : <Card><CardContent className="grid min-h-56 place-items-center p-8 text-center"><div><BadgeCheck className="mx-auto size-8 text-emerald-600" /><p className="mt-3 font-medium">{t("Review queue is clear")}</p><p className="mt-1 text-sm text-muted-foreground">{t("New uncertain extractions will appear here.")}</p></div></CardContent></Card>}</div>
    <Card className="border-emerald-200 bg-emerald-50/50 shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-emerald-900"><BadgeCheck className="size-4" />{t("Review policy")}</CardTitle><CardDescription className="text-emerald-800/80">{t("Automation records provenance and warnings, while uncertain operational fields remain under operator control.")}</CardDescription></CardHeader></Card>
  </div>;
}
