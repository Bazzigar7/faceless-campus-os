import { and, desc, eq } from "drizzle-orm";
import { cohortAssignments, cohortMembers, cohorts, lessonProgress, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser, requireOwner } from "../../../lib/faucet-auth";

function clean(value: unknown, max: number) { return String(value || "").trim().slice(0, max); }

async function cohortState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [cohortRows, memberRows, assignmentRows, people, walletRows, lessonRows] = await Promise.all([
    db.select().from(cohorts).orderBy(desc(cohorts.createdAt)),
    db.select().from(cohortMembers),
    db.select().from(cohortAssignments).orderBy(desc(cohortAssignments.createdAt)),
    student.role === "owner" ? db.select().from(users) : Promise.resolve([]),
    student.role === "owner" ? db.select().from(wallets) : Promise.resolve([]),
    student.role === "owner" ? db.select().from(lessonProgress) : Promise.resolve([]),
  ]);
  const ownMembership = memberRows.find((member) => member.userId === student.id);
  const ownCohort = ownMembership ? cohortRows.find((cohort) => cohort.id === ownMembership.cohortId) : null;
  const ownerCohorts = student.role === "owner" ? cohortRows.map((cohort) => {
    const memberships = memberRows.filter((member) => member.cohortId === cohort.id);
    return {
      ...cohort,
      memberCount: memberships.length,
      assignments: assignmentRows.filter((assignment) => assignment.cohortId === cohort.id).map((assignment) => ({
        ...assignment,
        completedCount: memberships.filter((membership) => lessonRows.some((lesson) => lesson.userId === membership.userId && lesson.course === assignment.course && lesson.lessonId === assignment.lessonId && lesson.status === "completed")).length,
        totalStudents: memberships.length,
      })),
      roster: memberships.map((membership) => {
        const person = people.find((item) => item.id === membership.userId);
        const ownWallets = walletRows.filter((wallet) => wallet.userId === membership.userId);
        return {
          id: membership.userId,
          username: person?.username ?? "student",
          displayName: person?.displayName ?? "Student",
          email: person?.email ?? "",
          joinedAt: membership.joinedAt,
          ethereumAddress: ownWallets.find((wallet) => wallet.chain === "ethereum" && wallet.isPrimary)?.address ?? "",
          solanaAddress: ownWallets.find((wallet) => wallet.chain === "solana" && wallet.isPrimary)?.address ?? "",
          lessonsCompleted: lessonRows.filter((lesson) => lesson.userId === membership.userId && lesson.status === "completed").length,
        };
      }),
    };
  }) : [];
  return {
    role: student.role,
    gateEnabled: cohortRows.some((cohort) => cohort.status === "active"),
    membership: ownCohort ? { id: ownCohort.id, title: ownCohort.title, college: ownCohort.college, joinedAt: ownMembership?.joinedAt } : null,
    assignments: ownCohort ? assignmentRows.filter((assignment) => assignment.cohortId === ownCohort.id && assignment.status === "active") : [],
    cohorts: ownerCohorts,
  };
}

export async function GET(request: Request) {
  try { return Response.json(await cohortState(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);
    if (action === "create") {
      const { db } = await requireOwner(request);
      const title = clean(body.title, 80); const college = clean(body.college, 100); const expectedStudents = Math.max(1, Math.min(500, Number(body.expectedStudents) || 200));
      if (!title || !college) return Response.json({ error: "Add the cohort name and college" }, { status: 400 });
      let joinCode = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        joinCode = `FACELESS-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
        const [existing] = await db.select().from(cohorts).where(eq(cohorts.joinCode, joinCode)).limit(1);
        if (!existing) break;
      }
      await db.insert(cohorts).values({ id: crypto.randomUUID(), title, college, joinCode, expectedStudents, enrollmentOpen: true, status: "active" });
      return Response.json(await cohortState(request));
    }
    const { db, student } = await requireCampusUser(request);
    if (action === "join") {
      if (student.role === "owner") return Response.json({ error: "The Campus owner manages cohorts from Educator View" }, { status: 400 });
      const joinCode = clean(body.joinCode, 30).toUpperCase();
      const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.joinCode, joinCode), eq(cohorts.status, "active"), eq(cohorts.enrollmentOpen, true))).limit(1);
      if (!cohort) return Response.json({ error: "That cohort code is invalid or enrollment is closed" }, { status: 404 });
      const [existingMembership, members] = await Promise.all([db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)).limit(1), db.select().from(cohortMembers).where(eq(cohortMembers.cohortId, cohort.id))]);
      if (existingMembership[0]?.cohortId === cohort.id) return Response.json(await cohortState(request));
      if (existingMembership.length) return Response.json({ error: "You already belong to another Campus cohort" }, { status: 409 });
      if (members.length >= cohort.expectedStudents) return Response.json({ error: "This cohort has reached its seat limit" }, { status: 409 });
      await db.insert(cohortMembers).values({ id: crypto.randomUUID(), cohortId: cohort.id, userId: student.id });
      return Response.json(await cohortState(request));
    }
    if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can manage cohorts" }, { status: 403 });
    const cohortId = clean(body.cohortId, 80);
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
    if (!cohort) return Response.json({ error: "Cohort not found" }, { status: 404 });
    if (action === "set_enrollment") {
      await db.update(cohorts).set({ enrollmentOpen: Boolean(body.enrollmentOpen) }).where(eq(cohorts.id, cohort.id));
    } else if (action === "assign_lesson") {
      const course = clean(body.course, 20) as "blockchain" | "bitcoin" | "ethereum";
      const lessonId = Number(body.lessonId);
      const maxLessons = { blockchain: 3, bitcoin: 7, ethereum: 15 }[course];
      const title = clean(body.title, 120); const instructions = clean(body.instructions, 500); const dueAt = clean(body.dueAt, 40) || null;
      if (!maxLessons || !Number.isInteger(lessonId) || lessonId < 1 || lessonId > maxLessons || !title) return Response.json({ error: "Choose a valid lesson for this cohort" }, { status: 400 });
      await db.insert(cohortAssignments).values({ id: crypto.randomUUID(), cohortId: cohort.id, course, lessonId, title, instructions, dueAt, status: "active", createdBy: student.id }).onConflictDoUpdate({ target: [cohortAssignments.cohortId, cohortAssignments.course, cohortAssignments.lessonId], set: { title, instructions, dueAt, status: "active", createdBy: student.id, createdAt: new Date().toISOString() } });
    } else if (action === "archive_assignment") {
      const assignmentId = clean(body.assignmentId, 100);
      await db.update(cohortAssignments).set({ status: "archived" }).where(and(eq(cohortAssignments.id, assignmentId), eq(cohortAssignments.cohortId, cohort.id)));
    } else if (action === "complete") {
      await db.update(cohorts).set({ status: "complete", enrollmentOpen: false }).where(eq(cohorts.id, cohort.id));
    } else if (action === "move") {
      const userId = clean(body.userId, 100);
      const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!person || person.role === "owner") return Response.json({ error: "Choose a valid student" }, { status: 400 });
      await db.delete(cohortMembers).where(eq(cohortMembers.userId, userId));
      await db.insert(cohortMembers).values({ id: crypto.randomUUID(), cohortId: cohort.id, userId });
    } else return Response.json({ error: "Choose a valid cohort action" }, { status: 400 });
    return Response.json(await cohortState(request));
  } catch (error) { return faucetError(error); }
}
