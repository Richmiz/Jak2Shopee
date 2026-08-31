import { getSession } from "@/app/actions/auth";
import { deleteProduct, getProductDetails, updateProduct } from "@/server/catalog-store.mts";
import { updateProductSchema } from "@/server/catalog-types.mts";

export async function GET(_request: Request, { params }: RouteContext<"/api/products/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = getProductDetails(id);
  return product ? Response.json(product) : Response.json({ error: "Product not found." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/products/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid product update.", issues: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const result = updateProduct(id, parsed.data);
  return result ? Response.json(result) : Response.json({ error: "Product not found." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/products/[id]">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return deleteProduct(id) ? new Response(null, { status: 204 }) : Response.json({ error: "Product not found." }, { status: 404 });
}
