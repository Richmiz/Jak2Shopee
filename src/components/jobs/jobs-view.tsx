"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, CircleDashed, Copy, Info, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import type { Job, JobEvent } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

const levelStyles: Record<JobEvent["level"], string> = {
  INFO: "bg-sky-100 text-sky-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  WARNING: "bg-amber-100 text-amber-800",
  ERROR: "bg-rose-100 text-rose-700",
};

const levelIcons = { INFO: Info, SUCCESS: CheckCircle2, WARNING: AlertTriangle, ERROR: AlertTriangle };

export function JobsView({ initialJobs }: { initialJobs: Job[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialJobs[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const selected = initialJobs.find((job) => job.id === selectedId) ?? initialJobs[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Execution evidence" title="Processing jobs" description="Inspect attempts, stage transitions, warnings, and failure evidence without leaving the job context." actions={<Button variant="outline" onClick={() => { router.refresh(); setNotice(t("Job list refreshed.")); }}><RefreshCcw className="size-4" />{t("Refresh")}</Button>} />
      {notice ? <div role="status" className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">{notice}</div> : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] items-start gap-4">
        <Card>
          <CardHeader><CardTitle>{t("Job queue")}</CardTitle><CardDescription>{t("Select a run to inspect its evidence.")}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {initialJobs.map((job) => (
              <Button key={job.id} type="button" variant="outline" onClick={() => setSelectedId(job.id)} className={cn("h-auto w-full justify-start whitespace-normal rounded-xl p-3 text-left", selectedId === job.id ? "border-primary bg-primary/[0.05] shadow-sm hover:bg-primary/[0.07]" : "hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-sm")}>
                <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-semibold">{job.id}</span><StatusBadge status={job.status} /></div>
                <p className="mt-3 truncate text-sm font-medium">{job.productName}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{t(job.stage)}</span><span>{t(job.startedAt).replace(t("Today, "), "")}</span></div>
              </Button>
            ))}
            {!initialJobs.length ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">{t("No processing jobs yet")}</p><p className="mt-1 text-sm text-muted-foreground">{t("Queued imports and their evidence will appear here.")}</p></div> : null}
          </CardContent>
        </Card>

        {selected ? <div className="grid content-start gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{selected.productName}</CardTitle><StatusBadge status={selected.status} /></div><CardDescription className="mt-2 font-mono">{selected.id}</CardDescription></div><Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(selected.id); setNotice(t("Job ID copied.")); }}><Copy className="size-4" />{t("Copy ID")}</Button></CardHeader>
            <CardContent><dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">{[["Current stage", selected.stage], ["Attempts", `${selected.attempts} / 3`], ["Duration", selected.duration], ["Started", selected.startedAt]].map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">{t(label)}</dt><dd className="mt-1 font-mono text-sm font-medium">{t(value)}</dd></div>)}</dl></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("Event timeline")}</CardTitle><CardDescription>{t("Recorded stage transitions for this job")}</CardDescription></CardHeader>
            <CardContent className="space-y-0">
              {selected.events.map((event, index) => {
                const Icon = levelIcons[event.level];
                return <div key={`${event.time}-${event.message}`} className="grid grid-cols-[minmax(3rem,4.75rem)_1.75rem_minmax(0,1fr)] gap-3"><span className="pt-1.5 font-mono text-[11px] text-muted-foreground">{event.time}</span><div className="relative flex justify-center"><span className={cn("z-10 grid size-7 place-items-center rounded-full", levelStyles[event.level])}><Icon className="size-3.5" /></span>{index < selected.events.length - 1 ? <span className="absolute bottom-0 top-7 w-px bg-border" /> : null}</div><div className="min-w-0 pb-6"><Badge variant="outline" className="mb-2 font-mono text-[10px]">{t(event.level)}</Badge><p className="break-words text-sm leading-6">{t(event.message)}</p></div></div>;
              })}
            </CardContent>
          </Card>

          {selected.status === "FAILED" ? <Card className="border-rose-200 shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-rose-800"><Camera className="size-4" />{t("Failure evidence")}</CardTitle><CardDescription>{t("Evidence from the final failed attempt")}</CardDescription></CardHeader><CardContent><div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-rose-200 bg-rose-50/60 p-4 text-center"><div><AlertTriangle className="mx-auto size-6 text-rose-600" /><p className="mt-2 text-sm font-medium text-rose-900">{t(selected.errorMessage || "Extraction failed")}</p><p className="mt-1 text-xs text-rose-800/70">{t(selected.evidencePath ? "A local screenshot was recorded with this attempt." : "No screenshot was available for this attempt.")}</p></div></div><Button className="mt-4" onClick={async () => { const response = await fetch(`/api/jobs/${encodeURIComponent(selected.id)}/retry`, { method: "POST" }); setNotice(t(response.ok ? "Retry queued." : "The retry could not be queued.")); if (response.ok) router.refresh(); }}><RefreshCcw className="size-4" />{t("Retry failed stage")}</Button></CardContent></Card> : null}

          {selected.status === "PROCESSING" ? <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900"><CircleDashed className="size-4 animate-spin" />{t("Processing is in progress.")}</div> : null}
        </div> : null}
      </div>
    </div>
  );
}
