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

test("private cohorts gate Campus access and give the educator a roster", async () => {
  const [client, route, league, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cohorts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/league/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /COHORT MANAGER/);
  assert.match(client, /PRIVATE CAMPUS COHORT/);
  assert.match(client, /Export roster CSV/);
  assert.match(route, /This cohort has reached its seat limit/);
  assert.match(route, /Only the Campus OS owner can manage cohorts/);
  assert.match(league, /cohortUserIds/);
  assert.match(schema, /idx_cohorts_join_code/);
  assert.match(schema, /uniqueIndex\("idx_cohort_members_user"\)/);
});

test("educators can assign lessons and cohorts see one clear learning plan", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cohorts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /ASSIGN THE NEXT LESSON/);
  assert.match(client, /YOUR COHORT PLAN/);
  assert.match(client, /What your educator wants you to learn next/);
  assert.match(route, /action === "assign_lesson"/);
  assert.match(route, /action === "archive_assignment"/);
  assert.match(route, /completedCount/);
  assert.match(schema, /cohort_assignments/);
  assert.match(schema, /idx_cohort_assignments_cohort_lesson/);
});

test("live attendance uses expiring cohort codes and a verified roster", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /LIVE SESSION ATTENDANCE/);
  assert.match(client, /LIVE CHECK-IN/);
  assert.match(client, /Attendance roster downloaded/);
  assert.match(route, /action === "check_in"/);
  assert.match(route, /That check-in code is invalid or has expired/);
  assert.match(route, /This check-in belongs to another cohort/);
  assert.match(schema, /attendance_sessions/);
  assert.match(schema, /idx_attendance_records_session_user/);
});

test("partner drops can be restricted to verified session attendees", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/drops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /Verified session attendees/);
  assert.match(client, /Attendance → credential → onchain reward/);
  assert.match(route, /Only verified attendees of this session can claim the drop/);
  assert.match(route, /Verified attendance ·/);
  assert.match(schema, /eligibility_ref/);
  assert.match(schema, /"attendance"/);
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

test("Proof Passport is private by default and publishes only verified work", async () => {
  const [client, route, publicPage, helper, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/passport/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/passport/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/passport-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /PUBLISH YOUR PROOF PASSPORT/);
  assert.match(client, /PRIVATE BY DEFAULT/);
  assert.match(client, /No email, private keys or payment details/);
  assert.match(client, /Regenerate link/);
  assert.match(route, /"save" \| "rotate" \| "unpublish"/);
  assert.match(route, /isPublic: body\.isPublic === true/);
  assert.match(publicPage, /Earned, not self-declared/);
  assert.match(publicPage, /images: \[\]/);
  assert.match(publicPage, /No wallet controls, private keys, email or payment details/);
  assert.match(helper, /approved_for_payment/);
  assert.match(helper, /status === "deployed"/);
  assert.match(schema, /passport_profiles/);
  assert.match(schema, /idx_passport_profiles_slug/);
});

test("Project Studio saves blockchain builds and requires educator verification", async () => {
  const [client, route, passport, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/builder-projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/passport-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /PERSISTENT PROJECT STUDIO/);
  assert.match(client, /BUILD MILESTONES/);
  assert.match(client, /Request verification/);
  assert.match(client, /ONCHAIN PROJECT VERIFICATION/);
  assert.match(route, /Complete all four build milestones/);
  assert.match(route, /Add a working demo link or testnet contract reference/);
  assert.match(route, /Only the Campus OS owner can verify student builds/);
  assert.match(passport, /Verified Campus project/);
  assert.match(schema, /builder_projects/);
  assert.match(schema, /idx_builder_projects_status_time/);
});

test("Project Studio teams require cohort invitations and share verified credit", async () => {
  const [client, route, passport, league, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/builder-projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/passport-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/league/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /PROJECT TEAM/);
  assert.match(client, /Join project/);
  assert.match(client, /every accepted teammate’s Passport/);
  assert.match(route, /Invite a student from your active Campus cohort/);
  assert.match(route, /Only the project lead can invite teammates/);
  assert.match(route, /eq\(builderProjectMembers\.status, "accepted"\)/);
  assert.match(passport, /acceptedProjectMemberships/);
  assert.match(league, /member\.status === "accepted"/);
  assert.match(schema, /builder_project_members/);
  assert.match(schema, /idx_builder_project_members_project_user/);
});

test("Campus Showcase exposes only verified cohort builds with one-student applause", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/showcase/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /VERIFIED CAMPUS SHOWCASE/);
  assert.match(client, /Project Studio/);
  assert.match(client, /NFT Builder/);
  assert.match(client, /No popularity XP/);
  assert.match(route, /eq\(builderProjects\.status, "verified"\)/);
  assert.match(route, /eq\(cohortMembers\.cohortId, membership\.cohortId\)/);
  assert.match(route, /Only the Campus OS owner can feature demo-day projects/);
  assert.match(route, /action === "applaud"/);
  assert.match(schema, /builder_project_reactions/);
  assert.match(schema, /idx_builder_project_reactions_project_user_kind/);
  assert.match(schema, /featured_at/);
});

test("Campus Inbox combines private actions and persists per-student read state", async () => {
  const [client, route, schema] = await Promise.all([
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /CAMPUS INBOX/);
  assert.match(client, /What needs your attention/);
  assert.match(client, /Mark all read/);
  assert.match(client, /Private to your verified Campus account/);
  assert.match(route, /eq\(notificationReads\.userId, student\.id\)/);
  assert.match(route, /eq\(cohortAssignments\.cohortId, cohortId\)/);
  assert.match(route, /builder-invite:/);
  assert.match(route, /approved_for_payment/);
  assert.match(route, /student\.role === "owner"/);
  assert.match(schema, /notification_reads/);
  assert.match(schema, /idx_notification_reads_user_key/);
});
