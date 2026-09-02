import { and, asc, count, eq, inArray } from "drizzle-orm";
import { faucetClaims, faucetConfigs, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";
import { isPrivyServerWalletReady, sendFaucetTransfer } from "../../../lib/privy-server-wallet";
import type { CampusFaucetNetwork } from "../../../lib/wallet-provider";

const defaults: Record<CampusFaucetNetwork, string> = { ethereum: "0.002", solana: "0.05", robinhood: "0.001" };

async function ensureConfigs(db: Awaited<ReturnType<typeof requireCampusUser>>["db"]) {
  for (const chain of ["ethereum", "solana", "robinhood"] as const) {
    await db.insert(faucetConfigs).values({ chain, amount: defaults[chain], maxClaims: 1 })
      .onConflictDoNothing({ target: faucetConfigs.chain });
  }

  const [ethereum] = await db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, "ethereum")).limit(1);
  const [robinhood] = await db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, "robinhood")).limit(1);
  if (
    ethereum?.distributorWalletId
    && ethereum.distributorAddress
    && (robinhood?.distributorWalletId !== ethereum.distributorWalletId || robinhood?.distributorAddress !== ethereum.distributorAddress)
  ) {
    await db.update(faucetConfigs).set({
      distributorWalletId: ethereum.distributorWalletId,
      distributorAddress: ethereum.distributorAddress,
      updatedAt: new Date().toISOString(),
    }).where(eq(faucetConfigs.chain, "robinhood"));
  }
}

async function stateFor(request: Request) {
  const { db, student } = await requireCampusUser(request);
  await ensureConfigs(db);
  const configs = await db.select().from(faucetConfigs).orderBy(asc(faucetConfigs.chain));
  const counts = await db.select({ chain: faucetClaims.chain, value: count() }).from(faucetClaims)
    .where(and(eq(faucetClaims.userId, student.id), inArray(faucetClaims.status, ["queued", "processing", "sent"])))
    .groupBy(faucetClaims.chain);
  const recent = await db.select({
    id: faucetClaims.id,
    chain: faucetClaims.chain,
    amount: faucetClaims.amount,
    status: faucetClaims.status,
    transactionHash: faucetClaims.transactionHash,
    claimedAt: faucetClaims.claimedAt,
    errorMessage: faucetClaims.errorMessage,
  }).from(faucetClaims).where(eq(faucetClaims.userId, student.id)).orderBy(asc(faucetClaims.claimedAt));
  const countMap = new Map(counts.map((item) => [item.chain, item.value]));
  return {
    role: student.role,
    signerReady: isPrivyServerWalletReady(),
    chains: configs.map((config) => ({
      chain: config.chain,
      amount: config.amount,
      maxClaims: config.maxClaims,
      claimsUsed: countMap.get(config.chain) ?? 0,
      enabled: config.enabled,
      distributorAddress: student.role === "owner" ? config.distributorAddress : undefined,
      configured: Boolean(config.distributorWalletId && config.distributorAddress),
    })),
    recent: recent.reverse().slice(0, 6),
  };
}

export async function GET(request: Request) {
  try {
    return Response.json(await stateFor(request));
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  let claimId = "";
  try {
    const { db, student } = await requireCampusUser(request);
    await ensureConfigs(db);
    const body = await request.json() as { chain?: CampusFaucetNetwork };
    const chain = body.chain;
    if (chain !== "ethereum" && chain !== "solana" && chain !== "robinhood") return Response.json({ error: "Choose a Campus Faucet network" }, { status: 400 });

    const [config] = await db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, chain)).limit(1);
    if (!config?.enabled) return Response.json({ error: "This Campus Faucet is not open yet" }, { status: 409 });
    if (!config.distributorWalletId || !config.distributorAddress || !isPrivyServerWalletReady()) {
      return Response.json({ error: "The distributor wallet is still being prepared" }, { status: 503 });
    }
    const [destination] = await db.select().from(wallets).where(and(
      eq(wallets.userId, student.id),
      eq(wallets.chain, chain === "robinhood" ? "ethereum" : chain),
      eq(wallets.isPrimary, true),
    )).limit(1);
    if (!destination) return Response.json({ error: `Your ${chain} classroom wallet is missing` }, { status: 409 });

    const [used] = await db.select({ value: count() }).from(faucetClaims).where(and(
      eq(faucetClaims.userId, student.id),
      eq(faucetClaims.chain, chain),
      inArray(faucetClaims.status, ["queued", "processing", "sent"]),
    ));
    if ((used?.value ?? 0) >= config.maxClaims) {
      const networkName = chain === "ethereum" ? "Sepolia" : chain === "solana" ? "Solana Devnet" : "Robinhood Testnet";
      return Response.json({ error: `You have used all ${config.maxClaims} ${networkName} claim${config.maxClaims === 1 ? "" : "s"}` }, { status: 409 });
    }

    const claimNumber = (used?.value ?? 0) + 1;
    claimId = crypto.randomUUID();
    await db.insert(faucetClaims).values({
      id: claimId,
      userId: student.id,
      chain,
      claimNumber,
      amount: config.amount,
      walletAddress: destination.address,
    });
    await db.update(faucetClaims).set({ status: "processing", updatedAt: new Date().toISOString() }).where(eq(faucetClaims.id, claimId));

    const transactionHash = await sendFaucetTransfer({
      chain,
      walletId: config.distributorWalletId,
      distributorAddress: config.distributorAddress,
      destination: destination.address,
      amount: config.amount,
      claimId,
    });
    await db.update(faucetClaims).set({
      status: "sent",
      transactionHash,
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(faucetClaims.id, claimId));
    return Response.json({ ok: true, chain, amount: config.amount, transactionHash });
  } catch (error) {
    if (claimId) {
      try {
        const { db } = await requireCampusUser(request);
        await db.update(faucetClaims).set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Transaction failed",
          updatedAt: new Date().toISOString(),
        }).where(eq(faucetClaims.id, claimId));
      } catch {
        // Preserve the original claim error.
      }
    }
    return faucetError(error);
  }
}
