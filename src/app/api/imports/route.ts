import { getSession } from "@/app/actions/auth";
import { createImport, getWorkspaceSettings, importOptionsFromSettings } from "@/server/catalog-store.mts";
import { createImportSchema } from "@/server/catalog-types.mts";

export async function POST(request: Request) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid import request.", issues: parsed.error.flatten() }, { status: 400 });
  const normalizedUrls = [...new Set(parsed.data.urls.map((value) => new URL(value).toString()))];
  const created = createImport(normalizedUrls, importOptionsFromSettings(getWorkspaceSettings(), parsed.data.options));
  return Response.json(created, { status: 202, headers: { Location: `/api/imports/${created.id}` } });
}
