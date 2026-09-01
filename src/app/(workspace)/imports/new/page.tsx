import type { Metadata } from "next";
import { ImportWorkspace } from "@/components/imports/import-workspace";
import { getWorkspaceSettings } from "@/server/catalog-store.mts";

export const metadata: Metadata = { title: "New import" };

export default async function NewImportPage({ searchParams }: PageProps<"/imports/new">) {
  const { mode } = await searchParams;
  const settings = getWorkspaceSettings();
  return <ImportWorkspace initialMode={mode === "batch" ? "batch" : "single"} initialDefaults={{ markupPercent: settings.defaultMarkupPercent, validateImages: settings.validateImagesByDefault, detectDuplicates: settings.detectDuplicatesByDefault, requireReview: settings.requireReviewByDefault }} />;
}
