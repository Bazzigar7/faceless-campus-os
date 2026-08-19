import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authProvider: text("auth_provider").notNull().default("privy"),
  providerUserId: text("provider_user_id").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["student", "educator", "owner"] }).notNull().default("student"),
  status: text("status", { enum: ["active", "suspended", "archived"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_users_provider_identity").on(table.authProvider, table.providerUserId),
  uniqueIndex("idx_users_email").on(table.email),
  uniqueIndex("idx_users_username").on(table.username),
  index("idx_users_role_status").on(table.role, table.status),
]);

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["privy", "dynamic", "external"] }).notNull(),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  walletType: text("wallet_type", { enum: ["embedded", "external"] }).notNull(),
  address: text("address").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_wallets_chain_address").on(table.chain, table.address),
  index("idx_wallets_user_chain").on(table.userId, table.chain),
  index("idx_wallets_user_primary").on(table.userId, table.isPrimary),
]);

export const passportProfiles = sqliteTable("passport_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shareSlug: text("share_slug").notNull(),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  headline: text("headline").notNull().default("Blockchain learner · Onchain builder · Creator"),
  bio: text("bio").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_passport_profiles_user").on(table.userId),
  uniqueIndex("idx_passport_profiles_slug").on(table.shareSlug),
  index("idx_passport_profiles_public_time").on(table.isPublic, table.updatedAt),
]);

export const cohorts = sqliteTable("cohorts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  college: text("college").notNull(),
  joinCode: text("join_code"),
  expectedStudents: integer("expected_students").notNull().default(200),
  enrollmentOpen: integer("enrollment_open", { mode: "boolean" }).notNull().default(true),
  status: text("status", { enum: ["draft", "active", "complete"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_cohorts_join_code").on(table.joinCode)]);

export const cohortMembers = sqliteTable("cohort_members", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_cohort_members_cohort_user").on(table.cohortId, table.userId),
  uniqueIndex("idx_cohort_members_user").on(table.userId),
]);

export const cohortAssignments = sqliteTable("cohort_assignments", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  course: text("course", { enum: ["blockchain", "bitcoin", "ethereum"] }).notNull(),
  lessonId: integer("lesson_id").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  dueAt: text("due_at"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_cohort_assignments_cohort_lesson").on(table.cohortId, table.course, table.lessonId),
  index("idx_cohort_assignments_cohort_status").on(table.cohortId, table.status),
]);

export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  host: text("host").notNull().default("Faceless"),
  checkInCode: text("check_in_code").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  expiresAt: text("expires_at").notNull(),
  openedBy: text("opened_by").notNull().references(() => users.id),
  openedAt: text("opened_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  closedAt: text("closed_at"),
}, (table) => [
  uniqueIndex("idx_attendance_sessions_code").on(table.checkInCode),
  index("idx_attendance_sessions_cohort_status").on(table.cohortId, table.status),
]);

export const attendanceRecords = sqliteTable("attendance_records", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkedInAt: text("checked_in_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_attendance_records_session_user").on(table.sessionId, table.userId),
  index("idx_attendance_records_user_time").on(table.userId, table.checkedInAt),
]);

export const educatorPermissions = sqliteTable("educator_permissions", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  canApproveMainnet: integer("can_approve_mainnet", { mode: "boolean" }).notNull().default(false),
  canManageEducators: integer("can_manage_educators", { mode: "boolean" }).notNull().default(false),
  grantedBy: text("granted_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const classroomSessions = sqliteTable("classroom_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  quest: text("quest", { enum: ["fund_wallets", "send_token", "mint_nft", "buy_rwa", "launch_token"] }).notNull(),
  instructions: text("instructions").notNull(),
  status: text("status", { enum: ["live", "ended"] }).notNull().default("live"),
  openedBy: text("opened_by").notNull().references(() => users.id),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: text("ended_at"),
}, (table) => [
  index("idx_classroom_sessions_status_time").on(table.status, table.startedAt),
]);

export const classroomSessionActivity = sqliteTable("classroom_session_activity", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => classroomSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["working", "needs_help", "completed"] }).notNull().default("working"),
  proofLabel: text("proof_label"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("idx_classroom_activity_session_user").on(table.sessionId, table.userId),
  index("idx_classroom_activity_session_status").on(table.sessionId, table.status),
]);

