import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth";
import { AppShell } from "@/components/workspace/app-shell";
import { listJobSummaries, listProducts } from "@/server/catalog-store.mts";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell userEmail={session.email} products={listProducts()} jobs={listJobSummaries()}>{children}</AppShell>;
}
