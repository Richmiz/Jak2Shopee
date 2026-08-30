import type { Metadata } from "next";
import { ProductsView } from "@/components/products/products-view";
import { products } from "@/lib/catalog-data";

export const metadata: Metadata = { title: "Catalog" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { selected } = await searchParams;

  return (
    <ProductsView
      initialProducts={products}
      initialSelectedId={typeof selected === "string" ? selected : undefined}
    />
  );
}
