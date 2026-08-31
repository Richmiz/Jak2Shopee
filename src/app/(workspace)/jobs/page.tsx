import type { Metadata } from "next";
import { JobsView } from "@/components/jobs/jobs-view";
import { listJobs } from "@/server/catalog-store.mts";

export const metadata: Metadata = { title: "Jobs" };

export const dynamic = "force-dynamic";

export default function JobsPage() {
  return <JobsView initialJobs={listJobs()} />;
}
