import { and, desc, eq, or } from "drizzle-orm";
import { createPublicClient, http, isAddress, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { getDb } from "../../../db";
import { marketPurchases, testnetLaunches, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
const editionBalanceAbi = [{
  type: "function",
  name: "balanceOf",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }],
  outputs: [{ name: "", type: "uint256" }],
}] as const;

async function publicCollections() {
  const db = getDb();
  const rows = await db.select({
    launch: testnetLaunches,
    creatorUsername: users.username,
    creatorName: users.displayName,
  }).from(testnetLaunches)
    .innerJoin(users, eq(testnetLaunches.userId, users.id))
    .where(and(
      or(eq(testnetLaunches.status, "deployed"), eq(testnetLaunches.status, "minted")),
      eq(users.status, "active"),
    ))
    .orderBy(desc(testnetLaunches.updatedAt));
  const purchases = await db.select().from(marketPurchases);
  const purchasedByCollection = purchases.reduce<Record<string, number>>((totals, purchase) => {
    totals[purchase.collectionId] = (totals[purchase.collectionId] ?? 0) + purchase.quantity;
    return totals;
  }, {});
  return { rows, purchasedByCollection };
}

export async function GET(request: Request) {
  try {
    const { rows, purchasedByCollection } = await publicCollections();
    const origin = new URL(request.url).origin;
    return Response.json({
      collections: rows.flatMap(({ launch, creatorUsername, creatorName }) => {
        if (!launch.contractAddress || !launch.deployTxHash) return [];
        return [{
          id: launch.id,
          chain: launch.chain,
          network: launch.network,
          standard: launch.standard.toUpperCase(),
          name: launch.name,
          symbol: launch.symbol,
          description: launch.description,
          purpose: launch.purpose,
          maxSupply: launch.maxSupply,
          minted: (launch.status === "minted" ? 1 : 0) + (purchasedByCollection[launch.id] ?? 0),
          mintPrice: launch.mintPrice,
          royaltyPercent: launch.royaltyBps / 100,
          creator: { username: creatorUsername, displayName: creatorName },
          creatorAddress: launch.creatorAddress,
          contractAddress: launch.contractAddress,
          assetAddress: launch.assetAddress,
          image: `${origin}/api/launch/artwork/${launch.id}`,
          metadata: `${origin}/api/launch/metadata/${launch.id}`,
          deployTransactionHash: launch.deployTxHash,
          primarySaleReady: launch.chain === "ethereum",
          updatedAt: launch.updatedAt,
        }];
      }),
    }, { headers: { "cache-control": "public, max-age=15" } });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as { collectionId?: string; transactionHash?: string; buyerAddress?: string };
    const collectionId = String(body.collectionId || "").trim().slice(0, 80);
    const transactionHash = String(body.transactionHash || "").trim();
    const buyerAddress = String(body.buyerAddress || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash) || !isAddress(buyerAddress)) {
      return Response.json({ error: "The Sepolia purchase receipt is invalid" }, { status: 400 });
    }
    const [collection] = await db.select().from(testnetLaunches).where(and(
      eq(testnetLaunches.id, collectionId),
      eq(testnetLaunches.chain, "ethereum"),
    )).limit(1);
    if (!collection?.contractAddress || !isAddress(collection.contractAddress)) {
      return Response.json({ error: "This collection is not available for Sepolia minting" }, { status: 404 });
    }
    const [campusWallet] = await db.select().from(wallets).where(and(
      eq(wallets.userId, student.id),
      eq(wallets.chain, "ethereum"),
      eq(wallets.address, buyerAddress),
    )).limit(1);
    if (!campusWallet) return Response.json({ error: "Use your connected Campus Ethereum wallet" }, { status: 403 });

    const receipt = await sepoliaClient.getTransactionReceipt({ hash: transactionHash as Hex });
    const transaction = await sepoliaClient.getTransaction({ hash: transactionHash as Hex });
    if (receipt.status !== "success" || transaction.to?.toLowerCase() !== collection.contractAddress.toLowerCase() || transaction.from.toLowerCase() !== buyerAddress.toLowerCase()) {
      return Response.json({ error: "The on-chain purchase does not match this collection and wallet" }, { status: 400 });
    }
    const owned = await sepoliaClient.readContract({
      address: collection.contractAddress as Hex,
      abi: editionBalanceAbi,
      functionName: "balanceOf",
      args: [buyerAddress as Hex, 1n],
    });
    if (owned < 1n) return Response.json({ error: "The NFT has not reached your Campus wallet yet" }, { status: 409 });
    await db.insert(marketPurchases).values({
      id: crypto.randomUUID(),
      collectionId,
      buyerUserId: student.id,
      buyerAddress,
      quantity: 1,
      transactionHash,
    }).onConflictDoNothing();
    return Response.json({ ok: true, owned: owned.toString() });
  } catch (error) {
    return faucetError(error);
  }
}
