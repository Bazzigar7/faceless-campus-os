import { and, desc, eq } from "drizzle-orm";
import { creatorProjects } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type CreatorFormat = "on_camera" | "faceless" | "voiceover" | "hands_only" | "screen_recording";
const formats: CreatorFormat[] = ["on_camera", "faceless", "voiceover", "hands_only", "screen_recording"];

function clean(value: unknown, max: number) { return String(value || "").trim().slice(0, max); }
function cleanShots(value: unknown) {
  if (!Array.isArray(value)) return ["", "", "", "", ""];
  return Array.from({ length: 5 }, (_, index) => clean(value[index], 240));
}
function parseShots(value: string) {
  try { return cleanShots(JSON.parse(value)); } catch { return ["", "", "", "", ""]; }
}

async function state(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const rows = await db.select().from(creatorProjects).where(eq(creatorProjects.userId, student.id)).orderBy(desc(creatorProjects.updatedAt));
  return { projects: rows.map((row) => ({ ...row, shots: parseShots(row.shots) })) };
}

export async function GET(request: Request) {
  try { return Response.json(await state(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const id = clean(body.id, 80);
    const title = clean(body.title, 100); const platform = clean(body.platform, 40) || "Instagram Reels"; const objective = clean(body.objective, 500);
    const format = clean(body.format, 30) as CreatorFormat; const hook = clean(body.hook, 300); const caption = clean(body.caption, 1_000); const shots = cleanShots(body.shots);
    if (!title || !objective) return Response.json({ error: "Add a project title and the content objective" }, { status: 400 });
    if (!formats.includes(format)) return Response.json({ error: "Choose a valid content format" }, { status: 400 });
    const ready = body.action === "mark_ready";
    if (ready && (!hook || !caption || shots.some((shot) => !shot))) return Response.json({ error: "Complete the hook, all five shots and the caption before marking this ready" }, { status: 400 });
    const now = new Date().toISOString();
    if (id) {
      const [existing] = await db.select().from(creatorProjects).where(and(eq(creatorProjects.id, id), eq(creatorProjects.userId, student.id))).limit(1);
      if (!existing) return Response.json({ error: "Creator project not found" }, { status: 404 });
      await db.update(creatorProjects).set({ title, platform, format, objective, hook, shots: JSON.stringify(shots), caption, status: ready ? "ready" : "draft", updatedAt: now }).where(eq(creatorProjects.id, existing.id));
    } else {
      await db.insert(creatorProjects).values({ id: crypto.randomUUID(), userId: student.id, title, platform, format, objective, hook, shots: JSON.stringify(shots), caption, status: ready ? "ready" : "draft", createdAt: now, updatedAt: now });
    }
    return Response.json(await state(request));
  } catch (error) { return faucetError(error); }
}
