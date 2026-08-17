import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { verifyPrivyIdentityToken } from "./privy-identity";

export async function requireCampusUser(request: Request) {
  const identityToken = request.headers.get("privy-id-token");
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
  if (!identityToken) throw new Response(JSON.stringify({ error: "Sign in to use the Campus Faucet" }), { status: 401 });
  if (!appId || !verificationKey) throw new Response(JSON.stringify({ error: "Campus identity verification is unavailable" }), { status: 503 });

  const identity = await verifyPrivyIdentityToken(identityToken, appId, verificationKey);
  const db = getDb();
  const [student] = await db.select().from(users).where(and(
    eq(users.authProvider, "privy"),
    eq(users.providerUserId, identity.providerUserId),
  )).limit(1);
  if (!student || student.status !== "active") {
    throw new Response(JSON.stringify({ error: "Finish creating your Campus profile first" }), { status: 403 });
  }

  const ownerEmail = (process.env.FACELESS_OWNER_EMAIL || "").trim().toLowerCase();
  const shouldOwn = Boolean(ownerEmail && identity.email === ownerEmail);
  if (shouldOwn && student.role !== "owner") {
    await db.update(users).set({ role: "owner", updatedAt: new Date().toISOString() }).where(eq(users.id, student.id));
    student.role = "owner";
  }
  return { db, identity, student };
}

export async function requireOwner(request: Request) {
  const context = await requireCampusUser(request);
  if (context.student.role !== "owner") {
    throw new Response(JSON.stringify({ error: "Only the Campus OS owner can manage the faucet" }), { status: 403 });
  }
  return context;
}

export function faucetError(error: unknown) {
  if (error instanceof Response) return error;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const rawMessage = error instanceof Error ? error.message : "";
  if (code === "ERR_JWT_EXPIRED" || rawMessage.includes('"exp" claim timestamp check failed')) {
    return Response.json({ error: "Your Campus session expired. Please try again while we refresh it." }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Campus Faucet request failed";
  return Response.json({ error: message }, { status: 500 });
}
