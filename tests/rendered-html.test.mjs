import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Faceless Campus OS onboarding", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Faceless Campus OS<\/title>/i);
  assert.match(html, /FACELESS CAMPUS OS/);
  assert.match(html, /CHOOSE YOUR CAMPUS USERNAME/);
  assert.match(html, /Ethereum and Solana wallets through Privy/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});

test("profile registration verifies signed Privy identity data", async () => {
  const [route, verifier, client, environment] = await Promise.all([
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/privy-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(route, /privy-id-token/);
  assert.match(route, /PRIVY_VERIFICATION_KEY/);
  assert.match(verifier, /jwtVerify/);
  assert.match(verifier, /issuer:\s*"privy\.io"/);
  assert.match(verifier, /audience:\s*appId/);
  assert.match(verifier, /linked_accounts/);
  assert.match(client, /useIdentityToken/);
  assert.match(client, /campus_pending_username/);
  assert.match(client, /useSendEthereumTransaction/);
  assert.match(client, /useSignAndSendTransaction/);
  assert.match(client, /api\/resolve/);
  assert.match(client, /solana:devnet/);
  assert.match(client, /chainId:\s*11155111/);
  assert.doesNotMatch(environment, /PRIVY_APP_SECRET/);
});

test("Privy transaction approvals have the browser Buffer compatibility layer", async () => {
  const provider = await readFile(new URL("../app/PrivyClientProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /import \{ Buffer \} from "buffer"/);
  assert.match(provider, /browserGlobals\.Buffer \?\?= Buffer/);
});

test("token launch and peer exchange stay wallet-approved on both testnets", async () => {
  const [client, tokenRoute, tokenContract] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tokens/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../contracts/CampusToken.sol", import.meta.url), "utf8"),
  ]);
  assert.match(client, /deploySepoliaToken/);
  assert.match(client, /deploySolanaToken/);
  assert.match(client, /waitForCampusSolanaTurn/);
  assert.match(client, /sendCampusToken/);
  assert.match(tokenRoute, /record_deploy/);
  assert.match(tokenRoute, /record_transfer/);
  assert.match(tokenContract, /mintAuthorityActive/);
  assert.match(tokenContract, /revokeMintAuthority/);
});

test("token airdrops use a secure vault and one verified claim per student", async () => {
  const [client, route, signer, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/airdrops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/privy-server-wallet.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /fundTokenAirdrop/);
  assert.match(client, /claimTokenAirdrop/);
  assert.match(client, /waitForCampusSolanaTurn/);
  assert.match(route, /record_funding/);
  assert.match(route, /sendTokenAirdropTransfer/);
  assert.match(signer, /privy-idempotency-key/);
  assert.match(schema, /idx_token_airdrop_claims_airdrop_user/);
});

test("RWA lab persists student case studies and keeps them fictional", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rwa/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /createRwaCaseStudy/);
  assert.match(client, /Open tokenisation studio/);
  assert.match(client, /no legal ownership/i);
  assert.match(route, /action === "create"/);
  assert.match(route, /Not enough practice units remain/);
  assert.match(route, /claim_income/);
  assert.match(client, /ESTIMATED MONTHLY RETURN/);
  assert.match(client, /CREDITS ARE NOT REDEEMABLE/);
  assert.match(client, /HOW THE REAL MAINNET VERSION WOULD WORK/);
  assert.match(client, /MONTHLY CASH-FLOW WATERFALL/);
  assert.match(client, /Gross monthly income/);
  assert.match(route, /cashflowFor/);
  assert.match(route, /netDistributableCredits/);
  assert.match(schema, /rwa_assets/);
  assert.match(schema, /idx_rwa_assets_symbol/);
  assert.match(schema, /idx_rwa_distributions_asset_user_period/);
});

