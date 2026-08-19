import { and, desc, eq } from "drizzle-orm";
import { campaignEnrollments, campaigns, creatorProjects, users } from "../../../db/schema";
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
  const [ownRows, campaignRows, reviewRows, people] = await Promise.all([
    db.select().from(creatorProjects).where(eq(creatorProjects.userId, student.id)).orderBy(desc(creatorProjects.updatedAt)),
    db.select().from(campaigns),
    student.role === "owner" ? db.select().from(creatorProjects).orderBy(desc(creatorProjects.updatedAt)) : Promise.resolve([]),
    student.role === "owner" ? db.select().from(users) : Promise.resolve([]),
  ]);
  const shape = (row: typeof creatorProjects.$inferSelect) => ({ ...row, shots: parseShots(row.shots), campaign: campaignRows.find((campaign) => campaign.id === row.campaignId) ?? null });
  return {
    projects: ownRows.map(shape),
    reviewQueue: student.role === "owner" ? reviewRows.filter((row) => row.reviewStatus !== "not_requested").map((row) => ({ ...shape(row), student: people.find((person) => person.id === row.userId) ?? null })) : [],
  };
}

export async function GET(request: Request) {
  try { return Response.json(await state(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);
    if (action === "review") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can review creator plans" }, { status: 403 });
      const projectId = clean(body.projectId, 80); const reviewStatus = body.reviewStatus === "approved" ? "approved" : "changes_requested";
      const [project] = await db.select().from(creatorProjects).where(eq(creatorProjects.id, projectId)).limit(1);
      if (!project || project.reviewStatus !== "submitted") return Response.json({ error: "This creator plan is not waiting for review" }, { status: 409 });
      await db.update(creatorProjects).set({ reviewStatus, reviewNotes: clean(body.reviewNotes, 500), reviewedBy: student.id, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(creatorProjects.id, project.id));
      return Response.json(await state(request));
    }
    const id = clean(body.id, 80);
    if (action === "submit_review") {
      const [project] = await db.select().from(creatorProjects).where(and(eq(creatorProjects.id, id), eq(creatorProjects.userId, student.id))).limit(1);
      if (!project) return Response.json({ error: "Save this creator project before sending it for review" }, { status: 404 });
      if (project.status !== "ready") return Response.json({ error: "Mark the complete content plan ready before requesting review" }, { status: 409 });
      await db.update(creatorProjects).set({ reviewStatus: "submitted", reviewNotes: null, reviewedBy: null, reviewedAt: null, updatedAt: new Date().toISOString() }).where(eq(creatorProjects.id, project.id));
      return Response.json(await state(request));
    }
    const title = clean(body.title, 100); const platform = clean(body.platform, 40) || "Instagram Reels"; const objective = clean(body.objective, 500);
    const format = clean(body.format, 30) as CreatorFormat; const hook = clean(body.hook, 300); const caption = clean(body.caption, 1_000); const shots = cleanShots(body.shots); const campaignId = clean(body.campaignId, 80) || null;
    if (!title || !objective) return Response.json({ error: "Add a project title and the content objective" }, { status: 400 });
    if (!formats.includes(format)) return Response.json({ error: "Choose a valid content format" }, { status: 400 });
    if (campaignId) {
      const [joined] = await db.select().from(campaignEnrollments).where(and(eq(campaignEnrollments.campaignId, campaignId), eq(campaignEnrollments.userId, student.id))).limit(1);
      if (!joined) return Response.json({ error: "Join the campaign before linking its brief" }, { status: 409 });
    }
    const ready = action === "mark_ready";
    if (ready && (!hook || !caption || shots.some((shot) => !shot))) return Response.json({ error: "Complete the hook, all five shots and the caption before marking this ready" }, { status: 400 });
    const now = new Date().toISOString();
    if (id) {
      const [existing] = await db.select().from(creatorProjects).where(and(eq(creatorProjects.id, id), eq(creatorProjects.userId, student.id))).limit(1);
      if (!existing) return Response.json({ error: "Creator project not found" }, { status: 404 });
      await db.update(creatorProjects).set({ campaignId, title, platform, format, objective, hook, shots: JSON.stringify(shots), caption, status: ready ? "ready" : "draft", reviewStatus: "not_requested", reviewNotes: null, reviewedBy: null, reviewedAt: null, updatedAt: now }).where(eq(creatorProjects.id, existing.id));
    } else {
      await db.insert(creatorProjects).values({ id: crypto.randomUUID(), userId: student.id, campaignId, title, platform, format, objective, hook, shots: JSON.stringify(shots), caption, status: ready ? "ready" : "draft", createdAt: now, updatedAt: now });
    }
    return Response.json(await state(request));
  } catch (error) { return faucetError(error); }
}
