import { getSession } from "@/app/actions/auth";
import { requestJobCancellation } from "@/server/catalog-store.mts";

export async function POST(_request: Request, { params }: RouteContext<"/api/jobs/[id]/cancel">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return requestJobCancellation(id) ? Response.json({ id, status: "CANCELLATION_REQUESTED" }, { status: 202 }) : Response.json({ error: "Only queued or running jobs can be cancelled." }, { status: 409 });
}
