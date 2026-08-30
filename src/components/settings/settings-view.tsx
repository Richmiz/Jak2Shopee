"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Save, ShieldCheck, Store } from "lucide-react";
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

function SettingRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const { t } = useLanguage();
  return <div className="flex items-center justify-between gap-6 py-4"><div><p className="text-sm font-medium">{t(title)}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t(description)}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={t(title)} /></div>;
}

export function SettingsView() {
  const { t } = useLanguage();
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(true);
  const [pauseVerification, setPauseVerification] = useState(true);
  const [temporaryImages, setTemporaryImages] = useState(true);
  const [requireSignIn, setRequireSignIn] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Workspace policy" title="Settings" description="Configure integrations, pricing, automation safety, and account behavior." actions={<Button onClick={() => setNotice(t("Settings saved."))}><Save className="size-4" />{t("Save changes")}</Button>} />
      {notice ? <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="size-4" />{notice}</div> : null}
      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 bg-muted/70 p-1 sm:grid-cols-4">
          <TabsTrigger value="connection">{t("Shopee connection")}</TabsTrigger><TabsTrigger value="pricing">{t("Pricing rules")}</TabsTrigger><TabsTrigger value="automation">{t("Automation")}</TabsTrigger><TabsTrigger value="security">{t("Security")}</TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Shopee Seller integration")}</CardTitle><CardDescription>{t("Connection state is explicit and never inferred from a decorative badge.")}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"><span className="grid size-11 place-items-center rounded-lg bg-orange-100 text-orange-600"><Store className="size-5" /></span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{t("Shopee Indonesia")}</p><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{t("Manual authentication required")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{t("No API token or browser session is connected.")}</p></div><Button variant="outline" onClick={() => setNotice(t("Connection test unavailable: publisher credentials are not configured."))}>{t("Test connection")}</Button></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 text-amber-700" /><div><p className="text-sm font-medium text-amber-900">{t("Dry-run mode is active")}</p><p className="mt-1 text-sm leading-6 text-amber-900/80">{t("Listings can be mapped and validated, but no final Shopee submission is attempted.")}</p></div></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="publisher-mode">{t("Publisher mode")}</Label><Select defaultValue="dry-run"><SelectTrigger id="publisher-mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dry-run">{t("Dry run")}</SelectItem><SelectItem value="browser">{t("Browser automation")}</SelectItem><SelectItem value="api">{t("Official API")}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="seller-id">{t("Seller account")}</Label><Input id="seller-id" placeholder={t("Not connected")} disabled /></div></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Default pricing policy")}</CardTitle><CardDescription>{t("Operators can override these values during product review.")}</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="default-markup">{t("Default markup (%)")}</Label><Input id="default-markup" type="number" defaultValue="20" /></div><div className="space-y-2"><Label htmlFor="minimum-margin">{t("Minimum margin (%)")}</Label><Input id="minimum-margin" type="number" defaultValue="10" /></div><div className="space-y-2"><Label htmlFor="marketplace-buffer">{t("Marketplace buffer (IDR)")}</Label><Input id="marketplace-buffer" type="number" defaultValue="5000" /></div><div className="space-y-2"><Label htmlFor="rounding-rule">{t("Rounding rule")}</Label><Select defaultValue="1000"><SelectTrigger id="rounding-rule" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1000">{t("Nearest Rp 1,000")}</SelectItem><SelectItem value="500">{t("Nearest Rp 500")}</SelectItem><SelectItem value="none">{t("No rounding")}</SelectItem></SelectContent></Select></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="automation">
          <Card className="shadow-none"><CardHeader><CardTitle>{t("Automation safety")}</CardTitle><CardDescription>{t("Bounded behaviors that keep failures visible and recoverable.")}</CardDescription></CardHeader><CardContent><SettingRow title="Automatic retry" description="Retry transient failures up to three times with backoff." checked={retry} onCheckedChange={setRetry} /><Separator /><SettingRow title="Pause on CAPTCHA or 2FA" description="Require operator action and never bypass access controls." checked={pauseVerification} onCheckedChange={setPauseVerification} /><Separator /><SettingRow title="Temporary image processing" description="Download, validate, upload, and remove temporary files after the job." checked={temporaryImages} onCheckedChange={setTemporaryImages} /><Separator /><div className="grid gap-4 pt-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="concurrency">{t("Maximum concurrent jobs")}</Label><Select defaultValue="2"><SelectTrigger id="concurrency" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">{t("1 job")}</SelectItem><SelectItem value="2">{t("2 jobs")}</SelectItem><SelectItem value="3">{t("3 jobs")}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="timeout">{t("Browser timeout (seconds)")}</Label><Input id="timeout" type="number" defaultValue="30" /></div></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{t("Account and security")}</CardTitle><CardDescription>{t("Minimal controls for an internal single-operator proof of concept.")}</CardDescription></CardHeader><CardContent><SettingRow title="Require sign-in" description="Protect all workspace routes from unauthenticated access." checked={requireSignIn} onCheckedChange={setRequireSignIn} /><Separator /><SettingRow title="Session timeout" description="Expire inactive sessions after the configured period." checked={sessionTimeout} onCheckedChange={setSessionTimeout} /><Separator /><div className="mt-5 flex gap-3 rounded-lg border bg-muted/35 p-4"><KeyRound className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium">{t("Secret handling")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Passwords, session cookies, access tokens, and API secrets belong in server-side environment variables and must never appear in this UI or repository.")}</p></div></div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
