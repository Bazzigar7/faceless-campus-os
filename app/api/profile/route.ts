import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users, wallets } from "../../../db/schema";
import { verifyPrivyIdentityToken } from "../../../lib/privy-identity";
import { isValidUsername, normalizeUsername } from "../../../lib/wallet-provider";

function profileResponse(username: string, displayName: string, walletRows: Array<{ chain: string; address: string }>) {
  return Response.json({
    username: `@${username}`,
    displayName,
    wallets: walletRows,
  });
}

export async function POST(request: Request) {
  const identityToken = request.headers.get("privy-id-token");
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;

  if (!identityToken) return Response.json({ error: "Privy identity token is required" }, { status: 401 });
  if (!appId || !verificationKey) return Response.json({ error: "Campus identity verification is not configured" }, { status: 503 });

  let requestedUsername = "";
  try {
    const body = await request.json() as { username?: string };
    requestedUsername = normalizeUsername(body.username ?? "");
  } catch {
    return Response.json({ error: "Invalid profile request" }, { status: 400 });
  }

  try {
    const identity = await verifyPrivyIdentityToken(identityToken, appId, verificationKey);
    const db = getDb();
    const [existing] = await db.select().from(users).where(and(
      eq(users.authProvider, "privy"),
      eq(users.providerUserId, identity.providerUserId),
    )).limit(1);

    if (!existing) {
      if (!isValidUsername(requestedUsername)) {
        return Response.json({ error: "Choose 3–24 letters, numbers or underscores, starting with a letter" }, { status: 400 });
      }
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, requestedUsername)).limit(1);
      if (taken) return Response.json({ error: "That username is already taken. Choose another one." }, { status: 409 });

      await db.insert(users).values({
        id: identity.providerUserId,
        authProvider: "privy",
        providerUserId: identity.providerUserId,
        email: identity.email,
        username: requestedUsername,
        displayName: identity.displayName,
      });
    }

    const student = existing ?? {
      id: identity.providerUserId,
      username: requestedUsername,
      displayName: identity.displayName,
    };

    await db.update(users).set({
      email: identity.email,
      displayName: identity.displayName,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, student.id));

    for (const chain of ["ethereum", "solana"] as const) {
      await db.update(wallets).set({ isPrimary: false }).where(and(eq(wallets.userId, student.id), eq(wallets.chain, chain)));
    }

    for (const wallet of identity.wallets) {
      await db.insert(wallets).values({
        id: `${student.id}:${wallet.chain}:${wallet.address}`,
        userId: student.id,
        provider: "privy",
        chain: wallet.chain,
        walletType: wallet.kind,
        address: wallet.address,
        isPrimary: wallet.isPrimary,
      }).onConflictDoUpdate({
        target: [wallets.chain, wallets.address],
        set: {
          userId: student.id,
          provider: "privy",
          walletType: wallet.kind,
          isPrimary: wallet.isPrimary,
        },
      });
    }

    const walletRows = await db.select({ chain: wallets.chain, address: wallets.address })
      .from(wallets)
      .where(and(eq(wallets.userId, student.id), eq(wallets.isPrimary, true)));
    return profileResponse(student.username, student.displayName, walletRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campus profile could not be saved";
    const status = message.includes("finishing") ? 425 : message.includes("token") || message.includes("identity") ? 401 : 503;
    return Response.json({ error: message }, { status });
  }
}
