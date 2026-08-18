import { desc, eq } from "drizzle-orm";
import {
  campusTransactionQueues, classroomSessionActivity, classroomSessions, faucetClaims, lessonProgress, marketPurchases,
  rwaAssets, rwaHoldings, testnetLaunches, testnetTokens, tokenAirdropClaims, tokenAirdrops,
  tokenTransfers, users, wallets,
} from "../../../../db/schema";
import { faucetError, requireOwner } from "../../../../lib/faucet-auth";

type Quest = "fund_wallets" | "send_token" | "mint_nft" | "buy_rwa" | "launch_token";
const quests: Quest[] = ["fund_wallets", "send_token", "mint_nft", "buy_rwa", "launch_token"];

async function snapshot(request: Request) {
  const { db } = await requireOwner(request);
  const [studentRows, walletRows, lessonRows, claimRows, launchRows, tokenRows, transferRows, purchaseRows, holdingRows, rwaRows, airdropRows, airdropClaimRows, queueRows, sessionRows, activityRows] = await Promise.all([
    db.select().from(users).where(eq(users.status, "active")).orderBy(desc(users.createdAt)),
    db.select().from(wallets), db.select().from(lessonProgress), db.select().from(faucetClaims),
    db.select().from(testnetLaunches), db.select().from(testnetTokens), db.select().from(tokenTransfers),
    db.select().from(marketPurchases), db.select().from(rwaHoldings), db.select().from(rwaAssets),
    db.select().from(tokenAirdrops), db.select().from(tokenAirdropClaims), db.select().from(campusTransactionQueues),
    db.select().from(classroomSessions).orderBy(desc(classroomSessions.startedAt)),
    db.select().from(classroomSessionActivity),
  ]);
  const students = studentRows.filter((row) => row.role !== "owner");
  const roster = students.map((student) => {
    const ownWallets = walletRows.filter((row) => row.userId === student.id);
    const ownClaims = claimRows.filter((row) => row.userId === student.id);
    const ownLaunches = launchRows.filter((row) => row.userId === student.id);
    const ownTokens = tokenRows.filter((row) => row.userId === student.id);
    const issues: string[] = [];
    if (!ownWallets.some((row) => row.chain === "ethereum")) issues.push("Ethereum wallet missing");
    if (!ownWallets.some((row) => row.chain === "solana")) issues.push("Solana wallet missing");
    if (ownClaims.some((row) => row.status === "failed")) issues.push("Faucet claim failed");
    if (ownLaunches.some((row) => row.status === "failed")) issues.push("NFT launch needs help");
    if (airdropClaimRows.some((row) => row.userId === student.id && row.status === "failed")) issues.push("Airdrop claim failed");
    return {
      id: student.id, username: student.username, displayName: student.displayName, email: student.email,
      ethereumReady: ownWallets.some((row) => row.chain === "ethereum"),
      solanaReady: ownWallets.some((row) => row.chain === "solana"),
      lessonsCompleted: lessonRows.filter((row) => row.userId === student.id && row.status === "completed").length,
      ethFunded: ownClaims.some((row) => row.chain === "ethereum" && row.status === "sent"),
      solFunded: ownClaims.some((row) => row.chain === "solana" && row.status === "sent"),
      assetsCreated: ownLaunches.filter((row) => row.status === "deployed" || row.status === "minted").length + ownTokens.filter((row) => row.status === "deployed").length + rwaRows.filter((row) => row.creatorUserId === student.id).length,
      issues,
      sessionStatus: null as "working" | "needs_help" | "completed" | null,
      proofLabel: null as string | null,
    };
  });
  const currentSession = sessionRows.find((row) => row.status === "live") ?? null;
  if (currentSession) roster.forEach((student) => {
    const activity = activityRows.find((row) => row.sessionId === currentSession.id && row.userId === student.id);
    student.sessionStatus = activity?.status ?? null;
    student.proofLabel = activity?.proofLabel ?? null;
  });
  const sessionProgress = currentSession ? roster.filter((student) => {
    if (currentSession.quest === "fund_wallets") return student.ethFunded || student.solFunded;
    if (currentSession.quest === "send_token") return transferRows.some((row) => row.fromUserId === student.id);
    if (currentSession.quest === "mint_nft") return purchaseRows.some((row) => row.buyerUserId === student.id) || launchRows.some((row) => row.userId === student.id && row.status === "minted");
    if (currentSession.quest === "buy_rwa") return holdingRows.some((row) => row.userId === student.id && row.units > 0);
    return tokenRows.some((row) => row.userId === student.id && row.status === "deployed");
  }).length : 0;
  const alerts = roster.flatMap((student) => [
    ...student.issues.map((message) => ({ userId: student.id, username: student.username, message })),
    ...(student.sessionStatus === "needs_help" ? [{ userId: student.id, username: student.username, message: "Asked for help with the live quest" }] : []),
  ]);
  const sentClaims = claimRows.filter((row) => row.status === "sent");
  const recentSessions = sessionRows.filter((row) => row.status === "ended").slice(0, 8).map((session) => {
    const records = activityRows.filter((row) => row.sessionId === session.id);
    return { id: session.id, title: session.title, quest: session.quest, startedAt: session.startedAt, endedAt: session.endedAt, completed: records.filter((row) => row.status === "completed").length, participated: records.length, needsHelp: records.filter((row) => row.status === "needs_help").length };
  });
  return {
    metrics: {
      activeStudents: roster.length,
      bothWallets: roster.filter((row) => row.ethereumReady && row.solanaReady).length,
      lessonsCompleted: lessonRows.filter((row) => row.status === "completed").length,
      onchainActions: sentClaims.length + launchRows.filter((row) => row.status === "minted").length + tokenRows.filter((row) => row.status === "deployed").length + transferRows.length + purchaseRows.length,
      nftCollections: launchRows.filter((row) => row.status === "deployed" || row.status === "minted").length,
      tokens: tokenRows.filter((row) => row.status === "deployed").length,
      rwas: rwaRows.filter((row) => row.status === "active").length,
      openAirdrops: airdropRows.filter((row) => row.status === "open").length,
    },
    roster, alerts, queues: queueRows, currentSession,
    sessionProgress: currentSession ? roster.filter((student) => student.sessionStatus === "completed").length : sessionProgress,
    sessionWorking: currentSession ? roster.filter((student) => student.sessionStatus === "working").length : 0,
    sessionNeedsHelp: currentSession ? roster.filter((student) => student.sessionStatus === "needs_help").length : 0,
    recentSessions,
  };
}

export async function GET(request: Request) {
  try { return Response.json(await snapshot(request)); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireOwner(request);
    const body = await request.json() as { action?: string; title?: string; quest?: Quest; instructions?: string };
    const now = new Date().toISOString();
    await db.update(classroomSessions).set({ status: "ended", endedAt: now }).where(eq(classroomSessions.status, "live"));
    if (body.action === "start_session") {
      if (!body.quest || !quests.includes(body.quest)) return Response.json({ error: "Choose a valid classroom quest" }, { status: 400 });
      const title = String(body.title || "Live classroom quest").trim().slice(0, 80);
      const instructions = String(body.instructions || "Follow the steps in Campus OS and ask if you get stuck.").trim().slice(0, 280);
      await db.insert(classroomSessions).values({ id: crypto.randomUUID(), title, quest: body.quest, instructions, openedBy: student.id, startedAt: now });
    } else if (body.action !== "end_session") {
      return Response.json({ error: "Choose a valid classroom action" }, { status: 400 });
    }
    return Response.json(await snapshot(request));
  } catch (error) { return faucetError(error); }
}
