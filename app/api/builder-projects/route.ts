import { and, desc, eq, inArray } from "drizzle-orm";
import { builderProjectMembers, builderProjects, cohortMembers, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type BuilderChain = "ethereum" | "solana" | "multichain";
type Milestone = { label: string; done: boolean };

const chains: BuilderChain[] = ["ethereum", "solana", "multichain"];
const defaultMilestones = ["Map the user flow", "Build the first working demo", "Test with a classmate", "Add testnet or demo proof"];
function clean(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function cleanUrl(value: unknown) {
  const url = clean(value, 500); if (!url) return null;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.toString() : null; } catch { return null; }
}
function parseMilestones(value: string): Milestone[] {
  try {
    const rows = JSON.parse(value) as unknown;
    if (!Array.isArray(rows)) throw new Error("invalid");
    return defaultMilestones.map((label, index) => ({ label, done: Boolean((rows[index] as { done?: unknown } | undefined)?.done) }));
  } catch { return defaultMilestones.map((label) => ({ label, done: false })); }
}
function submittedStatus(status: string) { return status === "submitted" || status === "changes_requested" || status === "verified"; }

async function projectState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [ownRows, ownMemberships, reviewRows, people, allMemberRows] = await Promise.all([
    db.select().from(builderProjects).where(eq(builderProjects.userId, student.id)).orderBy(desc(builderProjects.updatedAt)),
    db.select().from(builderProjectMembers).where(eq(builderProjectMembers.userId, student.id)),
    student.role === "owner" ? db.select().from(builderProjects).orderBy(desc(builderProjects.updatedAt)) : Promise.resolve([]),
    db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users),
    db.select().from(builderProjectMembers),
  ]);
  const sharedIds = ownMemberships.filter((row) => row.status !== "declined").map((row) => row.projectId);
  const sharedRows = sharedIds.length ? await db.select().from(builderProjects).where(inArray(builderProjects.id, sharedIds)).orderBy(desc(builderProjects.updatedAt)) : [];
  const visibleRows = [...new Map([...ownRows, ...sharedRows].map((row) => [row.id, row])).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shape = (row: typeof builderProjects.$inferSelect) => ({
    ...row,
    milestones: parseMilestones(row.milestones),
    isOwner: row.userId === student.id,
    invitationStatus: ownMemberships.find((member) => member.projectId === row.id)?.status ?? null,
    members: [
      { id: `owner:${row.userId}`, userId: row.userId, role: "Project lead", status: "accepted", ...(people.find((person) => person.id === row.userId) ?? { username: "student", displayName: "Student" }) },
      ...allMemberRows.filter((member) => member.projectId === row.id && member.status !== "declined").map((member) => ({ id: member.id, userId: member.userId, role: member.role, status: member.status, ...(people.find((person) => person.id === member.userId) ?? { username: "student", displayName: "Student" }) })),
    ],
  });
  return {
    role: student.role,
    projects: visibleRows.map(shape),
    reviewQueue: student.role === "owner" ? reviewRows.filter((row) => submittedStatus(row.status)).map((row) => ({ ...shape(row), student: people.find((person) => person.id === row.userId) ?? null })) : [],
  };
}

