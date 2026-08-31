"use client";

import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, FileWarning, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/workspace/page-header";
import { ProductTable } from "@/components/workspace/product-table";
import type { Job, Product } from "@/lib/catalog-data";

const metricDefinitions = [
  { label: "Ready", statuses: ["READY", "PUBLISHED"], icon: CheckCircle2, detail: "Review complete", tone: "primary" },
  { label: "Processing", statuses: ["PROCESSING"], icon: Clock3, detail: "Queued or active", tone: "default" },
  { label: "Needs review", statuses: ["NEEDS_REVIEW"], icon: FileWarning, detail: "Operator action", tone: "default" },
  { label: "Failed", statuses: ["FAILED", "DUPLICATE", "BLOCKED"], icon: XCircle, detail: "Evidence available", tone: "default" },
] as const;

export function DashboardView({ products, jobs, workerOnline }: { products: Product[]; jobs: Job[]; workerOnline: boolean }) {
  const { t } = useLanguage();
  const reviewCount = products.filter((product) => product.status === "NEEDS_REVIEW").length;
  const readyCount = products.filter((product) => product.status === "READY").length;
  const automatedRate = products.length ? Math.round((readyCount / products.length) * 100) : 0;
  return <div className="dashboard-responsive-region space-y-5">
    <PageHeader title="Dashboard" description="Monitor local JakMall extraction, resolve exceptions, and prepare normalized products for marketplace mapping." actions={<><Button asChild variant="outline"><Link href="/imports/new?mode=batch">{t("Batch import")}</Link></Button><Button asChild><Link href="/imports/new"><Plus className="size-4" />{t("Import product")}</Link></Button></>} />

    <section className="metric-grid" aria-label={t("Operational metrics")}>{metricDefinitions.map(({ label, statuses, icon: Icon, detail, tone }) => {
      const source = label === "Processing" || label === "Failed" ? jobs : products;
      const value = source.filter((item) => (statuses as readonly string[]).includes(item.status)).length;
      return <Card key={label} className={tone === "primary" ? "border-primary bg-primary text-primary-foreground !shadow-lg !shadow-primary/20" : undefined}><CardContent className="flex min-h-[145px] flex-col p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">{t(label)}</p><span className={tone === "primary" ? "grid size-8 place-items-center rounded-full bg-white/15" : "grid size-8 place-items-center rounded-full bg-muted"}><Icon className="size-4" /></span></div><p className="mt-5 font-mono text-4xl font-black tracking-[-0.05em]">{value}</p><p className={tone === "primary" ? "mt-auto text-xs text-primary-foreground/70" : "mt-auto text-xs text-muted-foreground"}>{t(detail)}</p></CardContent></Card>;
    })}</section>

    <div className="dashboard-main-grid">
      <Card className="min-w-0"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>{t("Recent product jobs")}</CardTitle><CardDescription>{t("Latest normalized JakMall records")}</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/jobs">{t("View all")}<ArrowRight className="size-4" /></Link></Button></CardHeader><CardContent className="px-0">{products.length ? <ProductTable items={products.slice(0, 8)} /> : <div className="grid min-h-52 place-items-center border-t p-8 text-center"><div><p className="font-medium">{t("No products imported yet")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Queue a JakMall URL to create the first normalized record.")}</p><Button asChild size="sm" className="mt-4"><Link href="/imports/new">{t("Import product")}</Link></Button></div></div>}</CardContent></Card>
      <div className="min-w-0 grid content-start gap-4">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className={workerOnline ? "size-4 text-emerald-600" : "size-4 text-amber-600"} />{t("Automation health")}</CardTitle><CardDescription>{t("Current local Stage 1 services")}</CardDescription></CardHeader><CardContent className="space-y-4">{[["Local extraction worker", workerOnline ? "Operational" : "Offline", workerOnline ? "Heartbeat current" : "Run npm run worker"], ["SQLite catalog", "Operational", "WAL persistence"], ["Shopee publisher", "Not connected", "Later stage"]].map(([service, state, evidence]) => <div key={service} className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0"><span className={state === "Operational" ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-amber-500"} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{t(service)}</p><p className="text-xs text-muted-foreground">{t(state)}</p></div><span className="max-w-28 text-right font-mono text-[10px] text-muted-foreground">{t(evidence)}</span></div>)}</CardContent></Card>
        <Card className="border-0 bg-[radial-gradient(circle_at_92%_4%,oklch(0.62_0.23_286),transparent_40%),linear-gradient(145deg,#1b1730,#0b0a13)] text-white !shadow-xl !shadow-slate-950/15"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-violet-300" />{t("Reliability snapshot")}</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex justify-between text-sm"><span>{t("Review-ready records")}</span><span className="font-mono">{automatedRate}%</span></div><Progress value={automatedRate} className="bg-white/15" /></div><div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3"><p className="font-mono text-xl font-semibold">0</p><p className="mt-1 text-xs text-white/55">{t("Unbounded retries")}</p></div><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3"><p className="font-mono text-xl font-semibold">{reviewCount}</p><p className="mt-1 text-xs text-white/55">{t("Needs review")}</p></div></div></CardContent></Card>
        <Button asChild variant="outline" className="h-auto w-full min-w-0 justify-between p-4"><Link href="/imports/new"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Plus className="size-4" /></span><span className="text-left"><span className="block font-medium">{t("Start a local import")}</span><span className="block text-xs font-normal text-muted-foreground">{t("Extract, validate, review")}</span></span></span><ArrowRight className="size-4" /></Link></Button>
      </div>
    </div>
  </div>;
}
