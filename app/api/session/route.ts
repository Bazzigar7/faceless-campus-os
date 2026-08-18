import { desc, eq } from "drizzle-orm";
import { classroomSessions } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

export async function GET(request: Request) {
  try {
    const { db } = await requireCampusUser(request);
    const [session] = await db.select().from(classroomSessions)
      .where(eq(classroomSessions.status, "live"))
      .orderBy(desc(classroomSessions.startedAt)).limit(1);
    return Response.json({ session: session ?? null });
  } catch (error) {
    return faucetError(error);
  }
}