test("educator command centre uses live cohort data and broadcasts classroom quests", async () => {
  const [client, dashboardRoute, sessionRoute, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /EDUCATOR COMMAND CENTRE/);
  assert.match(client, /Go live for the class/);
  assert.match(client, /CLASSROOM QUEST FROM YOUR EDUCATOR/);
  assert.match(dashboardRoute, /requireOwner/);
  assert.match(dashboardRoute, /sessionProgress/);
  assert.match(dashboardRoute, /action === "start_session"/);
  assert.match(sessionRoute, /requireCampusUser/);
  assert.match(schema, /classroom_sessions/);
  assert.match(schema, /classroom_session_activity/);
  assert.match(sessionRoute, /Campus OS cannot see the matching onchain proof yet/);
  assert.match(sessionRoute, /Tokenised asset holding verified/);
  assert.match(client, /Verify my proof/);
  assert.match(client, /I need help/);
  assert.match(client, /Download class CSV/);
  assert.match(client, /SESSION REPORTS/);
  assert.match(client, /VERIFIED CLASSROOM PROOFS/);
  assert.match(dashboardRoute, /recentSessions/);
  assert.match(sessionRoute, /proofs/);
});

test("campaign engine persists missions, submissions and owner payment approval", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/campaigns/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /CAMPAIGN CONTROL/);
  assert.match(client, /Submit work/);
  assert.match(client, /Approve payment/);
  assert.match(client, /APPROVED PAYMENT QUEUE/);
  assert.match(client, /PAYMENT LEDGER/);
  assert.match(client, /YOUR CREATOR EARNINGS/);
  assert.match(route, /approved_for_payment/);
  assert.match(route, /record_payment/);
  assert.match(route, /destinationReference/);
  assert.match(route, /Paste a valid public content link/);
  assert.match(schema, /campaign_enrollments/);
  assert.match(schema, /idx_submissions_campaign_user/);
});

test("partner drops create verified classroom credentials", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/drops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /PARTNER DROP STUDIO/);
  assert.match(client, /PARTNER CREDENTIALS/);
  assert.match(client, /Verify & claim/);
  assert.match(route, /Complete a verified live classroom quest/);
  assert.match(route, /Approved creator campaign/);
  assert.match(client, /Open token reward/);
  assert.match(client, /Mint collectible/);
  assert.match(route, /Choose an open classroom token airdrop/);
  assert.match(route, /Choose a collection with a public testnet mint/);
  assert.match(schema, /partner_drops/);
  assert.match(schema, /reward_kind/);
  assert.match(schema, /idx_partner_drop_claims_drop_user/);
});

test("Campus League scores only verified learning and testnet activity", async () => {
  const [client, route] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/league/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /FACELESS CAMPUS LEAGUE/);
  assert.match(client, /LIVE LEADERBOARD/);
  assert.match(client, /XP MISSIONS/);
  assert.match(client, /Unlocked by actions—not button clicks/);
  assert.match(route, /status === "completed"/);
  assert.match(route, /approved_for_payment/);
  assert.match(route, /points\.partnerDrop/);
  assert.match(route, /Math\.min\(breakdown\.tokenTransfers, caps\.transfer\)/);
  assert.match(client, /No self-reported/);
});

test("creator workspace saves guidance-first shoot plans", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/creator-projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /SAVED CREATOR WORKSPACE/);
  assert.match(client, /THE FIVE-SHOT PLAN/);
  assert.match(client, /Instagram Edits/);
  assert.match(client, /JOINED CAMPAIGNS/);
  assert.match(client, /PRE-SHOOT REVIEW/);
  assert.match(client, /CREATOR PLAN REVIEW/);
  assert.match(route, /Complete the hook, all five shots and the caption/);
  assert.match(route, /Mark the complete content plan ready before requesting review/);
  assert.match(route, /Only the Campus OS owner can review creator plans/);
  assert.match(route, /eq\(creatorProjects\.userId, student\.id\)/);
  assert.match(schema, /creator_projects/);
  assert.match(schema, /review_status/);
  assert.match(schema, /idx_creator_projects_user_time/);
});
