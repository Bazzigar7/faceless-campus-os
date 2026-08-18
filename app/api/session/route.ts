import { and, desc, eq } from "drizzle-orm";
import { classroomSessionActivity, classroomSessions, faucetClaims, marketPurchases, rwaHoldings, testnetLaunches, testnetTokens, tokenTransfers } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [session] = await db.select().from(classroomSessions)
      .where(eq(classroomSessions.status, "live"))
      .orderBy(desc(classroomSessions.startedAt)).limit(1);
    if (!session) return Response.json({ session: null, activity: null });
    const [activity] = await db.select().from(classroomSessionActivity).where(and(eq(classroomSessionActivity.sessionId, session.id), eq(classroomSessionActivity.userId, student.id))).limit(1);
    return Response.json({ session, activity: activity ?? null });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as { action?: "working" | "needs_help" | "complete" };
    const [session] = await db.select().from(classroomSessions).where(eq(classroomSessions.status, "live")).orderBy(desc(classroomSessions.startedAt)).limit(1);
    if (!session) return Response.json({ error: "There is no live classroom quest" }, { status: 409 });
    let status: "working" | "needs_help" | "completed" = body.action === "needs_help" ? "needs_help" : "working";
    let proofLabel: string | null = null;
    if (body.action === "complete") {
      if (session.quest === "fund_wallets") {
        const rows = await db.select().from(faucetClaims).where(and(eq(faucetClaims.userId, student.id), eq(faucetClaims.status, "sent"))).limit(1);
        if (rows.length) proofLabel = "Testnet faucet receipt verified";
      } else if (session.quest === "send_token") {
        const rows = await db.select().from(tokenTransfers).where(eq(tokenTransfers.fromUserId, student.id)).limit(1);
        if (rows.length) proofLabel = "Token transfer verified";
      } else if (session.quest === "mint_nft") {
        const purchases = await db.select().from(marketPurchases).where(eq(marketPurchases.buyerUserId, student.id)).limit(1);
        const launches = await db.select().from(testnetLaunches).where(and(eq(testnetLaunches.userId, student.id), eq(testnetLaunches.status, "minted"))).limit(1);
        if (purchases.length || launches.length) proofLabel = "NFT mint verified";
      } else if (session.quest === "buy_rwa") {
        const rows = await db.select().from(rwaHoldings).where(eq(rwaHoldings.userId, student.id));
        if (rows.some((row) => row.units > 0)) proofLabel = "Tokenised asset holding verified";
      } else {
        const rows = await db.select().from(testnetTokens).where(and(eq(testnetTokens.userId, student.id), eq(testnetTokens.status, "deployed"))).limit(1);
        if (rows.length) proofLabel = "Token deployment verified";
      }
      if (!proofLabel) return Response.json({ error: "Campus OS cannot see the matching onchain proof yet. Finish the quest, then try again." }, { status: 409 });
      status = "completed";
    }
    const now = new Date().toISOString();
    await db.insert(classroomSessionActivity).values({ id: crypto.randomUUID(), sessionId: session.id, userId: student.id, status, proofLabel, updatedAt: now, completedAt: status === "completed" ? now : null }).onConflictDoUpdate({
      target: [classroomSessionActivity.sessionId, classroomSessionActivity.userId],
      set: { status, proofLabel, updatedAt: now, completedAt: status === "completed" ? now : null },
    });
    const [activity] = await db.select().from(classroomSessionActivity).where(and(eq(classroomSessionActivity.sessionId, session.id), eq(classroomSessionActivity.userId, student.id))).limit(1);
    return Response.json({ session, activity });
  } catch (error) { return faucetError(error); }
}
