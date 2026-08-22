import { and, eq } from "drizzle-orm";
import { createPublicClient, http, isAddress, stringToHex, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { lessonProgress, wallets, xpProofs } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });
const LESSON_XP = 20;
const courses = new Set(["blockchain", "bitcoin", "ethereum"]);

function missionKey(course: string, lessonId: number) {
  return `lesson:${course}:${lessonId}`;
}

async function listProofs(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const proofs = await db.select().from(xpProofs).where(and(eq(xpProofs.userId, student.id), eq(xpProofs.status, "verified")));
  return { db, student, proofs };
}

export async function GET(request: Request) {
  try {
    const { proofs } = await listProofs(request);
    return Response.json({ proofs, lessonXp: LESSON_XP }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student, proofs } = await listProofs(request);
    const body = await request.json() as { course?: string; lessonId?: number; walletAddress?: string; transactionHash?: string };
    const course = body.course?.trim().toLowerCase() ?? "";
    const lessonId = Number(body.lessonId);
    const walletAddress = body.walletAddress?.trim() ?? "";
    const transactionHash = body.transactionHash?.trim() ?? "";
    if (!courses.has(course) || !Number.isInteger(lessonId) || lessonId < 1) return Response.json({ error: "Choose a completed lesson" }, { status: 400 });
    if (!isAddress(walletAddress) || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return Response.json({ error: "The wallet proof is incomplete" }, { status: 400 });

    const key = missionKey(course, lessonId);
    if (proofs.some((proof) => proof.missionKey === key)) return Response.json({ proofs, lessonXp: LESSON_XP });
    const [completed] = await db.select().from(lessonProgress).where(and(
      eq(lessonProgress.userId, student.id),
      eq(lessonProgress.course, course as "blockchain" | "bitcoin" | "ethereum"),
      eq(lessonProgress.lessonId, lessonId),
      eq(lessonProgress.status, "completed"),
    )).limit(1);
    if (!completed) return Response.json({ error: "Complete the lesson before signing its XP proof" }, { status: 409 });
    const campusWallets = await db.select().from(wallets).where(and(
      eq(wallets.userId, student.id),
      eq(wallets.chain, "ethereum"),
    ));
    const campusWallet = campusWallets.find((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase());
    if (!campusWallet) return Response.json({ error: "Use your Campus Ethereum wallet for this XP proof" }, { status: 403 });

    const receipt = await sepoliaClient.getTransactionReceipt({ hash: transactionHash as Hex });
    const transaction = await sepoliaClient.getTransaction({ hash: transactionHash as Hex });
    const expectedData = stringToHex(`FACELESS_XP|${key}`).toLowerCase();
    if (receipt.status !== "success" || transaction.from.toLowerCase() !== walletAddress.toLowerCase() || transaction.to?.toLowerCase() !== walletAddress.toLowerCase() || transaction.input.toLowerCase() !== expectedData) {
      return Response.json({ error: "This Sepolia transaction does not match the lesson XP proof" }, { status: 400 });
    }
    await db.insert(xpProofs).values({
      id: crypto.randomUUID(), userId: student.id, missionKey: key, missionType: "lesson", chain: "ethereum",
      walletAddress, transactionHash, xpAmount: LESSON_XP, status: "verified",
    }).onConflictDoNothing();
    const saved = await db.select().from(xpProofs).where(and(eq(xpProofs.userId, student.id), eq(xpProofs.status, "verified")));
    return Response.json({ proofs: saved, lessonXp: LESSON_XP });
  } catch (error) {
    return faucetError(error);
  }
}
