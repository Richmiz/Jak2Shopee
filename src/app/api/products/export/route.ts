import { getSession } from "@/app/actions/auth";
import { exportProductsCsv } from "@/server/catalog-store.mts";

export async function GET(request: Request) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const csv = exportProductsCsv({ query: url.searchParams.get("query") ?? "", status: url.searchParams.get("status") ?? "ALL" });
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="catalogbridge-products-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
