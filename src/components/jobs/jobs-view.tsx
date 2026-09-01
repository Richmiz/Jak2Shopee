/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Copy, ExternalLink, Info, RefreshCcw, RotateCcw, Search } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import type { Job, JobEvent, JobsPage } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

const levelStyles: Record<JobEvent["level"], string> = {
  INFO: "bg-sky-100 text-sky-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  WARNING: "bg-amber-100 text-amber-800",
  ERROR: "bg-rose-100 text-rose-700",
};
const levelIcons = { INFO: Info, SUCCESS: CheckCircle2, WARNING: AlertTriangle, ERROR: AlertTriangle };

export function JobsView({ initialPage, initialSelectedId }: { initialPage: JobsPage; initialSelectedId?: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState(initialPage);
  const [page, setPage] = useState(initialPage.page);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? initialPage.jobs[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState<Job | null>(null);
  const selected = useMemo(() => data.jobs.find((job) => job.id === selectedId) ?? data.jobs[0], [data.jobs, selectedId]);
  const hasActiveJobs = data.jobs.some((job) => job.runStatus === "QUEUED" || job.runStatus === "RUNNING");
  const failedCount = data.jobs.filter((job) => job.runStatus === "FAILED" || job.runStatus === "CANCELLED").length;

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch(`/api/jobs?page=${page}&pageSize=${data.pageSize}&query=${encodeURIComponent(deferredQuery)}&selected=${encodeURIComponent(selectedId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The job list could not be loaded.");
      const next = await response.json() as JobsPage;
      setData(next);
      setSelectedId((current) => next.jobs.some((job) => job.id === current) ? current : next.jobs[0]?.id ?? "");
    } catch (error) {
      setNotice(t(error instanceof Error ? error.message : "The job list could not be loaded."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [data.pageSize, deferredQuery, page, selectedId, t]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void load(), 0);
    const interval = hasActiveJobs ? window.setInterval(() => void load(), 3500) : null;
    return () => {
      window.clearTimeout(initialRefresh);
      if (interval) window.clearInterval(interval);
    };
  }, [hasActiveJobs, load]);

  async function runAction(endpoint: string, success: string, body?: unknown) {
    setPendingAction(endpoint);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const payload = await response.json().catch(() => null) as { error?: string; queued?: number } | null;
      if (!response.ok) throw new Error(payload?.error || "The job action could not be completed.");
      setNotice(t(success, payload?.queued !== undefined ? { count: payload.queued } : undefined));
      await load();
    } catch (error) {
      setNotice(t(error instanceof Error ? error.message : "The job action could not be completed."));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Execution evidence" title="Processing jobs" description="Inspect attempts, stage transitions, warnings, and failure evidence without leaving the job context." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!failedCount || Boolean(pendingAction)} onClick={() => void runAction("/api/jobs", "{count} failed jobs queued for retry.", { action: "retry-failed" })}><RotateCcw className="size-4" />{t("Retry failed")}</Button><Button variant="outline" disabled={loading} onClick={() => void load(true)}>{loading ? <CircleDashed className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}{t("Refresh")}</Button></div>} />
      {notice ? <div role="status" className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">{notice}</div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <Card className="min-w-0">
          <CardHeader><CardTitle>{t("Job queue")}</CardTitle><CardDescription>{t("{count} recorded jobs", { count: data.total })}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1); }} placeholder={t("Search job ID, product, or source")} /></div>
            <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] xl:max-h-[calc(100dvh-18rem)]">
              {data.jobs.map((job) => <Button key={job.id} type="button" variant="outline" onClick={() => setSelectedId(job.id)} className={cn("h-auto w-full justify-start whitespace-normal rounded-xl p-3 text-left", selected?.id === job.id ? "border-primary bg-primary/[0.05] shadow-sm hover:bg-primary/[0.07]" : "hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-sm")}><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-semibold">{job.id}</span><StatusBadge status={job.status} /></span><span className="mt-3 block truncate text-sm font-medium" title={job.productName}>{job.productName}</span><span className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{t(job.stage)}</span><span className="shrink-0">{job.startedAt}</span></span></span></Button>)}
              {!data.jobs.length ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">{t("No processing jobs found")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Try a different search or queue a JakMall import.")}</p></div> : null}
            </div>
            {data.totalPages > 1 ? <div className="flex items-center justify-between border-t pt-3"><Button size="sm" variant="ghost" disabled={data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" />{t("Previous")}</Button><span className="text-xs text-muted-foreground">{t("Page {page} of {total}", { page: data.page, total: data.totalPages })}</span><Button size="sm" variant="ghost" disabled={data.page >= data.totalPages} onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))}>{t("Next")}<ChevronRight className="size-4" /></Button></div> : null}
          </CardContent>
        </Card>

        {selected ? <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CardTitle className="break-words">{selected.productName}</CardTitle><StatusBadge status={selected.status} /></div><CardDescription className="mt-2 font-mono">{selected.id}</CardDescription></div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(selected.id); setNotice(t("Job ID copied.")); }}><Copy className="size-4" />{t("Copy ID")}</Button>{selected.productId ? <Button asChild variant="outline" size="sm"><Link href={`/products?selected=${selected.productId}`}>{t("Open product")}<ExternalLink className="size-4" /></Link></Button> : null}{["QUEUED", "RUNNING"].includes(selected.runStatus) ? <Button variant="destructive" size="sm" onClick={() => setCancelCandidate(selected)}><Ban className="size-4" />{t("Cancel job")}</Button> : null}</div></div></CardHeader>
            <CardContent><dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">{[["Current stage", selected.stage], ["Attempts", `${selected.attempts} / ${selected.maxAttempts}`], ["Duration", selected.duration], ["Started", selected.startedAt]].map(([label, value]) => <div key={label} className="rounded-xl border bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">{t(label)}</dt><dd className="mt-1 break-words font-mono text-sm font-medium">{t(value)}</dd></div>)}</dl><a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex max-w-full items-center gap-2 text-sm font-medium text-primary hover:underline"><span className="truncate">{t("Open JakMall source")}</span><ExternalLink className="size-3.5 shrink-0" /></a></CardContent>
          </Card>

          {selected.errorCode === "DUPLICATE_PRODUCT" ? <Card className="border-orange-200 shadow-none"><CardHeader><CardTitle className="text-orange-900">{t("Duplicate product found")}</CardTitle><CardDescription>{t(selected.productId ? "Use the existing catalog record to resolve this job without creating another product." : "The earlier duplicate record is no longer in the catalog. Retry extraction to create a fresh record.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{selected.productId ? <><Button asChild variant="outline"><Link href={`/products?selected=${selected.productId}`}>{t("Review existing product")}</Link></Button><Button disabled={Boolean(pendingAction)} onClick={() => void runAction(`/api/jobs/${encodeURIComponent(selected.id)}/resolve-duplicate`, "Duplicate resolved with the existing product.")}>{t("Use existing product")}</Button></> : <Button disabled={Boolean(pendingAction)} onClick={() => void runAction(`/api/jobs/${encodeURIComponent(selected.id)}/retry`, "Retry queued.")}><RefreshCcw className="size-4" />{t("Retry extraction")}</Button>}</CardContent></Card> : null}

          <Card>
            <CardHeader><CardTitle>{t("Event timeline")}</CardTitle><CardDescription>{t("Recorded stage transitions for this job")}</CardDescription></CardHeader>
            <CardContent className="space-y-0">{selected.events.map((event, index) => { const Icon = levelIcons[event.level]; return <div key={`${event.time}-${event.message}-${index}`} className="grid grid-cols-[minmax(3rem,4.75rem)_1.75rem_minmax(0,1fr)] gap-3"><span className="pt-1.5 font-mono text-[11px] text-muted-foreground">{event.time}</span><div className="relative flex justify-center"><span className={cn("z-10 grid size-7 place-items-center rounded-full", levelStyles[event.level])}><Icon className="size-3.5" /></span>{index < selected.events.length - 1 ? <span className="absolute bottom-0 top-7 w-px bg-border" /> : null}</div><div className="min-w-0 pb-6"><Badge variant="outline" className="mb-2 font-mono text-[10px]">{t(event.level)}</Badge><p className="break-words text-sm leading-6">{t(event.message)}</p></div></div>; })}</CardContent>
          </Card>

          {selected.runStatus === "FAILED" || selected.runStatus === "CANCELLED" ? <Card className="border-rose-200 shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-rose-800"><Camera className="size-4" />{t("Failure evidence")}</CardTitle><CardDescription>{t("Evidence from the final failed attempt")}</CardDescription></CardHeader><CardContent>{selected.evidencePath ? <a href={`/api/jobs/${encodeURIComponent(selected.id)}/evidence`} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-rose-200 bg-rose-50"><img src={`/api/jobs/${encodeURIComponent(selected.id)}/evidence`} alt={t("Failure screenshot for {id}", { id: selected.id })} className="max-h-[32rem] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]" /></a> : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-center"><div><AlertTriangle className="mx-auto size-6 text-rose-600" /><p className="mt-2 text-sm font-medium text-rose-900">{t(selected.errorMessage || (selected.runStatus === "CANCELLED" ? "Job cancelled" : "Extraction failed"))}</p><p className="mt-1 text-xs text-rose-800/70">{t("No screenshot was available for this attempt.")}</p></div></div>}<div className="mt-4 flex flex-wrap gap-2"><Button disabled={Boolean(pendingAction)} onClick={() => void runAction(`/api/jobs/${encodeURIComponent(selected.id)}/retry`, "Retry queued.")}><RefreshCcw className="size-4" />{t("Retry job")}</Button></div></CardContent></Card> : null}

          {selected.runStatus === "RUNNING" || selected.runStatus === "QUEUED" ? <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"><CircleDashed className="size-4 animate-spin" />{t(selected.runStatus === "RUNNING" ? "Processing is in progress. Status updates automatically." : "This job is queued. Status updates automatically.")}</div> : null}
        </div> : null}
      </div>

      <AlertDialog open={Boolean(cancelCandidate)} onOpenChange={(open) => { if (!open) setCancelCandidate(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("Cancel this job?")}</AlertDialogTitle><AlertDialogDescription>{t("Queued work stops immediately. Running extraction stops at the next safe stage boundary and keeps its recorded evidence.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("Keep running")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (!cancelCandidate) return; const candidate = cancelCandidate; setCancelCandidate(null); void runAction(`/api/jobs/${encodeURIComponent(candidate.id)}/cancel`, "Cancellation requested."); }}><Ban className="size-4" />{t("Cancel job")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