export const faucetClaims = sqliteTable("faucet_claims", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  claimNumber: integer("claim_number").notNull().default(1),
  amount: text("amount").notNull(),
  walletAddress: text("wallet_address").notNull().default(""),
  transactionHash: text("transaction_hash"),
  status: text("status", { enum: ["queued", "processing", "sent", "failed"] }).notNull().default("queued"),
  errorMessage: text("error_message"),
  claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_faucet_claims_user_chain_number").on(table.userId, table.chain, table.claimNumber),
  index("idx_faucet_claims_user_chain_time").on(table.userId, table.chain, table.claimedAt),
  index("idx_faucet_claims_status").on(table.status),
]);

export const faucetConfigs = sqliteTable("faucet_configs", {
  chain: text("chain", { enum: ["ethereum", "solana"] }).primaryKey(),
  amount: text("amount").notNull(),
  maxClaims: integer("max_claims").notNull().default(1),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  distributorWalletId: text("distributor_wallet_id"),
  distributorAddress: text("distributor_address"),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  course: text("course", { enum: ["blockchain", "bitcoin", "ethereum"] }).notNull(),
  lessonId: integer("lesson_id").notNull(),
  status: text("status", { enum: ["in_progress", "completed"] }).notNull().default("in_progress"),
  positionSeconds: integer("position_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_lesson_progress_user_course_lesson").on(table.userId, table.course, table.lessonId),
  index("idx_lesson_progress_user_status").on(table.userId, table.status),
  index("idx_lesson_progress_course_status").on(table.course, table.status),
]);

export const mainnetLaunchRequests = sqliteTable("mainnet_launch_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  assetType: text("asset_type", { enum: ["token", "nft", "collection", "other"] }).notNull(),
  testnetReference: text("testnet_reference").notNull(),
  metadataUrl: text("metadata_url"),
  status: text("status", { enum: ["requested", "changes_requested", "approved", "launched", "rejected"] }).notNull().default("requested"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
}, (table) => [
  index("idx_mainnet_requests_status_time").on(table.status, table.requestedAt),
  index("idx_mainnet_requests_user").on(table.userId),
]);

export const testnetLaunches = sqliteTable("testnet_launches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  network: text("network", { enum: ["sepolia", "solana_devnet"] }).notNull(),
  standard: text("standard", { enum: ["erc1155", "erc721", "metaplex_core"] }).notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description").notNull(),
  purpose: text("purpose").notNull(),
  maxSupply: integer("max_supply").notNull(),
  mintPrice: text("mint_price").notNull().default("0"),
  royaltyBps: integer("royalty_bps").notNull().default(0),
  creatorAddress: text("creator_address").notNull(),
  artworkKey: text("artwork_key").notNull(),
  artworkContentType: text("artwork_content_type").notNull(),
  status: text("status", { enum: ["prepared", "deploying", "deployed", "minted", "failed"] }).notNull().default("prepared"),
  deployTxHash: text("deploy_tx_hash"),
  contractAddress: text("contract_address"),
  mintTxHash: text("mint_tx_hash"),
  assetAddress: text("asset_address"),
  candyMachineAddress: text("candy_machine_address"),
  candyMachineTxHash: text("candy_machine_tx_hash"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_testnet_launches_user_time").on(table.userId, table.createdAt),
  index("idx_testnet_launches_status").on(table.status),
  uniqueIndex("idx_testnet_launches_deploy_tx").on(table.deployTxHash),
]);

