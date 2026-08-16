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

export const cohorts = sqliteTable("cohorts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  college: text("college").notNull(),
  expectedStudents: integer("expected_students").notNull().default(200),
  status: text("status", { enum: ["draft", "active", "complete"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const cohortMembers = sqliteTable("cohort_members", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_cohort_members_cohort_user").on(table.cohortId, table.userId),
  index("idx_cohort_members_user").on(table.userId),
]);

export const educatorPermissions = sqliteTable("educator_permissions", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  canApproveMainnet: integer("can_approve_mainnet", { mode: "boolean" }).notNull().default(false),
  canManageEducators: integer("can_manage_educators", { mode: "boolean" }).notNull().default(false),
  grantedBy: text("granted_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const faucetClaims = sqliteTable("faucet_claims", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chain: text("chain", { enum: ["ethereum", "solana"] }).notNull(),
  amount: text("amount").notNull(),
  transactionHash: text("transaction_hash"),
  status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
  claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_faucet_claims_user_chain_time").on(table.userId, table.chain, table.claimedAt),
  index("idx_faucet_claims_status").on(table.status),
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

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  campaignType: text("campaign_type", { enum: ["creator", "faceless", "clipper", "user_acquisition"] }).notNull(),
  rewardAmount: text("reward_amount").notNull(),
  rewardCurrency: text("reward_currency").notNull(),
  status: text("status", { enum: ["draft", "live", "paused", "complete"] }).notNull().default("draft"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_campaigns_status_created").on(table.status, table.createdAt)]);

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
  index("idx_submissions_campaign_status").on(table.campaignId, table.status),
  index("idx_submissions_user_time").on(table.userId, table.submittedAt),
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
