import { and, desc, eq, inArray } from "drizzle-orm";
import { cohortMembers, partnerLabMembers, partnerLabProofs, partnerLabTeams, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const CAMPAIGN_KEY = "vibevibe-robinhood-testnet-01";
const characterLibrary = new Map([
  ["lightbulb", "The Idea"], ["soccer", "The Player"], ["ethereum", "The Builder"],
  ["bitcoin", "The Believer"], ["oldmoney", "The Hustler"], ["virus", "The Rebel"],
]);
const campaign = {
  key: CAMPAIGN_KEY,
  title: "Vibevibe × Faceless Token Lab",
  partner: "Vibevibe",
  externalUrl: "https://testnet.vibevibe.fun",
  chain: "Robinhood Chain Testnet",
  chainId: 46630,
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  faucetUrl: "https://faucet.testnet.chain.robinhood.com",
  teamSize: 5,
  fixedSupply: "1,000,000,000",
  launchCostEth: "0.0005",
  raiseTargetEth: "0.005",
  tradingFeePercent: 1,
  reward: "Partner reward for the livestreamed pressure-test cohort",
  mechanicsStatus: "Complete the 0.005 test ETH bonding curve, then record the separate graduation transaction.",
};

async function labState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [teams, members, proofs, people, walletRows] = await Promise.all([
    db.select().from(partnerLabTeams).where(eq(partnerLabTeams.campaignKey, CAMPAIGN_KEY)).orderBy(desc(partnerLabTeams.createdAt)),
    db.select().from(partnerLabMembers),
    db.select().from(partnerLabProofs).orderBy(desc(partnerLabProofs.createdAt)),
    db.select().from(users),
    db.select().from(wallets).where(eq(wallets.chain, "ethereum")),
  ]);
  const person = new Map(people.map((row) => [row.id, row]));
  const address = new Map(walletRows.map((row) => [row.userId, row.address]));
  const visibleTeams = student.role === "owner" ? teams : teams.filter((team) => members.some((member) => member.teamId === team.id && member.userId === student.id));
  const shapedTeams = visibleTeams.map((team) => {
    const teamMembers = members.filter((member) => member.teamId === team.id).map((member) => ({
      ...member,
      username: person.get(member.userId)?.username ?? "student",
      displayName: person.get(member.userId)?.displayName ?? "Campus student",
      walletAddress: address.get(member.userId) ?? null,
      proofs: proofs.filter((proof) => proof.teamId === team.id && proof.userId === member.userId),
    }));
    const accepted = teamMembers.filter((member) => member.status === "accepted");
    const launchProof = proofs.some((proof) => proof.teamId === team.id && proof.proofType === "launch");
    const buyerProofs = new Set(proofs.filter((proof) => proof.teamId === team.id && proof.proofType === "buy").map((proof) => proof.userId)).size;
    const sellProof = proofs.some((proof) => proof.teamId === team.id && proof.proofType === "sell");
    const graduated = Boolean(team.graduationTxHash) || proofs.some((proof) => proof.teamId === team.id && proof.proofType === "graduation");
    const feedbackSubmitted = Boolean(team.feedbackSubmittedAt);
    return { ...team, members: teamMembers, progress: { accepted: accepted.length, launchProof, buyerProofs, sellProof, curveProgressBps: team.curveProgressBps, graduated, feedbackSubmitted, readyForReview: accepted.length === 5 && launchProof && buyerProofs >= 4 && sellProof && team.curveProgressBps >= 10000 && graduated && feedbackSubmitted } };
  });
  return { role: student.role, ownUserId: student.id, campaign, teams: shapedTeams, reviewQueue: student.role === "owner" ? shapedTeams.filter((team) => team.progress.readyForReview && team.status !== "verified") : [] };
}