export const marketPurchases = sqliteTable("market_purchases", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id").notNull().references(() => testnetLaunches.id, { onDelete: "cascade" }),
  buyerUserId: text("buyer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  buyerAddress: text("buyer_address").notNull(),
  quantity: integer("quantity").notNull().default(1),
  transactionHash: text("transaction_hash").notNull(),
  assetAddress: text("asset_address"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_market_purchases_tx").on(table.transactionHash),
  index("idx_market_purchases_collection_time").on(table.collectionId, table.createdAt),
  index("idx_market_purchases_buyer_time").on(table.buyerUserId, table.createdAt),
]);

export const campusTransactionQueues = sqliteTable("campus_transaction_queues", {
  network: text("network").primaryKey(),
  nextAvailableAt: integer("next_available_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const testnetTokens = sqliteTable("testnet_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  network: text("network", { enum: ["sepolia", "solana_devnet"] }).notNull(),
  standard: text("standard", { enum: ["erc20", "spl"] }).notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description").notNull(),
  purpose: text("purpose").notNull(),
  totalSupply: text("total_supply").notNull(),
  decimals: integer("decimals").notNull(),
  authorityMode: text("authority_mode", { enum: ["keep", "revoke"] }).notNull(),
  creatorAddress: text("creator_address").notNull(),
  tokenAddress: text("token_address"),
  creatorTokenAccount: text("creator_token_account"),
  status: text("status", { enum: ["prepared", "deployed", "failed"] }).notNull().default("prepared"),
  deployTxHash: text("deploy_tx_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_testnet_tokens_user_time").on(table.userId, table.createdAt),
  index("idx_testnet_tokens_status_time").on(table.status, table.updatedAt),
  uniqueIndex("idx_testnet_tokens_deploy_tx").on(table.deployTxHash),
]);

export const tokenTransfers = sqliteTable("token_transfers", {
  id: text("id").primaryKey(),
  tokenId: text("token_id").notNull().references(() => testnetTokens.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: text("amount").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_token_transfers_tx").on(table.transactionHash),
  index("idx_token_transfers_token_time").on(table.tokenId, table.createdAt),
  index("idx_token_transfers_from_time").on(table.fromUserId, table.createdAt),
  index("idx_token_transfers_to_time").on(table.toUserId, table.createdAt),
]);

export const tokenAirdrops = sqliteTable("token_airdrops", {
  id: text("id").primaryKey(),
  tokenId: text("token_id").notNull().references(() => testnetTokens.id, { onDelete: "cascade" }),
  creatorUserId: text("creator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amountPerClaim: text("amount_per_claim").notNull(),
  maxClaims: integer("max_claims").notNull(),
  totalAllocation: text("total_allocation").notNull(),
  distributorAddress: text("distributor_address").notNull(),
  fundingTransactionHash: text("funding_transaction_hash"),
  status: text("status", { enum: ["draft", "open", "closed", "exhausted"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_token_airdrops_token_status").on(table.tokenId, table.status),
  index("idx_token_airdrops_creator_time").on(table.creatorUserId, table.createdAt),
  uniqueIndex("idx_token_airdrops_funding_tx").on(table.fundingTransactionHash),
]);

export const tokenAirdropClaims = sqliteTable("token_airdrop_claims", {
  id: text("id").primaryKey(),
  airdropId: text("airdrop_id").notNull().references(() => tokenAirdrops.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  amount: text("amount").notNull(),
  transactionHash: text("transaction_hash"),
  status: text("status", { enum: ["queued", "processing", "sent", "failed"] }).notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_token_airdrop_claims_airdrop_user").on(table.airdropId, table.userId),
  uniqueIndex("idx_token_airdrop_claims_tx").on(table.transactionHash),
  index("idx_token_airdrop_claims_status_time").on(table.status, table.createdAt),
]);

export const rwaHoldings = sqliteTable("rwa_holdings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId: text("asset_id").notNull(),
  units: integer("units").notNull().default(0),
  totalCostCredits: integer("total_cost_credits").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_rwa_holdings_user_asset").on(table.userId, table.assetId),
  index("idx_rwa_holdings_user").on(table.userId),
]);

export const rwaAssets = sqliteTable("rwa_assets", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  rights: text("rights").notNull(),
  incomeModel: text("income_model").notNull(),
  risk: text("risk").notNull(),
  totalUnits: integer("total_units").notNull(),
  priceCredits: integer("price_credits").notNull(),
  annualYieldBps: integer("annual_yield_bps").notNull().default(0),
  grossMonthlyCredits: integer("gross_monthly_credits").notNull().default(0),
  vacancyBps: integer("vacancy_bps").notNull().default(0),
  operatingExpenseBps: integer("operating_expense_bps").notNull().default(0),
  reserveBps: integer("reserve_bps").notNull().default(0),
  status: text("status", { enum: ["active", "paused", "archived"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_rwa_assets_symbol").on(table.symbol),
  index("idx_rwa_assets_status_time").on(table.status, table.createdAt),
  index("idx_rwa_assets_creator_time").on(table.creatorUserId, table.createdAt),
]);

export const rwaDistributions = sqliteTable("rwa_distributions", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => rwaAssets.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  unitsSnapshot: integer("units_snapshot").notNull(),
  amountCredits: integer("amount_credits").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_rwa_distributions_asset_user_period").on(table.assetId, table.userId, table.period),
  index("idx_rwa_distributions_user_time").on(table.userId, table.createdAt),
]);

export const rwaTrades = sqliteTable("rwa_trades", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId: text("asset_id").notNull(),
  side: text("side", { enum: ["buy", "sell"] }).notNull(),
  units: integer("units").notNull(),
  priceCredits: integer("price_credits").notNull(),
  totalCredits: integer("total_credits").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_rwa_trades_user_time").on(table.userId, table.createdAt),
  index("idx_rwa_trades_asset_time").on(table.assetId, table.createdAt),
]);

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  brand: text("brand").notNull().default("Faceless Partner"),
  brief: text("brief").notNull(),
  campaignType: text("campaign_type", { enum: ["creator", "faceless", "clipper", "user_acquisition"] }).notNull(),
  platform: text("platform").notNull().default("Instagram"),
  spots: integer("spots").notNull().default(50),
  rewardAmount: text("reward_amount").notNull(),
  rewardCurrency: text("reward_currency").notNull(),
  status: text("status", { enum: ["draft", "live", "paused", "complete"] }).notNull().default("draft"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_campaigns_status_created").on(table.status, table.createdAt)]);

export const campaignEnrollments = sqliteTable("campaign_enrollments", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_campaign_enrollments_campaign_user").on(table.campaignId, table.userId),
  index("idx_campaign_enrollments_user_time").on(table.userId, table.joinedAt),
]);

export const campaignSubmissions = sqliteTable("campaign_submissions", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentUrl: text("content_url").notNull(),
  status: text("status", { enum: ["submitted", "changes_requested", "approved_for_payment", "paid", "rejected"] }).notNull().default("submitted"),
  reviewNotes: text("review_notes"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
}, (table) => [
  uniqueIndex("idx_submissions_campaign_user").on(table.campaignId, table.userId),
  index("idx_submissions_campaign_status").on(table.campaignId, table.status),
  index("idx_submissions_user_time").on(table.userId, table.submittedAt),
]);

export const creatorProjects = sqliteTable("creator_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  platform: text("platform").notNull().default("Instagram Reels"),
  format: text("format", { enum: ["on_camera", "faceless", "voiceover", "hands_only", "screen_recording"] }).notNull().default("faceless"),
  objective: text("objective").notNull(),
  hook: text("hook").notNull().default(""),
  shots: text("shots").notNull().default("[]"),
  caption: text("caption").notNull().default(""),
  status: text("status", { enum: ["draft", "ready"] }).notNull().default("draft"),
  reviewStatus: text("review_status", { enum: ["not_requested", "submitted", "changes_requested", "approved"] }).notNull().default("not_requested"),
  reviewNotes: text("review_notes"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_creator_projects_user_time").on(table.userId, table.updatedAt),
  index("idx_creator_projects_user_status").on(table.userId, table.status),
]);

export const payouts = sqliteTable("payouts", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => campaignSubmissions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["crypto", "manual_bank", "other"] }).notNull(),
  destinationReference: text("destination_reference").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status", { enum: ["approved", "paid", "failed"] }).notNull().default("approved"),
  approvedBy: text("approved_by").notNull().references(() => users.id),
  transactionReference: text("transaction_reference"),
  approvedAt: text("approved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  paidAt: text("paid_at"),
}, (table) => [
  uniqueIndex("idx_payouts_submission").on(table.submissionId),
  index("idx_payouts_status_time").on(table.status, table.approvedAt),
]);

export const partnerDrops = sqliteTable("partner_drops", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  host: text("host").notNull(),
  description: text("description").notNull(),
  rewardLabel: text("reward_label").notNull().default("Campus credential"),
  rewardKind: text("reward_kind", { enum: ["credential", "token_airdrop", "nft_mint"] }).notNull().default("credential"),
  rewardAssetId: text("reward_asset_id"),
  eligibility: text("eligibility", { enum: ["open", "attendance", "live_quest", "lesson", "campaign"] }).notNull().default("open"),
  eligibilityRef: text("eligibility_ref"),
  maxClaims: integer("max_claims").notNull().default(200),
  status: text("status", { enum: ["draft", "live", "closed"] }).notNull().default("live"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_partner_drops_status_time").on(table.status, table.createdAt)]);

export const partnerDropClaims = sqliteTable("partner_drop_claims", {
  id: text("id").primaryKey(),
  dropId: text("drop_id").notNull().references(() => partnerDrops.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  evidence: text("evidence").notNull(),
  claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_partner_drop_claims_drop_user").on(table.dropId, table.userId),
  index("idx_partner_drop_claims_user_time").on(table.userId, table.claimedAt),
]);
