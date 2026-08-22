import { and, asc, eq, like, ne } from "drizzle-orm";
import { cohortMembers, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const query = new URL(request.url).searchParams.get("query")?.trim().toLowerCase().replace(/^@/, "") ?? "";
    if (!/^[a-z0-9_]{1,24}$/.test(query)) return Response.json({ suggestions: [] });

    const [membership] = await db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)).limit(1);
    if (!membership) return Response.json({ suggestions: [] });

    const suggestions = await db.select({ username: users.username, displayName: users.displayName })
      .from(cohortMembers)
      .innerJoin(users, eq(users.id, cohortMembers.userId))
      .where(and(
        eq(cohortMembers.cohortId, membership.cohortId),
        ne(users.id, student.id),
        eq(users.status, "active"),
        like(users.username, `${query}%`),
      ))
      .orderBy(asc(users.username))
      .limit(6);

    return Response.json({ suggestions });
  } catch (error) {
    return faucetError(error);
  }
}
