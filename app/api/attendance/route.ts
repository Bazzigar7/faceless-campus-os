import { and, desc, eq } from "drizzle-orm";
import { attendanceRecords, attendanceSessions, cohortMembers, cohorts, users } from "../../../db/schema";
import { faucetError, requireCampusUser, requireOwner } from "../../../lib/faucet-auth";

function clean(value: unknown, max: number) { return String(value || "").trim().slice(0, max); }

async function attendanceState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [sessionRows, recordRows, cohortRows, memberRows, people] = await Promise.all([
    db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.openedAt)),
    db.select().from(attendanceRecords),
    db.select().from(cohorts),
    db.select().from(cohortMembers),
    student.role === "owner" ? db.select().from(users) : Promise.resolve([]),
  ]);
  const now = Date.now();
  const membership = memberRows.find((member) => member.userId === student.id);
  const ownRecords = recordRows.filter((record) => record.userId === student.id).map((record) => {
    const session = sessionRows.find((item) => item.id === record.sessionId);
    return { ...record, title: session?.title ?? "Campus session", host: session?.host ?? "Faceless", openedAt: session?.openedAt ?? record.checkedInAt };
  });
  const prompt = membership ? sessionRows.find((session) => session.cohortId === membership.cohortId && session.status === "open" && Date.parse(session.expiresAt) > now && !ownRecords.some((record) => record.sessionId === session.id)) : null;
  const ownerSessions = student.role === "owner" ? sessionRows.slice(0, 30).map((session) => {
    const cohort = cohortRows.find((item) => item.id === session.cohortId);
    const records = recordRows.filter((record) => record.sessionId === session.id).map((record) => {
      const person = people.find((item) => item.id === record.userId);
      return { id: record.id, userId: record.userId, username: person?.username ?? "student", displayName: person?.displayName ?? "Student", email: person?.email ?? "", checkedInAt: record.checkedInAt };
    });
    return { ...session, cohortTitle: cohort?.title ?? "Cohort", attendanceCount: records.length, records };
  }) : [];
  return {
    role: student.role,
    prompt: prompt ? { id: prompt.id, title: prompt.title, host: prompt.host, expiresAt: prompt.expiresAt } : null,
    ownRecords,
    sessions: ownerSessions,
  };
}

export async function GET(request: Request) {
  try { return Response.json(await attendanceState(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);
    if (action === "open") {
      const { db, student } = await requireOwner(request);
      const cohortId = clean(body.cohortId, 100); const title = clean(body.title, 120); const host = clean(body.host, 100) || "Faceless";
      const durationMinutes = Math.max(5, Math.min(120, Number(body.durationMinutes) || 15));
      const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, cohortId), eq(cohorts.status, "active"))).limit(1);
      if (!cohort || !title) return Response.json({ error: "Choose an active cohort and session title" }, { status: 400 });
      await db.update(attendanceSessions).set({ status: "closed", closedAt: new Date().toISOString() }).where(and(eq(attendanceSessions.cohortId, cohortId), eq(attendanceSessions.status, "open")));
      let checkInCode = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        checkInCode = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
        const [existing] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.checkInCode, checkInCode)).limit(1);
        if (!existing) break;
      }
      const openedAt = new Date(); const expiresAt = new Date(openedAt.getTime() + durationMinutes * 60_000).toISOString();
      await db.insert(attendanceSessions).values({ id: crypto.randomUUID(), cohortId, title, host, checkInCode, status: "open", expiresAt, openedBy: student.id, openedAt: openedAt.toISOString() });
      return Response.json(await attendanceState(request));
    }
    const { db, student } = await requireCampusUser(request);
    if (action === "check_in") {
      if (student.role === "owner") return Response.json({ error: "The educator manages attendance from Educator View" }, { status: 400 });
      const code = clean(body.code, 12).toUpperCase();
      const [session] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.checkInCode, code), eq(attendanceSessions.status, "open"))).limit(1);
      if (!session || Date.parse(session.expiresAt) <= Date.now()) return Response.json({ error: "That check-in code is invalid or has expired" }, { status: 404 });
      const [membership] = await db.select().from(cohortMembers).where(and(eq(cohortMembers.cohortId, session.cohortId), eq(cohortMembers.userId, student.id))).limit(1);
      if (!membership) return Response.json({ error: "This check-in belongs to another cohort" }, { status: 403 });
      await db.insert(attendanceRecords).values({ id: crypto.randomUUID(), sessionId: session.id, userId: student.id }).onConflictDoNothing({ target: [attendanceRecords.sessionId, attendanceRecords.userId] });
      return Response.json(await attendanceState(request));
    }
    if (action === "close") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can close attendance" }, { status: 403 });
      const sessionId = clean(body.sessionId, 100);
      await db.update(attendanceSessions).set({ status: "closed", closedAt: new Date().toISOString() }).where(eq(attendanceSessions.id, sessionId));
      return Response.json(await attendanceState(request));
    }
    return Response.json({ error: "Choose a valid attendance action" }, { status: 400 });
  } catch (error) { return faucetError(error); }
}
