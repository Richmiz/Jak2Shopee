import type { Metadata } from "next";
import { ProductsView } from "@/components/products/products-view";
import { listProducts } from "@/server/catalog-store.mts";

export const metadata: Metadata = { title: "Catalog" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { selected } = await searchParams;

  return (
    <ProductsView
      initialProducts={listProducts()}
      initialSelectedId={typeof selected === "string" ? selected : undefined}
    />
  );
}
