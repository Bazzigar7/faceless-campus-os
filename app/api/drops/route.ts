import { and, desc, eq, inArray } from "drizzle-orm";
import { campaignSubmissions, classroomSessionActivity, lessonProgress, partnerDropClaims, partnerDrops, testnetLaunches, testnetTokens, tokenAirdrops } from "../../../db/schema";
import { faucetError, requireCampusUser, requireOwner } from "../../../lib/faucet-auth";

type Eligibility = "open" | "live_quest" | "lesson" | "campaign";
type RewardKind = "credential" | "token_airdrop" | "nft_mint";
const eligibilityOptions: Eligibility[] = ["open", "live_quest", "lesson", "campaign"];
const rewardKindOptions: RewardKind[] = ["credential", "token_airdrop", "nft_mint"];

async function state(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [dropRows, claimRows, airdropRows, collectionRows] = await Promise.all([
    db.select().from(partnerDrops).orderBy(desc(partnerDrops.createdAt)),
    db.select().from(partnerDropClaims).orderBy(desc(partnerDropClaims.claimedAt)),
    db.select({ airdrop: tokenAirdrops, token: testnetTokens }).from(tokenAirdrops).innerJoin(testnetTokens, eq(tokenAirdrops.tokenId, testnetTokens.id)),
    db.select().from(testnetLaunches).orderBy(desc(testnetLaunches.updatedAt)),
  ]);
  const openAirdrops = airdropRows.filter(({ airdrop }) => airdrop.status === "open");
  const mintableCollections = collectionRows.filter((collection) => Boolean(collection.contractAddress) && (collection.status === "deployed" || collection.status === "minted") && (collection.chain === "ethereum" || Boolean(collection.candyMachineAddress)));
  const rewardFor = (drop: typeof partnerDrops.$inferSelect) => {
    if (drop.rewardKind === "token_airdrop") {
      const row = airdropRows.find(({ airdrop }) => airdrop.id === drop.rewardAssetId);
      return row ? { kind: drop.rewardKind, id: row.airdrop.id, tokenId: row.token.id, label: `${row.airdrop.amountPerClaim} ${row.token.symbol}`, chain: row.token.chain, status: row.airdrop.status } : null;
    }
    if (drop.rewardKind === "nft_mint") {
      const collection = collectionRows.find((item) => item.id === drop.rewardAssetId);
      return collection ? { kind: drop.rewardKind, id: collection.id, tokenId: null, label: collection.name, chain: collection.chain, status: collection.chain === "solana" && !collection.candyMachineAddress ? "not_open" : collection.status } : null;
    }
    return { kind: "credential" as const, id: null, tokenId: null, label: drop.rewardLabel, chain: null, status: "ready" };
  };
  const visible = student.role === "owner" ? dropRows : dropRows.filter((drop) => drop.status === "live");
  return {
    role: student.role,
    drops: visible.map((drop) => ({ ...drop, reward: rewardFor(drop), claimedCount: claimRows.filter((claim) => claim.dropId === drop.id).length, ownClaim: claimRows.find((claim) => claim.dropId === drop.id && claim.userId === student.id) ?? null })),
    credentials: claimRows.filter((claim) => claim.userId === student.id).map((claim) => ({ ...claim, drop: dropRows.find((drop) => drop.id === claim.dropId) ?? null })),
    rewardOptions: student.role === "owner" ? {
      tokenAirdrops: openAirdrops.map(({ airdrop, token }) => ({ id: airdrop.id, label: `${airdrop.amountPerClaim} ${token.symbol} · ${token.chain === "ethereum" ? "Sepolia" : "Solana Devnet"}`, tokenId: token.id, chain: token.chain })),
      collections: mintableCollections.map((collection) => ({ id: collection.id, label: `${collection.name} · ${collection.chain === "ethereum" ? "Sepolia" : "Solana Devnet"}`, chain: collection.chain })),
    } : { tokenAirdrops: [], collections: [] },
  };
}

