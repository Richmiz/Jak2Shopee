import { getSession } from "@/app/actions/auth";
import { getWorkspaceSettings, updateWorkspaceSettings } from "@/server/catalog-store.mts";
import { workspaceSettingsSchema } from "@/server/catalog-types.mts";

export async function GET() {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(getWorkspaceSettings());
}

export async function PUT(request: Request) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = workspaceSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid settings.", issues: parsed.error.flatten() }, { status: 400 });
  return Response.json(updateWorkspaceSettings(parsed.data));
}
