import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { createPublicClient, decodeFunctionData, http, type Hex } from "viem";
import { sepolia } from "viem/chains";
import tokenArtifact from "../../../contracts/artifacts/CampusToken.json";
import { faucetConfigs, testnetTokens, tokenAirdropClaims, tokenAirdrops, tokenTransfers, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";
import { isPrivyServerWalletReady, sendTokenAirdropTransfer } from "../../../lib/privy-server-wallet";
import { campusTokenBalances } from "../../../lib/token-ledger";

const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
const solanaSignaturePattern = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [airdrops, claims] = await Promise.all([
      db.select().from(tokenAirdrops).orderBy(desc(tokenAirdrops.createdAt)),
      db.select().from(tokenAirdropClaims).orderBy(desc(tokenAirdropClaims.createdAt)),
    ]);
    return Response.json({
      airdrops: airdrops.map((airdrop) => {
        const campaignClaims = claims.filter((claim) => claim.airdropId === airdrop.id);
        const ownClaim = campaignClaims.find((claim) => claim.userId === student.id);
        return {
          id: airdrop.id,
          tokenId: airdrop.tokenId,
          amountPerClaim: airdrop.amountPerClaim,
          maxClaims: airdrop.maxClaims,
          totalAllocation: airdrop.totalAllocation,
          distributorAddress: airdrop.creatorUserId === student.id ? airdrop.distributorAddress : undefined,
          fundingTransactionHash: airdrop.fundingTransactionHash,
          status: airdrop.status,
          isCreator: airdrop.creatorUserId === student.id,
          claimedCount: campaignClaims.filter((claim) => claim.status === "sent").length,
          pendingCount: campaignClaims.filter((claim) => claim.status === "queued" || claim.status === "processing").length,
          ownClaim: ownClaim ? { status: ownClaim.status, transactionHash: ownClaim.transactionHash, errorMessage: ownClaim.errorMessage } : null,
        };
      }),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  let claimId = "";
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);

    if (action === "create") {
      const tokenId = clean(body.tokenId, 80);
      const [token] = await db.select().from(testnetTokens).where(and(eq(testnetTokens.id, tokenId), eq(testnetTokens.userId, student.id), eq(testnetTokens.status, "deployed"))).limit(1);
      if (!token?.tokenAddress) return Response.json({ error: "Only the token creator can open this airdrop" }, { status: 403 });
      const amount = clean(body.amountPerClaim, 20);
      if (!/^\d+$/.test(amount) || BigInt(amount) < 1n) return Response.json({ error: "Enter at least 1 whole token per student" }, { status: 400 });
      const [existing] = await db.select().from(tokenAirdrops).where(and(eq(tokenAirdrops.tokenId, token.id), inArray(tokenAirdrops.status, ["draft", "open"]))).limit(1);
      if (existing) return Response.json({ error: "This token already has an active airdrop" }, { status: 409 });
      const [eligibleRows, configRows, transfers, airdrops, claims] = await Promise.all([
        db.select({ value: count() }).from(users).where(and(eq(users.status, "active"), ne(users.id, student.id))),
        db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, token.chain)).limit(1),
        db.select().from(tokenTransfers).where(eq(tokenTransfers.tokenId, token.id)),
        db.select().from(tokenAirdrops).where(eq(tokenAirdrops.tokenId, token.id)),
        db.select().from(tokenAirdropClaims),
      ]);
      const maxClaims = eligibleRows[0]?.value ?? 0;
      if (maxClaims < 1) return Response.json({ error: "At least one other verified student must join before opening an airdrop" }, { status: 409 });
      const config = configRows[0];
      if (!config?.distributorAddress || !config.distributorWalletId || !isPrivyServerWalletReady()) return Response.json({ error: "The Campus testnet vault for this network is not prepared yet" }, { status: 503 });
      const totalAllocation = BigInt(amount) * BigInt(maxClaims);
      const owned = campusTokenBalances(token, transfers, airdrops, claims).get(student.id) ?? 0n;
      if (totalAllocation > owned) return Response.json({ error: `You need ${totalAllocation.toString()} ${token.symbol}, but you currently have ${owned.toString()}` }, { status: 400 });
      const id = crypto.randomUUID();
      await db.insert(tokenAirdrops).values({ id, tokenId: token.id, creatorUserId: student.id, amountPerClaim: amount, maxClaims, totalAllocation: totalAllocation.toString(), distributorAddress: config.distributorAddress });
      return Response.json({ id, distributorAddress: config.distributorAddress, totalAllocation: totalAllocation.toString(), maxClaims });
    }

    if (action === "record_funding") {
      const airdropId = clean(body.airdropId, 80);
      const [row] = await db.select({ airdrop: tokenAirdrops, token: testnetTokens }).from(tokenAirdrops)
        .innerJoin(testnetTokens, eq(tokenAirdrops.tokenId, testnetTokens.id))
        .where(and(eq(tokenAirdrops.id, airdropId), eq(tokenAirdrops.creatorUserId, student.id), eq(tokenAirdrops.status, "draft"))).limit(1);
      if (!row?.token.tokenAddress) return Response.json({ error: "Airdrop draft not found" }, { status: 404 });
      const transactionHash = clean(body.transactionHash, 100);
      const fromAddress = clean(body.fromAddress, 64);
      const [senderWallet] = await db.select().from(wallets).where(and(eq(wallets.userId, student.id), eq(wallets.chain, row.token.chain), eq(wallets.address, fromAddress))).limit(1);
      if (!senderWallet) return Response.json({ error: "Fund the vault from your linked Campus wallet" }, { status: 403 });
      if (row.token.chain === "ethereum") {
        if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return Response.json({ error: "Invalid Sepolia funding receipt" }, { status: 400 });
        const [receipt, transaction] = await Promise.all([sepoliaClient.getTransactionReceipt({ hash: transactionHash as Hex }), sepoliaClient.getTransaction({ hash: transactionHash as Hex })]);
        const decoded = decodeFunctionData({ abi: tokenArtifact.abi, data: transaction.input });
        const args = decoded.args as readonly [string, bigint] | undefined;
        const units = BigInt(row.airdrop.totalAllocation) * (10n ** BigInt(row.token.decimals));
        if (receipt.status !== "success" || transaction.from.toLowerCase() !== fromAddress.toLowerCase() || transaction.to?.toLowerCase() !== row.token.tokenAddress.toLowerCase() || decoded.functionName !== "transfer" || args?.[0]?.toLowerCase() !== row.airdrop.distributorAddress.toLowerCase() || args?.[1] !== units) {
          return Response.json({ error: "The on-chain vault funding does not match this airdrop" }, { status: 400 });
        }
      } else if (!solanaSignaturePattern.test(transactionHash)) {
        return Response.json({ error: "Invalid Solana Devnet funding receipt" }, { status: 400 });
      }
      await db.update(tokenAirdrops).set({ status: "open", fundingTransactionHash: transactionHash, updatedAt: new Date().toISOString() }).where(eq(tokenAirdrops.id, row.airdrop.id));
      return Response.json({ ok: true });
    }

    if (action === "claim") {
      const airdropId = clean(body.airdropId, 80);
      const [row] = await db.select({ airdrop: tokenAirdrops, token: testnetTokens }).from(tokenAirdrops)
        .innerJoin(testnetTokens, eq(tokenAirdrops.tokenId, testnetTokens.id))
        .where(and(eq(tokenAirdrops.id, airdropId), eq(tokenAirdrops.status, "open"))).limit(1);
      if (!row?.token.tokenAddress) return Response.json({ error: "This airdrop is not open" }, { status: 409 });
      if (row.airdrop.creatorUserId === student.id) return Response.json({ error: "The creator funded this drop for other students" }, { status: 400 });
      const [configRows, destinationRows, sentCountRows, existingRows] = await Promise.all([
        db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, row.token.chain)).limit(1),
        db.select().from(wallets).where(and(eq(wallets.userId, student.id), eq(wallets.chain, row.token.chain), eq(wallets.isPrimary, true))).limit(1),
        db.select({ value: count() }).from(tokenAirdropClaims).where(and(eq(tokenAirdropClaims.airdropId, row.airdrop.id), inArray(tokenAirdropClaims.status, ["queued", "processing", "sent"]))),
        db.select().from(tokenAirdropClaims).where(and(eq(tokenAirdropClaims.airdropId, row.airdrop.id), eq(tokenAirdropClaims.userId, student.id))).limit(1),
      ]);
      const config = configRows[0];
      const destination = destinationRows[0];
      const sentCount = sentCountRows[0];
      const existing = existingRows[0];
      if (existing && existing.status !== "failed") return Response.json({ error: existing.status === "sent" ? "You already claimed this airdrop" : "Your claim is already being processed" }, { status: 409 });
      if ((sentCount?.value ?? 0) >= row.airdrop.maxClaims) return Response.json({ error: "This classroom airdrop is fully claimed" }, { status: 409 });
      if (!config?.distributorWalletId || !config.distributorAddress || !destination) return Response.json({ error: "Your Campus wallet or the secure vault is unavailable" }, { status: 503 });
      claimId = existing?.id ?? crypto.randomUUID();
      if (existing) {
        await db.update(tokenAirdropClaims).set({ status: "processing", errorMessage: null, updatedAt: new Date().toISOString() }).where(eq(tokenAirdropClaims.id, existing.id));
      } else {
        await db.insert(tokenAirdropClaims).values({ id: claimId, airdropId: row.airdrop.id, userId: student.id, walletAddress: destination.address, amount: row.airdrop.amountPerClaim, status: "processing" });
      }
      const transactionHash = await sendTokenAirdropTransfer({
        chain: row.token.chain,
        walletId: config.distributorWalletId,
        distributorAddress: config.distributorAddress,
        tokenAddress: row.token.tokenAddress,
        destination: destination.address,
        amount: row.airdrop.amountPerClaim,
        decimals: row.token.decimals,
        claimId,
      });
      await db.update(tokenAirdropClaims).set({ status: "sent", transactionHash, updatedAt: new Date().toISOString() }).where(eq(tokenAirdropClaims.id, claimId));
      const completed = (sentCount?.value ?? 0) + 1;
      if (completed >= row.airdrop.maxClaims) await db.update(tokenAirdrops).set({ status: "exhausted", updatedAt: new Date().toISOString() }).where(eq(tokenAirdrops.id, row.airdrop.id));
      return Response.json({ ok: true, transactionHash });
    }

    return Response.json({ error: "Choose an airdrop action" }, { status: 400 });
  } catch (error) {
    if (claimId) {
      try {
        const { db } = await requireCampusUser(request);
        await db.update(tokenAirdropClaims).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Claim failed", updatedAt: new Date().toISOString() }).where(eq(tokenAirdropClaims.id, claimId));
      } catch {
        // Preserve the original claim error.
      }
    }
    return faucetError(error);
  }
}
