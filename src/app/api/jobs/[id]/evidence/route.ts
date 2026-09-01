import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/app/actions/auth";
import { getJobEvidencePath } from "@/server/catalog-store.mts";

export async function GET(_request: Request, { params }: RouteContext<"/api/jobs/[id]/evidence">) {
  if (!await getSession()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const evidencePath = getJobEvidencePath(id);
  if (!evidencePath) return Response.json({ error: "Evidence not found." }, { status: 404 });
  const evidenceRoot = path.resolve(/* turbopackIgnore: true */ process.env.CATALOGBRIDGE_EVIDENCE_PATH || path.join(process.cwd(), "data", "evidence"));
  const resolved = path.resolve(evidencePath);
  const withinRoot = resolved.toLowerCase().startsWith(`${evidenceRoot.toLowerCase()}${path.sep}`);
  if (!withinRoot || path.extname(resolved).toLowerCase() !== ".png") return Response.json({ error: "Evidence path rejected." }, { status: 403 });
  try {
    return new Response(await readFile(resolved), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${id}-evidence.png"` } });
  } catch {
    return Response.json({ error: "Evidence file is unavailable." }, { status: 404 });
  }
}
