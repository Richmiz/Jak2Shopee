"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, KeyRound, Save, ShieldCheck, Store } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/workspace/page-header";
import type { WorkspaceSettings } from "@/server/catalog-types.mts";

function SettingRow({ title, description, checked, disabled, onCheckedChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  const { t } = useLanguage();
  return <div className="flex items-center justify-between gap-6 py-4"><div className="min-w-0"><p className="text-sm font-medium">{t(title)}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t(description)}</p></div><Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={t(title)} /></div>;
}

export function SettingsView({ initialSettings }: { initialSettings: WorkspaceSettings }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);
  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json() as { settings?: WorkspaceSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error || "Settings could not be saved.");
      setSettings(payload.settings);
      setSavedSettings(payload.settings);
      setNotice({ tone: "success", text: "Settings saved and applied to new jobs." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Settings could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Workspace policy" title="Settings" description="Configure integrations, pricing, automation safety, and account behavior." actions={<Button onClick={() => void save()} disabled={!dirty || saving}>{saving ? <CircleDashed className="size-4 animate-spin" /> : <Save className="size-4" />}{t(saving ? "Saving…" : dirty ? "Save changes" : "Saved")}</Button>} />
      {notice ? <div role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" : "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"}>{notice.tone === "error" ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}{t(notice.text)}</div> : null}
      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 bg-muted/70 p-1 sm:grid-cols-4">
          <TabsTrigger value="connection">{t("Shopee connection")}</TabsTrigger><TabsTrigger value="pricing">{t("Pricing rules")}</TabsTrigger><TabsTrigger value="automation">{t("Automation")}</TabsTrigger><TabsTrigger value="security">{t("Security")}</TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Shopee Seller integration")}</CardTitle><CardDescription>{t("Connection state is explicit and never inferred from a decorative badge.")}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"><span className="grid size-11 place-items-center rounded-xl bg-orange-100 text-orange-600"><Store className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{t("Shopee Indonesia")}</p><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{t("Not connected")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{t("No API token or seller account is connected.")}</p></div></div><div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium">{t("Dry-run mode is active")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Listings can be mapped and validated, but no final Shopee submission is attempted.")}</p></div></div></div><div className="space-y-2"><Label>{t("Publisher mode")}</Label><div className="flex h-10 w-full items-center rounded-xl border border-input bg-muted/30 px-3 text-sm sm:max-w-sm">{t("Dry run")}</div></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Default pricing policy")}</CardTitle><CardDescription>{t("These values are applied when a new extraction job is queued.")}</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="default-markup">{t("Default markup (%)")}</Label><Input id="default-markup" type="number" min={0} max={500} value={settings.defaultMarkupPercent} onChange={(event) => update("defaultMarkupPercent", Number(event.currentTarget.value))} /></div><div className="space-y-2"><Label htmlFor="minimum-margin">{t("Minimum margin (%)")}</Label><Input id="minimum-margin" type="number" min={0} max={500} value={settings.minimumMarginPercent} onChange={(event) => update("minimumMarginPercent", Number(event.currentTarget.value))} /></div><div className="space-y-2"><Label htmlFor="marketplace-buffer">{t("Marketplace buffer (IDR)")}</Label><Input id="marketplace-buffer" type="number" min={0} value={settings.marketplaceBuffer} onChange={(event) => update("marketplaceBuffer", Number(event.currentTarget.value))} /></div><div className="space-y-2"><Label htmlFor="rounding-rule">{t("Rounding rule")}</Label><Select value={String(settings.roundingRule)} onValueChange={(value) => update("roundingRule", Number(value) as 0 | 500 | 1000)}><SelectTrigger id="rounding-rule" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1000">{t("Round up to Rp 1,000")}</SelectItem><SelectItem value="500">{t("Round up to Rp 500")}</SelectItem><SelectItem value="0">{t("No rounding")}</SelectItem></SelectContent></Select></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="automation">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Automation safety")}</CardTitle><CardDescription>{t("Defaults for new extraction jobs. Existing jobs retain their queued policy.")}</CardDescription></CardHeader><CardContent><SettingRow title="Automatic retry" description="Retry transient failures with bounded backoff." checked={settings.automaticRetry} onCheckedChange={(value) => update("automaticRetry", value)} /><Separator /><div className="grid gap-4 py-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="max-attempts">{t("Maximum attempts")}</Label><Select value={String(settings.maxAttempts)} disabled={!settings.automaticRetry} onValueChange={(value) => update("maxAttempts", Number(value))}><SelectTrigger id="max-attempts" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="timeout">{t("Browser timeout (seconds)")}</Label><Input id="timeout" type="number" min={15} max={180} value={settings.browserTimeoutSeconds} onChange={(event) => update("browserTimeoutSeconds", Number(event.currentTarget.value))} /></div></div><Separator /><SettingRow title="Pause on CAPTCHA or 2FA" description="Require operator action and never bypass access controls." checked={settings.pauseOnVerification} onCheckedChange={(value) => update("pauseOnVerification", value)} /><Separator /><SettingRow title="Validate product images" description="Check image availability and MIME type before saving." checked={settings.validateImagesByDefault} onCheckedChange={(value) => update("validateImagesByDefault", value)} /><Separator /><SettingRow title="Detect duplicate products" description="Compare canonical URL, source identity, and seller SKU." checked={settings.detectDuplicatesByDefault} onCheckedChange={(value) => update("detectDuplicatesByDefault", value)} /><Separator /><SettingRow title="Require review when uncertain" description="Pause instead of guessing missing operational fields." checked={settings.requireReviewByDefault} onCheckedChange={(value) => update("requireReviewByDefault", value)} /><Separator /><div className="space-y-2 pt-5"><Label htmlFor="concurrency">{t("Maximum concurrent jobs")}</Label><Select value={String(settings.maximumConcurrentJobs)} onValueChange={(value) => update("maximumConcurrentJobs", Number(value))}><SelectTrigger id="concurrency" className="w-full sm:max-w-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3].map((value) => <SelectItem key={value} value={String(value)}>{t(value === 1 ? "1 job" : `${value} jobs`)}</SelectItem>)}</SelectContent></Select><p className="text-xs leading-5 text-muted-foreground">{t("Adaptive verification is serialized so only one operator window can request attention at a time.")}</p></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{t("Account and security")}</CardTitle><CardDescription>{t("Authentication is enforced for every workspace and API route.")}</CardDescription></CardHeader><CardContent><SettingRow title="Require sign-in" description="Protect all workspace routes from unauthenticated access." checked disabled /><Separator /><div className="space-y-2 py-5"><Label htmlFor="session-timeout">{t("Session timeout")}</Label><Select value={String(settings.sessionTimeoutHours)} onValueChange={(value) => update("sessionTimeoutHours", Number(value))}><SelectTrigger id="session-timeout" className="w-full sm:max-w-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 4, 8, 12, 24, 72].map((value) => <SelectItem key={value} value={String(value)}>{t("{count} hours", { count: value })}</SelectItem>)}</SelectContent></Select></div><Separator /><div className="mt-5 flex gap-3 rounded-xl border bg-muted/35 p-4"><KeyRound className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium">{t("Secret handling")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Passwords, session cookies, access tokens, and API secrets remain in server-side environment variables.")}</p></div></div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