export async function GET(request: Request) {
  try { return Response.json(await state(request)); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create") {
      const { db, student } = await requireOwner(request);
      const title = String(body.title || "").trim(); const host = String(body.host || "").trim(); const description = String(body.description || "").trim();
      const eligibility = String(body.eligibility || "open") as Eligibility;
      const rewardKind = String(body.rewardKind || "credential") as RewardKind;
      const rewardAssetId = String(body.rewardAssetId || "").trim() || null;
      if (!title || !host || !description) return Response.json({ error: "Add the drop title, host and description" }, { status: 400 });
      if (!eligibilityOptions.includes(eligibility)) return Response.json({ error: "Choose valid eligibility" }, { status: 400 });
      if (!rewardKindOptions.includes(rewardKind)) return Response.json({ error: "Choose a valid reward type" }, { status: 400 });
      if (rewardKind !== "credential" && !rewardAssetId) return Response.json({ error: "Choose the onchain reward students should unlock" }, { status: 400 });
      if (rewardKind === "token_airdrop") {
        const [linked] = await db.select().from(tokenAirdrops).where(and(eq(tokenAirdrops.id, rewardAssetId || ""), eq(tokenAirdrops.status, "open"))).limit(1);
        if (!linked) return Response.json({ error: "Choose an open classroom token airdrop" }, { status: 400 });
      } else if (rewardKind === "nft_mint") {
        const [linked] = await db.select().from(testnetLaunches).where(eq(testnetLaunches.id, rewardAssetId || "")).limit(1);
        if (!linked?.contractAddress || !["deployed", "minted"].includes(linked.status) || (linked.chain === "solana" && !linked.candyMachineAddress)) return Response.json({ error: "Choose a collection with a public testnet mint" }, { status: 400 });
      }
      await db.insert(partnerDrops).values({ id: crypto.randomUUID(), title: title.slice(0, 100), host: host.slice(0, 80), description: description.slice(0, 500), rewardLabel: String(body.rewardLabel || "Campus credential").slice(0, 80), rewardKind, rewardAssetId, eligibility, maxClaims: Math.max(1, Math.min(1000, Number(body.maxClaims) || 200)), status: "live", createdBy: student.id });
      return Response.json(await state(request));
    }
    const { db, student } = await requireCampusUser(request);
    const dropId = String(body.dropId || "");
    const [drop] = await db.select().from(partnerDrops).where(eq(partnerDrops.id, dropId)).limit(1);
    if (!drop || drop.status !== "live") return Response.json({ error: "This partner drop is not open" }, { status: 404 });
    const existingClaims = await db.select().from(partnerDropClaims).where(eq(partnerDropClaims.dropId, drop.id));
    if (existingClaims.some((claim) => claim.userId === student.id)) return Response.json(await state(request));
    if (existingClaims.length >= drop.maxClaims) return Response.json({ error: "This drop has reached its claim limit" }, { status: 409 });
    let evidence = "Open Campus claim";
    if (drop.eligibility === "live_quest") {
      const rows = await db.select().from(classroomSessionActivity).where(and(eq(classroomSessionActivity.userId, student.id), eq(classroomSessionActivity.status, "completed"))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete a verified live classroom quest to unlock this drop" }, { status: 403 });
      evidence = rows[0].proofLabel ?? "Verified live quest";
    } else if (drop.eligibility === "lesson") {
      const rows = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, student.id), eq(lessonProgress.status, "completed"))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete a lesson to unlock this drop" }, { status: 403 });
      evidence = "Completed Faceless lesson";
    } else if (drop.eligibility === "campaign") {
      const rows = await db.select().from(campaignSubmissions).where(and(eq(campaignSubmissions.userId, student.id), inArray(campaignSubmissions.status, ["approved_for_payment", "paid"]))).limit(1);
      if (!rows.length) return Response.json({ error: "Complete an approved campaign to unlock this drop" }, { status: 403 });
      evidence = "Approved creator campaign";
    }
    await db.insert(partnerDropClaims).values({ id: crypto.randomUUID(), dropId: drop.id, userId: student.id, evidence });
    return Response.json(await state(request));
  } catch (error) { return faucetError(error); }
}
