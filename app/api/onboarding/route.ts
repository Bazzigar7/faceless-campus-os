import { eq } from "drizzle-orm";
import { cohortMembers, cohorts, faucetClaims, marketPurchases, rwaTrades, testnetLaunches, testnetTokens, tokenTransfers, users, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type StepId = "profile" | "wallets" | "cohort" | "funds" | "transaction" | "badge";
type Destination = "home" | "wallet" | "market" | "games";
const stepCopy: Array<{ id: StepId; number: string; title: string; description: string; destination: Destination }> = [
  { id: "profile", number: "01", title: "Create your Campus identity", description: "Choose the username classmates will use to find you.", destination: "home" },
  { id: "wallets", number: "02", title: "Prepare both wallets", description: "Your user-controlled Ethereum and Solana wallets are created together.", destination: "wallet" },
  { id: "cohort", number: "03", title: "Enter the classroom", description: "Join the private cohort using the code shared in class.", destination: "home" },
  { id: "funds", number: "04", title: "Claim test funds", description: "Get Sepolia ETH or Devnet SOL from the Campus faucet.", destination: "wallet" },
  { id: "transaction", number: "05", title: "Make your first onchain move", description: "Send a token, mint an NFT, launch an asset or make an RWA practice trade.", destination: "market" },
  { id: "badge", number: "06", title: "Unlock your first proof badge", description: "Your verified onchain action automatically becomes Campus proof.", destination: "games" },
];

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [studentRows, walletRows, memberRows, cohortRows, faucetRows, transferRows, purchaseRows, launchRows, tokenRows, rwaRows] = await Promise.all([
      db.select().from(users).where(eq(users.status, "active")),
      db.select().from(wallets),
      db.select().from(cohortMembers),
      db.select().from(cohorts),
      db.select().from(faucetClaims),
      db.select().from(tokenTransfers),
      db.select().from(marketPurchases),
      db.select().from(testnetLaunches),
      db.select().from(testnetTokens),
      db.select().from(rwaTrades),
    ]);
    const factsFor = (userId: string) => {
      const chains = new Set(walletRows.filter((row) => row.userId === userId).map((row) => row.chain));
      const funded = faucetRows.some((row) => row.userId === userId && row.status === "sent");
      const transfer = transferRows.some((row) => row.fromUserId === userId);
      const mint = purchaseRows.some((row) => row.buyerUserId === userId) || launchRows.some((row) => row.userId === userId && row.status === "minted");
      const launch = tokenRows.some((row) => row.userId === userId && row.status === "deployed") || launchRows.some((row) => row.userId === userId && (row.status === "deployed" || row.status === "minted"));
      const rwa = rwaRows.some((row) => row.userId === userId);
      const transaction = transfer || mint || launch || rwa;
      const badge = transfer ? "Token Sender" : mint ? "NFT Collector" : launch ? "Token Launcher" : rwa ? "RWA Analyst" : null;
      return { profile: true, wallets: chains.has("ethereum") && chains.has("solana"), cohort: memberRows.some((row) => row.userId === userId), funds: funded, transaction, badge: Boolean(badge), badgeLabel: badge };
    };
    const ownFacts = factsFor(student.id);
    const steps = stepCopy.map((step) => ({ ...step, complete: ownFacts[step.id], detail: step.id === "profile" ? `@${student.username}` : step.id === "badge" && ownFacts.badgeLabel ? ownFacts.badgeLabel : null }));
    const next = steps.find((step) => !step.complete) ?? null;
    const cohortProgress = student.role === "owner" ? cohortRows.filter((cohort) => cohort.status !== "complete").map((cohort) => {
      const ids = memberRows.filter((member) => member.cohortId === cohort.id).map((member) => member.userId);
      const people = ids.map((id) => factsFor(id));
      const counts = Object.fromEntries(stepCopy.map((step) => [step.id, people.filter((facts) => Boolean(facts[step.id])).length])) as Record<StepId, number>;
      const stuck = stepCopy.map((step) => ({ id: step.id, title: step.title, count: people.filter((facts) => !facts[step.id]).length })).filter((row) => row.count > 0);
      return { id: cohort.id, title: cohort.title, college: cohort.college, students: ids.length, counts, ready: people.filter((facts) => facts.badge).length, stuck };
    }) : [];
    return Response.json({ role: student.role, completedCount: steps.filter((step) => step.complete).length, totalSteps: steps.length, complete: !next, next, steps, cohortProgress, activeStudents: studentRows.filter((row) => row.role === "student").length }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return faucetError(error); }
}
