import { eq } from "drizzle-orm";
import {
  campaignSubmissions, classroomSessionActivity, cohortMembers, faucetClaims, lessonProgress, marketPurchases,
  partnerDropClaims, rwaTrades, testnetLaunches, testnetTokens, tokenAirdropClaims, tokenTransfers, users,
} from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const points = { lesson: 20, liveQuest: 50, faucet: 10, transfer: 25, nft: 40, token: 75, rwa: 30, campaign: 100, partnerDrop: 60, airdrop: 25 };
const caps = { lesson: 25, liveQuest: 20, faucet: 3, transfer: 5, nft: 5, token: 3, rwa: 10, campaign: 10, partnerDrop: 10, airdrop: 5 };

function levelFor(xp: number) {
  if (xp >= 1_000) return { level: 5, name: "Onchain Operator", nextAt: 1_500 };
  if (xp >= 600) return { level: 4, name: "Campus Creator", nextAt: 1_000 };
  if (xp >= 300) return { level: 3, name: "Testnet Builder", nextAt: 600 };
  if (xp >= 100) return { level: 2, name: "Chain Explorer", nextAt: 300 };
  return { level: 1, name: "Wallet Rookie", nextAt: 100 };
}

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [studentRows, memberRows, lessonRows, sessionRows, faucetRows, transferRows, purchaseRows, launchRows, tokenRows, rwaRows, campaignRows, dropRows, airdropRows] = await Promise.all([
      db.select().from(users).where(eq(users.status, "active")),
      db.select().from(cohortMembers),
      db.select().from(lessonProgress),
      db.select().from(classroomSessionActivity),
      db.select().from(faucetClaims),
      db.select().from(tokenTransfers),
      db.select().from(marketPurchases),
      db.select().from(testnetLaunches),
      db.select().from(testnetTokens),
      db.select().from(rwaTrades),
      db.select().from(campaignSubmissions),
      db.select().from(partnerDropClaims),
      db.select().from(tokenAirdropClaims),
    ]);
    const recordFor = (userId: string) => {
      const breakdown = {
        lessons: lessonRows.filter((row) => row.userId === userId && row.status === "completed").length,
        liveQuests: sessionRows.filter((row) => row.userId === userId && row.status === "completed").length,
        faucetClaims: faucetRows.filter((row) => row.userId === userId && row.status === "sent").length,
        tokenTransfers: transferRows.filter((row) => row.fromUserId === userId).length,
        nftMints: purchaseRows.filter((row) => row.buyerUserId === userId).length + launchRows.filter((row) => row.userId === userId && row.status === "minted").length,
        tokenLaunches: tokenRows.filter((row) => row.userId === userId && row.status === "deployed").length,
        rwaTrades: rwaRows.filter((row) => row.userId === userId).length,
        campaigns: campaignRows.filter((row) => row.userId === userId && (row.status === "approved_for_payment" || row.status === "paid")).length,
        partnerDrops: dropRows.filter((row) => row.userId === userId).length,
        airdrops: airdropRows.filter((row) => row.userId === userId && row.status === "sent").length,
      };
      const xp = Math.min(breakdown.lessons, caps.lesson) * points.lesson + Math.min(breakdown.liveQuests, caps.liveQuest) * points.liveQuest + Math.min(breakdown.faucetClaims, caps.faucet) * points.faucet + Math.min(breakdown.tokenTransfers, caps.transfer) * points.transfer + Math.min(breakdown.nftMints, caps.nft) * points.nft + Math.min(breakdown.tokenLaunches, caps.token) * points.token + Math.min(breakdown.rwaTrades, caps.rwa) * points.rwa + Math.min(breakdown.campaigns, caps.campaign) * points.campaign + Math.min(breakdown.partnerDrops, caps.partnerDrop) * points.partnerDrop + Math.min(breakdown.airdrops, caps.airdrop) * points.airdrop;
      const badges = [breakdown.lessons >= 1 && "Lesson Starter", breakdown.liveQuests >= 1 && "Live Quest", breakdown.tokenTransfers >= 1 && "Token Sender", breakdown.nftMints >= 1 && "NFT Collector", breakdown.tokenLaunches >= 1 && "Token Launcher", breakdown.rwaTrades >= 1 && "RWA Analyst", breakdown.campaigns >= 1 && "Creator Earned", breakdown.partnerDrops >= 1 && "Partner Proof"].filter(Boolean) as string[];
      return { xp, breakdown, badges, ...levelFor(xp) };
    };
    const ownMembership = memberRows.find((member) => member.userId === student.id);
    const cohortUserIds = ownMembership ? new Set(memberRows.filter((member) => member.cohortId === ownMembership.cohortId).map((member) => member.userId)) : null;
    const ranked = studentRows.filter((row) => row.role !== "owner" && (!cohortUserIds || cohortUserIds.has(row.id))).map((row) => ({ id: row.id, username: row.username, displayName: row.displayName, ...recordFor(row.id) })).sort((a, b) => b.xp - a.xp || a.username.localeCompare(b.username));
    const own = recordFor(student.id);
    const ownRank = ranked.findIndex((row) => row.id === student.id);
    const missions = [
      { id: "lesson", title: "Complete a lesson", xp: points.lesson, done: own.breakdown.lessons > 0, destination: "learn" },
      { id: "quest", title: "Verify a live class quest", xp: points.liveQuest, done: own.breakdown.liveQuests > 0, destination: "home" },
      { id: "transfer", title: "Send a classroom token", xp: points.transfer, done: own.breakdown.tokenTransfers > 0, destination: "market" },
      { id: "nft", title: "Mint a testnet NFT", xp: points.nft, done: own.breakdown.nftMints > 0, destination: "market" },
      { id: "rwa", title: "Make an RWA practice trade", xp: points.rwa, done: own.breakdown.rwaTrades > 0, destination: "market" },
      { id: "drop", title: "Claim a verified Partner Drop", xp: points.partnerDrop, done: own.breakdown.partnerDrops > 0, destination: "drops" },
    ];
    return Response.json({ own: { ...own, rank: ownRank >= 0 ? ownRank + 1 : null }, leaderboard: ranked.slice(0, 20).map((row, index) => ({ ...row, rank: index + 1 })), missions, scoring: points, caps }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return faucetError(error); }
}
