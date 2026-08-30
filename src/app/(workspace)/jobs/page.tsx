import type { Metadata } from "next";
import { JobsView } from "@/components/jobs/jobs-view";
import { jobs } from "@/lib/catalog-data";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return <JobsView initialJobs={jobs} />;
}
