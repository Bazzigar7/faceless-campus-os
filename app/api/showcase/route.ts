import { and, desc, eq, inArray } from "drizzle-orm";
import { builderProjectMembers, builderProjectReactions, builderProjects, cohortMembers, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

function clean(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }

async function visibleVerifiedProjects(request: Request) {
  const { db, student } = await requireCampusUser(request);
  let rows = student.role === "owner"
    ? await db.select().from(builderProjects).where(eq(builderProjects.status, "verified")).orderBy(desc(builderProjects.featuredAt), desc(builderProjects.reviewedAt))
    : [];

  if (student.role !== "owner") {
    const [membership] = await db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)).limit(1);
    if (membership) {
      const classmates = await db.select({ userId: cohortMembers.userId }).from(cohortMembers).where(eq(cohortMembers.cohortId, membership.cohortId));
      const classmateIds = classmates.map((row) => row.userId);
      if (classmateIds.length) rows = await db.select().from(builderProjects).where(and(eq(builderProjects.status, "verified"), inArray(builderProjects.userId, classmateIds))).orderBy(desc(builderProjects.featuredAt), desc(builderProjects.reviewedAt));
    }
  }

  const projectIds = rows.map((row) => row.id);
  const [people, members, reactions] = await Promise.all([
    db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users),
    projectIds.length ? db.select().from(builderProjectMembers).where(and(inArray(builderProjectMembers.projectId, projectIds), eq(builderProjectMembers.status, "accepted"))) : Promise.resolve([]),
    projectIds.length ? db.select().from(builderProjectReactions).where(inArray(builderProjectReactions.projectId, projectIds)) : Promise.resolve([]),
  ]);
  const person = (id: string) => people.find((row) => row.id === id) ?? { id, username: "student", displayName: "Student" };
  return {
    db,
    student,
    projects: rows.map((row) => ({
      id: row.id,
      title: row.title,
      chain: row.chain,
      useCase: row.useCase,
      problem: row.problem,
      audience: row.audience,
      solution: row.solution,
      demoUrl: row.demoUrl,
      contractReference: row.contractReference,
      featured: Boolean(row.featuredAt),
      featuredAt: row.featuredAt,
      verifiedAt: row.reviewedAt,
      applauseCount: reactions.filter((reaction) => reaction.projectId === row.id && reaction.kind === "applaud").length,
      applauded: reactions.some((reaction) => reaction.projectId === row.id && reaction.userId === student.id && reaction.kind === "applaud"),
      team: [
        { ...person(row.userId), role: "Project lead" },
        ...members.filter((member) => member.projectId === row.id).map((member) => ({ ...person(member.userId), role: member.role })),
      ],
    })),
  };
}

async function showcaseState(request: Request) {
  const { student, projects } = await visibleVerifiedProjects(request);
  return { role: student.role, projects };
}

export async function GET(request: Request) {
  try { return Response.json(await showcaseState(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);
    const projectId = clean(body.projectId, 80);
    const { db, student, projects } = await visibleVerifiedProjects(request);
    const visible = projects.some((project) => project.id === projectId);
    if (!visible) return Response.json({ error: "This verified project is not visible in your Campus cohort" }, { status: 404 });

    if (action === "applaud") {
      const [existing] = await db.select().from(builderProjectReactions).where(and(eq(builderProjectReactions.projectId, projectId), eq(builderProjectReactions.userId, student.id), eq(builderProjectReactions.kind, "applaud"))).limit(1);
      if (existing) await db.delete(builderProjectReactions).where(eq(builderProjectReactions.id, existing.id));
      else await db.insert(builderProjectReactions).values({ id: crypto.randomUUID(), projectId, userId: student.id, kind: "applaud" });
      return Response.json(await showcaseState(request));
    }

    if (action === "feature" || action === "unfeature") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can feature demo-day projects" }, { status: 403 });
      await db.update(builderProjects).set(action === "feature" ? { featuredAt: new Date().toISOString(), featuredBy: student.id } : { featuredAt: null, featuredBy: null }).where(and(eq(builderProjects.id, projectId), eq(builderProjects.status, "verified")));
      return Response.json(await showcaseState(request));
    }

    return Response.json({ error: "Choose a valid Showcase action" }, { status: 400 });
  } catch (error) { return faucetError(error); }
}
