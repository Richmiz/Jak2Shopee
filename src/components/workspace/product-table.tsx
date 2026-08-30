"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, type Product } from "@/lib/catalog-data";
import { ProductAvatar } from "@/components/workspace/product-avatar";
import { StatusBadge } from "@/components/workspace/status-badge";

export function ProductTable({ items }: { items: Product[] }) {
  const { t } = useLanguage();
  return (
    <div className="adaptive-records">
      <div className="adaptive-records__compact divide-y">
        {items.map((product) => (
          <Link key={product.id} href={`/products?selected=${product.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/45">
            <ProductAvatar accent={product.accent} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{product.sku} · {formatMoney(product.sellingPrice)}</span></span>
            <StatusBadge status={product.status} className="max-w-[8.5rem] shrink-0" />
          </Link>
        ))}
      </div>
      <div className="adaptive-records__table">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[44%]">{t("Product")}</TableHead>
            <TableHead className="priority-low">{t("Source price")}</TableHead>
            <TableHead>{t("Selling price")}</TableHead>
            <TableHead>{t("Status")}</TableHead>
            <TableHead className="priority-medium">{t("Updated")}</TableHead>
            <TableHead className="w-12"><span className="sr-only">{t("Actions")}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <ProductAvatar accent={product.accent} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{product.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="priority-low whitespace-nowrap font-mono text-xs">{formatMoney(product.sourcePrice)}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs font-medium">{formatMoney(product.sellingPrice)}</TableCell>
              <TableCell><StatusBadge status={product.status} /></TableCell>
              <TableCell className="priority-medium whitespace-nowrap text-sm text-muted-foreground">{t(product.updatedAt)}</TableCell>
              <TableCell>
                <Button asChild size="icon-sm" variant="ghost">
                  <Link href={`/products?selected=${product.id}`} aria-label={t("Open {name}", { name: product.name })}>
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
