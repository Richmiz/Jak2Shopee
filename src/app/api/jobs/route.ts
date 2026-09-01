import { getSession } from "@/app/actions/auth";
import { listJobsPage, retryFailedJobs } from "@/server/catalog-store.mts";

export async function GET(request: Request) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  return Response.json(listJobsPage({ page: Number(url.searchParams.get("page") || 1), pageSize: Number(url.searchParams.get("pageSize") || 20), query: url.searchParams.get("query") ?? "", eventJobId: url.searchParams.get("selected") ?? undefined }));
}

export async function POST(request: Request) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: string; jobIds?: unknown };
  if (body.action !== "retry-failed") return Response.json({ error: "Unsupported job action." }, { status: 400 });
  const jobIds = Array.isArray(body.jobIds) ? body.jobIds.filter((value): value is string => typeof value === "string").slice(0, 100) : undefined;
  const queued = retryFailedJobs(jobIds);
  return Response.json({ queued }, { status: queued ? 202 : 409 });
}
