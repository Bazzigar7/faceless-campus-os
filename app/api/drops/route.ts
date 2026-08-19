import { and, desc, eq, inArray } from "drizzle-orm";
import { campaignSubmissions, classroomSessionActivity, lessonProgress, partnerDropClaims, partnerDrops } from "../../../db/schema";
import { faucetError, requireCampusUser, requireOwner } from "../../../lib/faucet-auth";

type Eligibility = "open" | "live_quest" | "lesson" | "campaign";
const eligibilityOptions: Eligibility[] = ["open", "live_quest", "lesson", "campaign"];

async function state(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [dropRows, claimRows] = await Promise.all([db.select().from(partnerDrops).orderBy(desc(partnerDrops.createdAt)), db.select().from(partnerDropClaims).orderBy(desc(partnerDropClaims.claimedAt))]);
  const visible = student.role === "owner" ? dropRows : dropRows.filter((drop) => drop.status === "live");
  return {
    role: student.role,
    drops: visible.map((drop) => ({ ...drop, claimedCount: claimRows.filter((claim) => claim.dropId === drop.id).length, ownClaim: claimRows.find((claim) => claim.dropId === drop.id && claim.userId === student.id) ?? null })),
    credentials: claimRows.filter((claim) => claim.userId === student.id).map((claim) => ({ ...claim, drop: dropRows.find((drop) => drop.id === claim.dropId) ?? null })),
  };
}

export async function GET(request: Request) {
  try { return Response.json(await state(request)); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create") {
      const { db, student } = await requireOwner(request);
      const title = String(body.title || "").trim(); const host = String(body.host || "").trim(); const description = String(body.description || "").trim();
      const eligibility = String(body.eligibility || "open") as Eligibility;
      if (!title || !host || !description) return Response.json({ error: "Add the drop title, host and description" }, { status: 400 });
      if (!eligibilityOptions.includes(eligibility)) return Response.json({ error: "Choose valid eligibility" }, { status: 400 });
      await db.insert(partnerDrops).values({ id: crypto.randomUUID(), title: title.slice(0, 100), host: host.slice(0, 80), description: description.slice(0, 500), rewardLabel: String(body.rewardLabel || "Campus credential").slice(0, 80), eligibility, maxClaims: Math.max(1, Math.min(1000, Number(body.maxClaims) || 200)), status: "live", createdBy: student.id });
      return Response.json(await state(request));
    }
    const { db, student } = await requireCampusUser(request);
    const dropId = String(body.dropId || "");
    const [drop] = await db.select().from(partnerDrops).where(eq(partnerDrops.id, dropId)).limit(1);
    if (!drop || drop.status !== "live") return Response.json({ error: "This partner drop is not open" }, { status: 404 });
    const existingClaims = await db.select().from(partnerDropClaims).where(eq(partnerDropClaims.dropId, drop.id));
    if (existingClaims.some((claim) => claim.userId === student.id)) return Response.json(await state(request));
    if (existingClaims.length >= drop.maxClaims) return Response.json({ error: "This drop has reached its claim limit" }, { status: 409 });
    let evidence = "Open Campus claim";
    if (drop.eligibility === "live_quest") {
      const rows = await db.select().from(classroomSessionActivity).where(and(eq(classroomSessionActivity.userId, student.id), eq(classroomSessionActivity.status, "completed"))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete a verified live classroom quest to unlock this drop" }, { status: 403 });
      evidence = rows[0].proofLabel ?? "Verified live quest";
    } else if (drop.eligibility === "lesson") {
      const rows = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, student.id), eq(lessonProgress.status, "completed"))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete a lesson to unlock this drop" }, { status: 403 });
      evidence = "Completed Faceless lesson";
    } else if (drop.eligibility === "campaign") {
      const rows = await db.select().from(campaignSubmissions).where(and(eq(campaignSubmissions.userId, student.id), inArray(campaignSubmissions.status, ["approved_for_payment", "paid"]))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete an approved campaign to unlock this drop" }, { status: 403 });
      evidence = "Approved creator campaign";
    }
    await db.insert(partnerDropClaims).values({ id: crypto.randomUUID(), dropId: drop.id, userId: student.id, evidence });
    return Response.json(await state(request));
  } catch (error) { return faucetError(error); }
}
