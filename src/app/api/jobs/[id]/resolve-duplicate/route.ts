import { getSession } from "@/app/actions/auth";
import { resolveDuplicateJob } from "@/server/catalog-store.mts";

export async function POST(_request: Request, { params }: RouteContext<"/api/jobs/[id]/resolve-duplicate">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return resolveDuplicateJob(id) ? Response.json({ id, status: "SUCCEEDED" }) : Response.json({ error: "This job is not an unresolved duplicate." }, { status: 409 });
}
