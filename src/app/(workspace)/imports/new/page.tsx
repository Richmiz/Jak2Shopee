import type { Metadata } from "next";
import { ImportWorkspace } from "@/components/imports/import-workspace";

export const metadata: Metadata = { title: "New import" };

export default async function NewImportPage({ searchParams }: PageProps<"/imports/new">) {
  const { mode } = await searchParams;
  return <ImportWorkspace initialMode={mode === "batch" ? "batch" : "single"} />;
}
