import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users, wallets } from "../../../../db/schema";
import { isValidUsername, normalizeUsername } from "../../../../lib/wallet-provider";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);

  if (!isValidUsername(username)) {
    return Response.json({ error: "Invalid Campus OS username" }, { status: 400 });
  }

  try {
    const rows = await getDb()
      .select({
        username: users.username,
        displayName: users.displayName,
        chain: wallets.chain,
        address: wallets.address,
        walletType: wallets.walletType,
        provider: wallets.provider,
      })
      .from(users)
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Username resolution is unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}

