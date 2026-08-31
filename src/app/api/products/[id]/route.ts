import { getSession } from "@/app/actions/auth";
import { updateProduct } from "@/server/catalog-store.mts";
import { updateProductSchema } from "@/server/catalog-types.mts";

export async function PATCH(request: Request, { params }: RouteContext<"/api/products/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid product update.", issues: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const result = updateProduct(id, parsed.data);
  return result ? Response.json(result) : Response.json({ error: "Product not found." }, { status: 404 });
}