export async function GET(request: Request) {
  try { return Response.json(await labState(request), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "create_team") {
      const [membership] = await db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)).limit(1);
      if (!membership) return Response.json({ error: "Join your Campus cohort before forming a partner-lab team" }, { status: 409 });
      const existingMemberships = await db.select().from(partnerLabMembers);
      if (existingMemberships.some((row) => row.userId === student.id)) return Response.json({ error: "You already belong to a Vibevibe lab team" }, { status: 409 });
      const inviteNames = Array.from(new Set((Array.isArray(body.inviteUsernames) ? body.inviteUsernames : []).map((value) => String(value).replace(/^@/, "").trim().toLowerCase()).filter(Boolean))).slice(0, 4);
      if (inviteNames.length !== 4) return Response.json({ error: "Add exactly four Campus usernames to make a five-person team" }, { status: 400 });
      const cohortRows = await db.select().from(cohortMembers).where(eq(cohortMembers.cohortId, membership.cohortId));
      const cohortIds = cohortRows.map((row) => row.userId);
      const invitees = cohortIds.length ? await db.select().from(users).where(inArray(users.id, cohortIds)) : [];
      const selected = inviteNames.map((name) => invitees.find((person) => person.username.toLowerCase() === name)).filter((person): person is typeof invitees[number] => Boolean(person));
      if (selected.length !== 4) return Response.json({ error: "Every teammate must be an active student in your Campus cohort" }, { status: 400 });
      if (selected.some((person) => existingMemberships.some((row) => row.userId === person.id))) return Response.json({ error: "One of those students already belongs to another Vibevibe team" }, { status: 409 });
      const teamId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(partnerLabTeams).values({ id: teamId, campaignKey: CAMPAIGN_KEY, name: String(body.name || `${student.username}'s team`).slice(0, 60), launcherUserId: student.id, createdAt: now, updatedAt: now });
      await db.insert(partnerLabMembers).values([{ id: crypto.randomUUID(), teamId, userId: student.id, role: "launcher", status: "accepted", joinedAt: now }, ...selected.map((person) => ({ id: crypto.randomUUID(), teamId, userId: person.id, role: "market_tester" as const, status: "invited" as const, joinedAt: now }))]);
    } else {
      const teamId = String(body.teamId || "");
      const [team] = await db.select().from(partnerLabTeams).where(and(eq(partnerLabTeams.id, teamId), eq(partnerLabTeams.campaignKey, CAMPAIGN_KEY))).limit(1);
      if (!team) return Response.json({ error: "Partner-lab team not found" }, { status: 404 });
      const [membership] = await db.select().from(partnerLabMembers).where(and(eq(partnerLabMembers.teamId, teamId), eq(partnerLabMembers.userId, student.id))).limit(1);
      if (action === "accept_invite") {
        if (!membership) return Response.json({ error: "This invitation belongs to another student" }, { status: 403 });
        await db.update(partnerLabMembers).set({ status: "accepted" }).where(eq(partnerLabMembers.id, membership.id));
        const accepted = await db.select().from(partnerLabMembers).where(and(eq(partnerLabMembers.teamId, teamId), eq(partnerLabMembers.status, "accepted")));
        if (accepted.length + (membership.status === "invited" ? 1 : 0) >= 5) await db.update(partnerLabTeams).set({ status: "ready", updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
      } else if (action === "save_setup") {
        if (team.launcherUserId !== student.id) return Response.json({ error: "Only the nominated launcher can edit the token setup" }, { status: 403 });
        const tokenName = String(body.tokenName || "").trim(); const symbol = String(body.tokenSymbol || "").trim().toUpperCase();
        const characterKey = String(body.characterKey || ""); const characterName = characterLibrary.get(characterKey); const tokenPitch = String(body.tokenPitch || "").trim();
        const initialBuyEth = String(body.initialBuyEth || "0").trim();
        if (!characterName || !tokenName || !symbol || !tokenPitch) return Response.json({ error: "Choose an official character and add the token name, symbol and pitch" }, { status: 400 });
        if (!/^(0|0\.0000[123])$/.test(initialBuyEth)) return Response.json({ error: "Choose no initial buy or one of the safe Vibevibe presets" }, { status: 400 });
        await db.update(partnerLabTeams).set({ characterKey, characterName, tokenName: tokenName.slice(0, 64), tokenSymbol: symbol.slice(0, 16), tokenPitch: tokenPitch.slice(0, 280), initialBuyEth, updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
      } else if (action === "submit_launch") {
        if (team.launcherUserId !== student.id) return Response.json({ error: "Only the nominated launcher can submit the launch receipt" }, { status: 403 });
        const tokenAddress = String(body.tokenAddress || "").trim(); const tx = String(body.transactionHash || "").trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress) || !/^0x[a-fA-F0-9]{64}$/.test(tx)) return Response.json({ error: "Paste the full Robinhood testnet token address and launch transaction hash" }, { status: 400 });
        await db.update(partnerLabTeams).set({ tokenAddress, launchTxHash: tx, status: "launched", updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
        await db.insert(partnerLabProofs).values({ id: crypto.randomUUID(), teamId, userId: student.id, proofType: "launch", transactionHash: tx }).onConflictDoUpdate({ target: [partnerLabProofs.teamId, partnerLabProofs.userId, partnerLabProofs.proofType], set: { transactionHash: tx, status: "submitted", createdAt: new Date().toISOString() } });
      } else if (action === "submit_proof") {
        if (!membership || membership.status !== "accepted") return Response.json({ error: "Accept your team invitation before submitting proof" }, { status: 403 });
        const proofType = String(body.proofType || "") as "buy" | "sell";
        if (!["buy", "sell"].includes(proofType)) return Response.json({ error: "Choose a valid pressure-test proof" }, { status: 400 });
        if (proofType === "buy" && membership.role !== "market_tester") return Response.json({ error: "The four nominated market testers provide the qualifying buy proofs" }, { status: 403 });
        const tx = String(body.transactionHash || "").trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) return Response.json({ error: "Paste the full Robinhood testnet transaction hash" }, { status: 400 });
        await db.insert(partnerLabProofs).values({ id: crypto.randomUUID(), teamId, userId: student.id, proofType, transactionHash: tx }).onConflictDoUpdate({ target: [partnerLabProofs.teamId, partnerLabProofs.userId, partnerLabProofs.proofType], set: { transactionHash: tx, status: "submitted", createdAt: new Date().toISOString() } });
        await db.update(partnerLabTeams).set({ status: "testing", updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
      } else if (action === "update_curve") {
        if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner records the live bonding progress" }, { status: 403 });
        const curveProgressBps = Math.round(Number(body.curveProgressPercent) * 100);
        if (!Number.isFinite(curveProgressBps) || curveProgressBps < 0 || curveProgressBps > 10000) return Response.json({ error: "Enter bonding progress from 0 to 100%" }, { status: 400 });
        await db.update(partnerLabTeams).set({ curveProgressBps, status: "testing", updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
      } else if (action === "submit_graduation") {
        if (team.launcherUserId !== student.id && student.role !== "owner") return Response.json({ error: "Only the launcher or Campus OS owner can record graduation" }, { status: 403 });
        const tx = String(body.transactionHash || "").trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) return Response.json({ error: "Paste the full graduation transaction hash" }, { status: 400 });
        await db.update(partnerLabTeams).set({ graduationTxHash: tx, curveProgressBps: 10000, status: "submitted", updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
        await db.insert(partnerLabProofs).values({ id: crypto.randomUUID(), teamId, userId: student.id, proofType: "graduation", transactionHash: tx }).onConflictDoUpdate({ target: [partnerLabProofs.teamId, partnerLabProofs.userId, partnerLabProofs.proofType], set: { transactionHash: tx, status: "submitted", createdAt: new Date().toISOString() } });
      } else if (action === "submit_feedback") {
        if (student.role !== "owner") return Response.json({ error: "The Campus OS owner submits the consolidated founder feedback" }, { status: 403 });
        const feedbackReference = String(body.feedbackReference || "").trim();
        if (feedbackReference.length < 8) return Response.json({ error: "Add the submitted form link, confirmation or report reference" }, { status: 400 });
        const now = new Date().toISOString();
        await db.update(partnerLabTeams).set({ feedbackReference: feedbackReference.slice(0, 500), feedbackSubmittedAt: now, updatedAt: now }).where(eq(partnerLabTeams.id, teamId));
        await db.insert(partnerLabProofs).values({ id: crypto.randomUUID(), teamId, userId: student.id, proofType: "feedback", feedback: feedbackReference.slice(0, 500) }).onConflictDoUpdate({ target: [partnerLabProofs.teamId, partnerLabProofs.userId, partnerLabProofs.proofType], set: { feedback: feedbackReference.slice(0, 500), status: "submitted", createdAt: now } });
      } else if (action === "verify_team") {
        if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can verify partner-lab completion" }, { status: 403 });
        const [teamMembers, teamProofs] = await Promise.all([db.select().from(partnerLabMembers).where(and(eq(partnerLabMembers.teamId, teamId), eq(partnerLabMembers.status, "accepted"))), db.select().from(partnerLabProofs).where(eq(partnerLabProofs.teamId, teamId))]);
        const qualifyingBuyers = new Set(teamProofs.filter((proof) => proof.proofType === "buy").map((proof) => proof.userId));
        if (teamMembers.length !== 5 || !teamProofs.some((proof) => proof.proofType === "launch") || qualifyingBuyers.size < 4 || !teamProofs.some((proof) => proof.proofType === "sell") || !team.graduationTxHash || team.curveProgressBps < 10000 || !team.feedbackSubmittedAt) return Response.json({ error: "This team still needs five members, launch, four buys, one sell, full bonding, graduation and educator feedback" }, { status: 409 });
        await db.update(partnerLabTeams).set({ status: "verified", reviewNotes: String(body.reviewNotes || "Pressure test complete").slice(0, 500), verifiedBy: student.id, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(partnerLabTeams.id, teamId));
        await db.update(partnerLabProofs).set({ status: "verified" }).where(eq(partnerLabProofs.teamId, teamId));
      } else return Response.json({ error: "Choose a valid partner-lab action" }, { status: 400 });
    }
    return Response.json(await labState(request));
  } catch (error) { return faucetError(error); }
}
