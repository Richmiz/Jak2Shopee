import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getWorkspaceSettings } from "@/server/catalog-store.mts";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsView initialSettings={getWorkspaceSettings()} />;
}
