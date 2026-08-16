import { asc, count, desc, eq } from "drizzle-orm";
import { lessonProgress, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type Course = "blockchain" | "bitcoin" | "ethereum";
const lessonCounts: Record<Course, number> = { blockchain: 3, bitcoin: 7, ethereum: 15 };

function isCourse(value: unknown): value is Course {
  return value === "blockchain" || value === "bitcoin" || value === "ethereum";
}

async function learningState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const records = await db.select({
    course: lessonProgress.course,
    lessonId: lessonProgress.lessonId,
    status: lessonProgress.status,
    positionSeconds: lessonProgress.positionSeconds,
    durationSeconds: lessonProgress.durationSeconds,
    updatedAt: lessonProgress.updatedAt,
    completedAt: lessonProgress.completedAt,
  }).from(lessonProgress).where(eq(lessonProgress.userId, student.id)).orderBy(desc(lessonProgress.updatedAt));

  const completedCount = records.filter((record) => record.status === "completed").length;
  const courseProgress = (["blockchain", "bitcoin", "ethereum"] as const).map((course) => ({
    course,
    total: lessonCounts[course],
    completed: records.filter((record) => record.course === course && record.status === "completed").length,
  }));
  const resume = records.find((record) => record.status === "in_progress") ?? records[0] ?? null;

  let cohort: undefined | {
    activeStudents: number;
    lessonsCompleted: number;
    lessonsInProgress: number;
    completionRate: number;
    courses: Array<{ course: Course; completed: number }>;
  };
  if (student.role === "owner") {
    const [activeStudents] = await db.select({ value: count() }).from(users).where(eq(users.status, "active"));
    const [completed] = await db.select({ value: count() }).from(lessonProgress).where(eq(lessonProgress.status, "completed"));
    const [inProgress] = await db.select({ value: count() }).from(lessonProgress).where(eq(lessonProgress.status, "in_progress"));
    const courses = await db.select({ course: lessonProgress.course, completed: count() }).from(lessonProgress)
      .where(eq(lessonProgress.status, "completed"))
      .groupBy(lessonProgress.course)
      .orderBy(asc(lessonProgress.course));
    const students = activeStudents?.value ?? 0;
    const completedLessons = completed?.value ?? 0;
    cohort = {
      activeStudents: students,
      lessonsCompleted: completedLessons,
      lessonsInProgress: inProgress?.value ?? 0,
      completionRate: students ? Math.round((completedLessons / (students * 25)) * 100) : 0,
      courses,
    };
  }

  return { completedCount, totalLessons: 25, records, courseProgress, resume, cohort };
}

export async function GET(request: Request) {
  try {
    return Response.json(await learningState(request));
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as {
      course?: Course;
      lessonId?: number;
      status?: "in_progress" | "completed";
      positionSeconds?: number;
      durationSeconds?: number;
    };
    if (!isCourse(body.course)) return Response.json({ error: "Choose a valid course" }, { status: 400 });
    const lessonId = Number(body.lessonId);
    if (!Number.isInteger(lessonId) || lessonId < 1 || lessonId > lessonCounts[body.course]) {
      return Response.json({ error: "Choose a valid lesson" }, { status: 400 });
    }
    const status = body.status === "completed" ? "completed" : "in_progress";
    const positionSeconds = Math.max(0, Math.min(86_400, Math.round(Number(body.positionSeconds) || 0)));
    const durationSeconds = Math.max(0, Math.min(86_400, Math.round(Number(body.durationSeconds) || 0)));
    const id = `${student.id}:${body.course}:${lessonId}`;
    const now = new Date().toISOString();
    await db.insert(lessonProgress).values({
      id,
      userId: student.id,
      course: body.course,
      lessonId,
      status,
      positionSeconds,
      durationSeconds,
      completedAt: status === "completed" ? now : null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.course, lessonProgress.lessonId],
      set: {
        status,
        positionSeconds,
        durationSeconds,
        completedAt: status === "completed" ? now : null,
        updatedAt: now,
      },
    });
    return Response.json(await learningState(request));
  } catch (error) {
    return faucetError(error);
  }
}
