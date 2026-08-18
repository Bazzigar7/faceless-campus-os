import { and, desc, eq } from "drizzle-orm";
import { createPublicClient, decodeFunctionData, encodeDeployData, http, isAddress, type Hex } from "viem";
import { sepolia } from "viem/chains";
import tokenArtifact from "../../../contracts/artifacts/CampusToken.json";
import { testnetTokens, tokenAirdropClaims, tokenAirdrops, tokenTransfers, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";
import { campusTokenBalances } from "../../../lib/token-ledger";

const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const solanaSignaturePattern = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [rows, transfers, airdrops, claims] = await Promise.all([
      db.select({ token: testnetTokens, creatorUsername: users.username, creatorName: users.displayName })
        .from(testnetTokens).innerJoin(users, eq(testnetTokens.userId, users.id))
        .where(eq(testnetTokens.status, "deployed")).orderBy(desc(testnetTokens.updatedAt)),
      db.select().from(tokenTransfers).orderBy(desc(tokenTransfers.createdAt)),
      db.select().from(tokenAirdrops),
      db.select().from(tokenAirdropClaims),
    ]);
    return Response.json({
      tokens: rows.map(({ token, creatorUsername, creatorName }) => {
        const balances = campusTokenBalances(token, transfers, airdrops, claims);
        return {
          ...token,
          creator: { username: creatorUsername, displayName: creatorName },
          owned: (balances.get(student.id) ?? 0n).toString(),
          holders: [...balances.values()].filter((balance) => balance > 0n).length,
          transferCount: transfers.filter((transfer) => transfer.tokenId === token.id).length,
        };
      }),
      recentTransfers: transfers.filter((transfer) => transfer.fromUserId === student.id || transfer.toUserId === student.id).slice(0, 12),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);

    if (action === "prepare") {
      const chain = clean(body.chain, 20) === "solana" ? "solana" : "ethereum";
      const creatorAddress = clean(body.creatorAddress, 64);
      if (chain === "ethereum" ? !isAddress(creatorAddress) : !solanaAddressPattern.test(creatorAddress)) {
        return Response.json({ error: `Connect your Campus ${chain === "ethereum" ? "Ethereum" : "Solana"} wallet` }, { status: 400 });
      }
      const [campusWallet] = await db.select().from(wallets).where(and(eq(wallets.userId, student.id), eq(wallets.chain, chain), eq(wallets.address, creatorAddress))).limit(1);
      if (!campusWallet) return Response.json({ error: "Use a wallet linked to your Campus profile" }, { status: 403 });
      const name = clean(body.name, 80);
      const symbol = clean(body.symbol, 10).toUpperCase();
      const description = clean(body.description, 600);
      const purpose = clean(body.purpose, 240);
      const supply = clean(body.supply, 20);
      const decimals = Number(body.decimals);
      const authorityMode = body.authorityMode === "revoke" ? "revoke" : "keep";
      if (!name || !symbol || !description || !purpose || !/^\d+$/.test(supply)) return Response.json({ error: "Complete the token details first" }, { status: 400 });
      const totalSupply = BigInt(supply);
      if (totalSupply < 1n || totalSupply > 1_000_000_000n) return Response.json({ error: "Supply must be between 1 and 1 billion tokens" }, { status: 400 });
      const maxDecimals = chain === "ethereum" ? 18 : 9;
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > maxDecimals) return Response.json({ error: `Decimals must be between 0 and ${maxDecimals}` }, { status: 400 });
      const tokenId = crypto.randomUUID();
      await db.insert(testnetTokens).values({
        id: tokenId, userId: student.id, chain, network: chain === "ethereum" ? "sepolia" : "solana_devnet",
        standard: chain === "ethereum" ? "erc20" : "spl", name, symbol, description, purpose,
        totalSupply: totalSupply.toString(), decimals, authorityMode, creatorAddress,
      });
      if (chain === "solana") return Response.json({ tokenId, network: "Solana Devnet", standard: "SPL" });
      const deploymentData = encodeDeployData({
        abi: tokenArtifact.abi,
        bytecode: tokenArtifact.bytecode as Hex,
        args: [name, symbol, decimals, totalSupply, creatorAddress, authorityMode === "keep"],
      });
      return Response.json({ tokenId, deploymentData, network: "Sepolia", standard: "ERC-20" });
    }

    if (action === "record_deploy") {
      const tokenId = clean(body.tokenId, 80);
      const [token] = await db.select().from(testnetTokens).where(and(eq(testnetTokens.id, tokenId), eq(testnetTokens.userId, student.id))).limit(1);
      if (!token) return Response.json({ error: "Token draft not found" }, { status: 404 });
      const transactionHash = clean(body.transactionHash, 100);
      const tokenAddress = clean(body.tokenAddress, 64);
      const creatorTokenAccount = clean(body.creatorTokenAccount, 64);
      if (token.chain === "ethereum") {
        if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash) || !isAddress(tokenAddress)) return Response.json({ error: "Invalid Sepolia deployment receipt" }, { status: 400 });
        const receipt = await sepoliaClient.getTransactionReceipt({ hash: transactionHash as Hex });
        if (receipt.status !== "success" || receipt.contractAddress?.toLowerCase() !== tokenAddress.toLowerCase() || receipt.from.toLowerCase() !== token.creatorAddress.toLowerCase()) return Response.json({ error: "The Sepolia deployment does not match this Campus token" }, { status: 400 });
      } else if (!solanaSignaturePattern.test(transactionHash) || !solanaAddressPattern.test(tokenAddress) || !solanaAddressPattern.test(creatorTokenAccount)) {
        return Response.json({ error: "Invalid Solana Devnet token receipt" }, { status: 400 });
      }
      await db.update(testnetTokens).set({ status: "deployed", deployTxHash: transactionHash, tokenAddress, creatorTokenAccount: creatorTokenAccount || null, updatedAt: new Date().toISOString() }).where(eq(testnetTokens.id, token.id));
      return Response.json({ ok: true });
    }

    if (action === "record_transfer") {
      const tokenId = clean(body.tokenId, 80);
      const [token] = await db.select().from(testnetTokens).where(and(eq(testnetTokens.id, tokenId), eq(testnetTokens.status, "deployed"))).limit(1);
      if (!token?.tokenAddress) return Response.json({ error: "This token is not live" }, { status: 404 });
      const toUsername = clean(body.toUsername, 24).toLowerCase();
      const [recipient] = await db.select().from(users).where(and(eq(users.username, toUsername), eq(users.status, "active"))).limit(1);
      if (!recipient || recipient.id === student.id) return Response.json({ error: "Choose another active Campus username" }, { status: 400 });
      const amountText = clean(body.amount, 20);
      if (!/^\d+$/.test(amountText) || BigInt(amountText) < 1n) return Response.json({ error: "Send at least 1 whole token" }, { status: 400 });
      const [transfers, airdrops, claims] = await Promise.all([
        db.select().from(tokenTransfers).where(eq(tokenTransfers.tokenId, token.id)),
        db.select().from(tokenAirdrops).where(eq(tokenAirdrops.tokenId, token.id)),
        db.select().from(tokenAirdropClaims),
      ]);
      const owned = campusTokenBalances(token, transfers, airdrops, claims).get(student.id) ?? 0n;
      if (BigInt(amountText) > owned) return Response.json({ error: `You have ${owned.toString()} ${token.symbol}` }, { status: 400 });
      const fromAddress = clean(body.fromAddress, 64);
      const toAddress = clean(body.toAddress, 64);
      const transactionHash = clean(body.transactionHash, 100);
      const [senderWallet] = await db.select().from(wallets).where(and(eq(wallets.userId, student.id), eq(wallets.chain, token.chain), eq(wallets.address, fromAddress))).limit(1);
      const [recipientWallet] = await db.select().from(wallets).where(and(eq(wallets.userId, recipient.id), eq(wallets.chain, token.chain), eq(wallets.address, toAddress))).limit(1);
      if (!senderWallet || !recipientWallet) return Response.json({ error: "The Campus wallet addresses do not match these students" }, { status: 403 });
      if (token.chain === "ethereum") {
        if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return Response.json({ error: "Invalid Sepolia transfer receipt" }, { status: 400 });
        const [receipt, transaction] = await Promise.all([sepoliaClient.getTransactionReceipt({ hash: transactionHash as Hex }), sepoliaClient.getTransaction({ hash: transactionHash as Hex })]);
        if (receipt.status !== "success" || transaction.from.toLowerCase() !== fromAddress.toLowerCase() || transaction.to?.toLowerCase() !== token.tokenAddress.toLowerCase()) return Response.json({ error: "The transfer does not match this token and sender" }, { status: 400 });
        const decoded = decodeFunctionData({ abi: tokenArtifact.abi, data: transaction.input });
        const args = decoded.args as readonly [string, bigint] | undefined;
        if (decoded.functionName !== "transfer" || args?.[0]?.toLowerCase() !== toAddress.toLowerCase() || args?.[1] !== BigInt(amountText) * (10n ** BigInt(token.decimals))) return Response.json({ error: "The on-chain token amount or recipient does not match" }, { status: 400 });
      } else if (!solanaSignaturePattern.test(transactionHash) || !solanaAddressPattern.test(fromAddress) || !solanaAddressPattern.test(toAddress)) {
        return Response.json({ error: "Invalid Solana Devnet transfer receipt" }, { status: 400 });
      }
      await db.insert(tokenTransfers).values({ id: crypto.randomUUID(), tokenId: token.id, fromUserId: student.id, toUserId: recipient.id, fromAddress, toAddress, amount: amountText, transactionHash }).onConflictDoNothing();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Choose a token action" }, { status: 400 });
  } catch (error) {
    return faucetError(error);
  }
}
