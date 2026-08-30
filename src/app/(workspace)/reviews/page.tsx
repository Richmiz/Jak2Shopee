"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleAlert, Scale, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { ProductAvatar } from "@/components/workspace/product-avatar";
import { products } from "@/lib/catalog-data";

const reviews = [
  { productId: "prd_led042", reason: "Destination category", detail: "Top mapping confidence is 76%. Confirm the Shopee category before dry run.", icon: Tags, confidence: "76% confidence" },
  { productId: "prd_spkmini", reason: "Shipping weight", detail: "Source weight is present, but packaging allowance needs an operator decision.", icon: Scale, confidence: "Manual policy" },
  { productId: "prd_keyk8", reason: "Failed image upload", detail: "Three bounded attempts timed out. Inspect the job evidence before retrying.", icon: CircleAlert, confidence: "3 attempts" },
];

export default function ReviewsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Human-in-the-loop" title="Review queue" description="Resolve only the fields and failures the automation could not handle safely." actions={<Badge variant="outline" className="h-8 border-amber-200 bg-amber-50 px-3 text-amber-800">{t("3 items need attention")}</Badge>} />
      <div className="grid gap-4">
        {reviews.map((review) => {
          const product = products.find((item) => item.id === review.productId);
          if (!product) return null;
          const Icon = review.icon;
          return (
            <Card key={review.productId} className="transition-transform duration-200 hover:-translate-y-0.5">
              <CardContent className="grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                <ProductAvatar accent={product.accent} className="size-14" />
                <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold tracking-[-0.01em]">{product.name}</p><Badge variant="secondary" className="font-mono text-[11px]">{product.sku}</Badge></div><div className="mt-3 flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800"><Icon className="size-4" /></span><div><p className="text-sm font-medium">{t(review.reason)}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t(review.detail)}</p><p className="mt-2 font-mono text-[11px] text-muted-foreground">{t(review.confidence)}</p></div></div></div>
                <div className="flex flex-wrap gap-2 md:justify-end"><Button variant="outline">{t("Later")}</Button><Button asChild><Link href="/imports/new">{t("Review item")}<ArrowRight className="size-4" /></Link></Button></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="border-emerald-200 bg-emerald-50/50 shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-emerald-900"><BadgeCheck className="size-4" />{t("Review policy")}</CardTitle><CardDescription className="text-emerald-800/80">{t("Auto-mapped fields stay visible with provenance, but only blocking uncertainties enter this queue.")}</CardDescription></CardHeader></Card>
    </div>
  );
}
