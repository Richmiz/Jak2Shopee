"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatStatus, type ProductStatus } from "@/lib/catalog-data";

const statusStyles: Record<ProductStatus, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROCESSING: "border-violet-200 bg-violet-50 text-violet-700",
  NEEDS_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  READY: "border-sky-200 bg-sky-50 text-sky-700",
  BLOCKED: "border-red-200 bg-red-50 text-red-700",
  DUPLICATE: "border-orange-200 bg-orange-50 text-orange-700",
};

export function StatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  const { t } = useLanguage();
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-1 font-medium", statusStyles[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(formatStatus(status))}
    </Badge>
  );
}