export async function GET(request: Request) {
  try { return Response.json(await projectState(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);

    if (action === "invite") {
      const projectId = clean(body.projectId, 80); const username = clean(body.username, 40).replace(/^@/, "").toLowerCase(); const role = clean(body.role, 60) || "Contributor";
      const [[project], [target]] = await Promise.all([
        db.select().from(builderProjects).where(and(eq(builderProjects.id, projectId), eq(builderProjects.userId, student.id))).limit(1),
        db.select().from(users).where(eq(users.username, username)).limit(1),
      ]);
      if (!project) return Response.json({ error: "Only the project lead can invite teammates" }, { status: 403 });
      if (project.status === "submitted" || project.status === "verified") return Response.json({ error: "Finish the team before requesting verification" }, { status: 409 });
      if (!target || target.status !== "active") return Response.json({ error: "No active Campus student uses that username" }, { status: 404 });
      if (target.id === student.id) return Response.json({ error: "You are already the project lead" }, { status: 409 });
      const [memberships] = await Promise.all([db.select().from(cohortMembers).where(inArray(cohortMembers.userId, [student.id, target.id]))]);
      const ownCohort = memberships.find((member) => member.userId === student.id)?.cohortId;
      if (!ownCohort || !memberships.some((member) => member.userId === target.id && member.cohortId === ownCohort)) return Response.json({ error: "Invite a student from your active Campus cohort" }, { status: 409 });
      const now = new Date().toISOString();
      await db.insert(builderProjectMembers).values({ id: crypto.randomUUID(), projectId, userId: target.id, role, status: "invited", invitedBy: student.id, invitedAt: now }).onConflictDoUpdate({ target: [builderProjectMembers.projectId, builderProjectMembers.userId], set: { role, status: "invited", invitedBy: student.id, invitedAt: now, respondedAt: null } });
      return Response.json(await projectState(request));
    }

    if (action === "respond") {
      const projectId = clean(body.projectId, 80); const status = body.status === "accepted" ? "accepted" : "declined";
      const [invitation] = await db.select().from(builderProjectMembers).where(and(eq(builderProjectMembers.projectId, projectId), eq(builderProjectMembers.userId, student.id), eq(builderProjectMembers.status, "invited"))).limit(1);
      if (!invitation) return Response.json({ error: "This team invitation is no longer waiting" }, { status: 409 });
      await db.update(builderProjectMembers).set({ status, respondedAt: new Date().toISOString() }).where(eq(builderProjectMembers.id, invitation.id));
      return Response.json(await projectState(request));
    }

    if (action === "remove_member") {
      const projectId = clean(body.projectId, 80); const memberUserId = clean(body.memberUserId, 80) || student.id;
      const [project] = await db.select().from(builderProjects).where(eq(builderProjects.id, projectId)).limit(1);
      if (!project || (project.userId !== student.id && memberUserId !== student.id)) return Response.json({ error: "Only the project lead can remove another teammate" }, { status: 403 });
      if (project.status === "verified") return Response.json({ error: "Verified project credits cannot be changed" }, { status: 409 });
      await db.delete(builderProjectMembers).where(and(eq(builderProjectMembers.projectId, projectId), eq(builderProjectMembers.userId, memberUserId)));
      return Response.json(await projectState(request));
    }

    if (action === "review") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can verify student builds" }, { status: 403 });
      const projectId = clean(body.projectId, 80);
      const status = body.status === "verified" ? "verified" : "changes_requested";
      const [project] = await db.select().from(builderProjects).where(eq(builderProjects.id, projectId)).limit(1);
      if (!project || project.status !== "submitted") return Response.json({ error: "This project is not waiting for verification" }, { status: 409 });
      await db.update(builderProjects).set({ status, reviewNotes: clean(body.reviewNotes, 700), reviewedBy: student.id, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(builderProjects.id, project.id));
      return Response.json(await projectState(request));
    }

    const id = clean(body.id, 80);
    const [existing] = id ? await db.select().from(builderProjects).where(eq(builderProjects.id, id)).limit(1) : [];
    const [acceptedMembership] = existing && existing.userId !== student.id ? await db.select().from(builderProjectMembers).where(and(eq(builderProjectMembers.projectId, existing.id), eq(builderProjectMembers.userId, student.id), eq(builderProjectMembers.status, "accepted"))).limit(1) : [];
    const canEdit = Boolean(existing && (existing.userId === student.id || acceptedMembership));
    if (id && !canEdit) return Response.json({ error: "Build project not found or the team invitation is not accepted" }, { status: 404 });
    if (action === "submit") {
      if (!existing) return Response.json({ error: "Save the project before submitting it" }, { status: 404 });
      if (existing.userId !== student.id) return Response.json({ error: "Only the project lead can request verification" }, { status: 403 });
      const milestones = parseMilestones(existing.milestones);
      if (!milestones.every((item) => item.done)) return Response.json({ error: "Complete all four build milestones before requesting verification" }, { status: 409 });
      if (!existing.demoUrl && !existing.contractReference) return Response.json({ error: "Add a working demo link or testnet contract reference first" }, { status: 409 });
      await db.update(builderProjects).set({ status: "submitted", reviewNotes: null, reviewedBy: null, reviewedAt: null, updatedAt: new Date().toISOString() }).where(eq(builderProjects.id, existing.id));
      return Response.json(await projectState(request));
    }

    if (action !== "save") return Response.json({ error: "Choose a valid project action" }, { status: 400 });
    const title = clean(body.title, 120); const problem = clean(body.problem, 600); const audience = clean(body.audience, 300); const solution = clean(body.solution, 900);
    const chain = clean(body.chain, 20) as BuilderChain; const useCase = clean(body.useCase, 50) || "other";
    const contractReference = clean(body.contractReference, 220) || null; const rawDemoUrl = clean(body.demoUrl, 500); const demoUrl = cleanUrl(rawDemoUrl);
    if (!title || !problem || !audience || !solution) return Response.json({ error: "Add the project name, problem, audience and solution" }, { status: 400 });
    if (!chains.includes(chain)) return Response.json({ error: "Choose Ethereum, Solana or multichain" }, { status: 400 });
    if (rawDemoUrl && !demoUrl) return Response.json({ error: "Use a complete public HTTPS demo link" }, { status: 400 });
    const milestones = Array.isArray(body.milestones) ? defaultMilestones.map((label, index) => ({ label, done: Boolean((body.milestones as Array<{ done?: unknown }>)[index]?.done) })) : existing ? parseMilestones(existing.milestones) : parseMilestones("[]");
    const now = new Date().toISOString();
    const values = { title, chain, useCase, problem, audience, solution, milestones: JSON.stringify(milestones), contractReference, demoUrl, status: milestones.some((item) => item.done) ? "building" as const : "draft" as const, reviewNotes: null, reviewedBy: null, reviewedAt: null, updatedAt: now };
    if (existing) await db.update(builderProjects).set(values).where(eq(builderProjects.id, existing.id));
    else await db.insert(builderProjects).values({ id: crypto.randomUUID(), userId: student.id, ...values, createdAt: now });
    return Response.json(await projectState(request));
  } catch (error) { return faucetError(error); }
}
