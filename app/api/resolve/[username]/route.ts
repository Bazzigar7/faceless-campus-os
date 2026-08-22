import { and, asc, eq } from "drizzle-orm";
import { cohortMembers, users, wallets } from "../../../../db/schema";
import { faucetError, requireCampusUser } from "../../../../lib/faucet-auth";
import { isValidUsername, normalizeUsername } from "../../../../lib/wallet-provider";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);

  if (!isValidUsername(username)) {
    return Response.json({ error: "Invalid Campus OS username" }, { status: 400 });
  }

  try {
    const { db, student } = await requireCampusUser(request);
    const [ownMembership] = await db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)).limit(1);
    if (!ownMembership) return Response.json({ error: "Join your Campus cohort before sending tokens" }, { status: 403 });

    const rows = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        chain: wallets.chain,
        address: wallets.address,
        walletType: wallets.walletType,
        provider: wallets.provider,
      })
      .from(users)
      .innerJoin(cohortMembers, and(eq(cohortMembers.userId, users.id), eq(cohortMembers.cohortId, ownMembership.cohortId)))
      .innerJoin(wallets, eq(wallets.userId, users.id))
      .where(and(eq(users.username, username), eq(users.status, "active"), eq(wallets.isPrimary, true)))
      .orderBy(asc(wallets.chain));

    if (rows.length === 0) {
      return Response.json({ error: "Username not found" }, { status: 404 });
    }

    return Response.json({
      username: `@${rows[0].username}`,
      displayName: rows[0].displayName,
      wallets: rows.map(({ chain, address, walletType, provider }) => ({ chain, address, walletType, provider })),
    });
  } catch (error) { return faucetError(error); }
}
