import { getSession } from "@/app/actions/auth";
import { retryJob } from "@/server/catalog-store.mts";

export async function POST(_request: Request, { params }: RouteContext<"/api/jobs/[id]/retry">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return retryJob(id) ? Response.json({ id, status: "QUEUED" }, { status: 202 }) : Response.json({ error: "Only failed jobs can be retried." }, { status: 409 });
}
