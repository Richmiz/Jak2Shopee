import type { Metadata } from "next";
import { JobsView } from "@/components/jobs/jobs-view";
import { listJobsPage, pageForJob } from "@/server/catalog-store.mts";

export const metadata: Metadata = { title: "Jobs" };

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const { job, page, query } = await searchParams;
  const selectedJob = typeof job === "string" ? job : undefined;
  const requestedPage = typeof page === "string" ? Number(page) : selectedJob ? pageForJob(selectedJob) : 1;
  const initialPage = listJobsPage({ page: requestedPage, query: typeof query === "string" ? query : "", eventJobId: selectedJob });
  return <JobsView initialPage={initialPage} initialSelectedId={selectedJob} />;
}
