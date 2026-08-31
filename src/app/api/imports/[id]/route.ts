import { getSession } from "@/app/actions/auth";
import { getImport } from "@/server/catalog-store.mts";

export async function GET(_request: Request, { params }: RouteContext<"/api/imports/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const record = getImport(id);
  return record ? Response.json(record) : Response.json({ error: "Import not found." }, { status: 404 });
}
