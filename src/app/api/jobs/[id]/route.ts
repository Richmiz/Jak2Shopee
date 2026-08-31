import { getSession } from "@/app/actions/auth";
import { getJob } from "@/server/catalog-store.mts";

export async function GET(_request: Request, { params }: RouteContext<"/api/jobs/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const record = getJob(id);
  return record ? Response.json(record) : Response.json({ error: "Job not found." }, { status: 404 });
}
