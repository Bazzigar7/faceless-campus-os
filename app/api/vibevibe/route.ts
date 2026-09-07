import { and, eq } from "drizzle-orm";
import { createPublicClient, decodeFunctionData, http, isAddress, parseEther, type Hex } from "viem";
import { wallets, xpProofs } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const client = createPublicClient({ transport: http("https://rpc.testnet.chain.robinhood.com") });
const CURVE_ADDRESS = "0xfc714dd49efb926b9028df23916bfba94f1abd2d";
const TOKEN_ADDRESS = "0x4ac91bbf73Cc319507D0BDf3809a4979F32cc6da";
const MISSION_KEY = "campaign:vibevibe:first-buy";
const XP_AMOUNT = 50;
const buyAbi = [{ type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "minTokensOut", type: "uint256" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "tokenAmount", type: "uint256" }] }] as const;

async function context(request: Request) {
  const result = await requireCampusUser(request);
  const [proof] = await result.db.select().from(xpProofs).where(and(eq(xpProofs.userId, result.student.id), eq(xpProofs.missionKey, MISSION_KEY), eq(xpProofs.status, "verified"))).limit(1);
  return { ...result, proof: proof ?? null };
}

export async function GET(request: Request) {
  try {
    const { proof } = await context(request);
    return Response.json({ tokenAddress: TOKEN_ADDRESS, curveAddress: CURVE_ADDRESS, proof, xpAmount: XP_AMOUNT }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student, proof } = await context(request);
    if (proof) return Response.json({ proof, xpAmount: XP_AMOUNT });
    const body = await request.json() as { walletAddress?: string; transactionHash?: string };
    const walletAddress = body.walletAddress?.trim() ?? "";
    const transactionHash = body.transactionHash?.trim() ?? "";
    if (!isAddress(walletAddress) || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return Response.json({ error: "The purchase receipt is incomplete" }, { status: 400 });
    const campusWallets = await db.select().from(wallets).where(and(eq(wallets.userId, student.id), eq(wallets.chain, "ethereum")));
    if (!campusWallets.some((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase())) return Response.json({ error: "Use your Campus Ethereum wallet for this campaign" }, { status: 403 });
    const [receipt, transaction] = await Promise.all([client.getTransactionReceipt({ hash: transactionHash as Hex }), client.getTransaction({ hash: transactionHash as Hex })]);
    let functionName = "";
    try { functionName = decodeFunctionData({ abi: buyAbi, data: transaction.input }).functionName; } catch { /* handled below */ }
    const valid = receipt.status === "success" && transaction.from.toLowerCase() === walletAddress.toLowerCase() && transaction.to?.toLowerCase() === CURVE_ADDRESS && transaction.value >= parseEther("0.01") && transaction.value <= parseEther("0.05") && functionName === "buy";
    if (!valid) return Response.json({ error: "The transaction must be a 0.01–0.05 test ETH buy of the campaign token" }, { status: 400 });
    await db.insert(xpProofs).values({ id: crypto.randomUUID(), userId: student.id, missionKey: MISSION_KEY, missionType: "campaign_buy", chain: "robinhood", walletAddress, transactionHash, xpAmount: XP_AMOUNT, status: "verified" }).onConflictDoNothing();
    const [saved] = await db.select().from(xpProofs).where(and(eq(xpProofs.userId, student.id), eq(xpProofs.missionKey, MISSION_KEY))).limit(1);
    return Response.json({ proof: saved, xpAmount: XP_AMOUNT });
  } catch (error) { return faucetError(error); }
}
