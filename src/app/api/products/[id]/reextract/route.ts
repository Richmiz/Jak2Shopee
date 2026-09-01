import { getSession } from "@/app/actions/auth";
import { createReextraction } from "@/server/catalog-store.mts";

export async function POST(_request: Request, { params }: RouteContext<"/api/products/[id]/reextract">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const created = createReextraction(id);
  return created ? Response.json(created, { status: 202, headers: { Location: `/jobs?job=${created.jobId}` } }) : Response.json({ error: "Product not found." }, { status: 404 });
}
