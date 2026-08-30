import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth";
import { AppShell } from "@/components/workspace/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell userEmail={session.email}>{children}</AppShell>;
}
