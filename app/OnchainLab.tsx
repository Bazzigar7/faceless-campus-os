"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken, useIdentityToken, usePrivy, useSendTransaction as useSendEthereumTransaction, useUser, useWallets as useEthereumWallets } from "@privy-io/react-auth";
import { useExportWallet as useExportSolanaWallet, useSignAndSendTransaction, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  getTransactionEncoder,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import { AuthorityType, TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getCreateAssociatedTokenInstruction, getInitializeMint2Instruction, getMintToInstruction, getSetAuthorityInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import { create as createCoreAsset, createCollection as createCoreCollection, fetchCollection, mplCore, ruleSet } from "@metaplex-foundation/mpl-core";
import { create as createCoreCandyMachine, mintV1 as mintCoreCandyMachine, mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { createNoopSigner as createUmiNoopSigner, generateSigner, none, publicKey, signerIdentity, sol, some } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createPublicClient, encodeFunctionData, http, isAddress, parseEther, type Hex } from "viem";
import { sepolia } from "viem/chains";
import LiveMask from "./LiveMask";

type Tab = "home" | "learn" | "mask" | "wallet" | "create" | "games" | "tools" | "campaigns" | "launchpad" | "market" | "passport" | "drops" | "admin";
type Course = "blockchain" | "bitcoin" | "ethereum";
type Chain = "ethereum" | "solana";
type FaucetNetwork = Chain | "robinhood";
type LaunchMode = "testnet" | "mainnet";
type Lesson = { id: number; title: string; copy: string; time: string; unit: string; state: string; action: string; video?: string; course: Course };
type Recipient = { username: string; displayName: string; wallets: Array<{ chain: Chain; address: string }> };
type TransferReceipt = { chain: Chain; hash: string; username: string; amount: string; explorer: string };
type FaucetChainState = { chain: FaucetNetwork; amount: string; maxClaims: number; claimsUsed: number; enabled: boolean; configured: boolean; distributorAddress?: string };
type FaucetState = {
  role: "student" | "educator" | "owner";
  signerReady: boolean;
  chains: FaucetChainState[];
  recent: Array<{ id: string; chain: FaucetNetwork; amount: string; status: "queued" | "processing" | "sent" | "failed"; transactionHash?: string | null; claimedAt: string; errorMessage?: string | null }>;
};
type LearningRecord = { course: Course; lessonId: number; status: "in_progress" | "completed"; positionSeconds: number; durationSeconds: number; updatedAt: string; completedAt?: string | null };
type LearningState = {
  completedCount: number;
  totalLessons: number;
  records: LearningRecord[];
  courseProgress: Array<{ course: Course; total: number; completed: number }>;
  resume: LearningRecord | null;
  cohort?: { activeStudents: number; lessonsCompleted: number; lessonsInProgress: number; completionRate: number; courses: Array<{ course: Course; completed: number }> };
};
type MaskCitation = { title: string; url: string };
type LaunchDraft = {
  assetType: "nft_collection" | "token";
  chain: Chain;
  name: string;
  symbol: string;
  description: string;
  supply: number;
  mintPrice: string | null;
  royaltyPercent: number | null;
  decimals: number | null;
  purpose: string;
  artworkReady: boolean | null;
  authorityMode: "keep" | "revoke" | null;
};
type LaunchProgress = {
  assetType: LaunchDraft["assetType"] | null;
  chain: Chain | null;
  name: string | null;
  symbol: string | null;
  description: string | null;
  supply: number | null;
  mintPrice: string | null;
  royaltyPercent: number | null;
  decimals: number | null;
  purpose: string | null;
  artworkReady: boolean | null;
  artworkUploaded: boolean;
  authorityMode: LaunchDraft["authorityMode"];
  ready: boolean;
};
type MaskArtwork = { dataUrl: string; name: string; type: string; size: number };
type MaskMessage = { role: "user" | "assistant"; text: string; image?: string; imageName?: string; citations?: MaskCitation[]; launchDraft?: LaunchDraft | null };
type LaunchTransactionStatus = "idle" | "uploading" | "awaiting_signature" | "confirming" | "deployed" | "minting" | "minted" | "error";
type LaunchDeployment = {
  chain: Chain;
  launchId: string;
  metadataUrl: string;
  deployHash: string;
  contractAddress: string;
  mintHash?: string;
  assetAddress?: string;
};
type CampusToken = {
  id: string;
  chain: Chain;
  network: "sepolia" | "solana_devnet";
  standard: "erc20" | "spl";
  name: string;
  symbol: string;
  description: string;
  purpose: string;
  totalSupply: string;
  decimals: number;
  authorityMode: "keep" | "revoke";
  creatorAddress: string;
  tokenAddress: string;
  creatorTokenAccount: string | null;
  deployTxHash: string;
  creator: { username: string; displayName: string };
  owned: string;
  holders: number;
  transferCount: number;
};
type TokenAirdrop = {
  id: string;
  tokenId: string;
  amountPerClaim: string;
  maxClaims: number;
  totalAllocation: string;
  distributorAddress?: string;
  fundingTransactionHash: string | null;
  status: "draft" | "open" | "closed" | "exhausted";
  isCreator: boolean;
  claimedCount: number;
  pendingCount: number;
  ownClaim: { status: "queued" | "processing" | "sent" | "failed"; transactionHash?: string | null; errorMessage?: string | null } | null;
};
type WalletAssetView = "all" | "tokens" | "nfts";
type UsdPrices = { ethereum: number; solana: number; updatedAt: number };
type WalletNft = {
  id: string;
  chain: Chain;
  network: "sepolia" | "solana_devnet";
  standard: string;
  name: string;
  symbol: string;
  description: string;
  quantity: number;
  maxSupply: number;
  contractAddress: string | null;
  assetAddress: string | null;
  mintTransactionHash: string | null;
  image: string;
  metadata: string;
  updatedAt: string;
};
type ResumableLaunch = {
  launchId: string;
  chain: Chain;
  name: string;
  symbol: string;
  description: string;
  purpose: string;
  maxSupply: number;
  mintPrice: string;
  royaltyPercent: number;
  creatorAddress: string;
  metadataUrl: string;
  image: string;
  deployHash: string;
  contractAddress: string;
};
type MarketCollection = {
  id: string;
  chain: Chain;
  network: "sepolia" | "solana_devnet";
  standard: string;
  name: string;
  symbol: string;
  description: string;
  purpose: string;
  maxSupply: number;
  minted: number;
  mintPrice: string;
  royaltyPercent: number;
  creator: { username: string; displayName: string };
  creatorAddress: string;
  contractAddress: string;
  assetAddress: string | null;
  candyMachineAddress: string | null;
  candyMachineTransactionHash: string | null;
  image: string;
  metadata: string;
  deployTransactionHash: string;
  primarySaleReady: boolean;
  updatedAt: string;
};
type RwaHolding = { id: string; assetId: string; units: number; totalCostCredits: number };
type RwaTrade = { id: string; assetId: string; side: "buy" | "sell"; units: number; priceCredits: number; totalCredits: number; createdAt: string };
type RwaDistribution = { id: string; assetId: string; period: string; unitsSnapshot: number; amountCredits: number; createdAt: string };
type RwaCashflow = { grossMonthlyCredits: number; vacancyCredits: number; operatingExpenseCredits: number; reserveCredits: number; netDistributableCredits: number; annualYieldBps: number; vacancyBps: number; operatingExpenseBps: number; reserveBps: number };
type RwaAsset = { id: string; name: string; symbol: string; category: string; description: string; rights: string; incomeModel: string; risk: string; totalUnits: number; priceCredits: number; annualYieldBps: number; unitsHeld: number; holders: number; monthlyEstimateCredits: number; incomeClaimedThisPeriod: boolean; cashflow: RwaCashflow; creator: { username: string; displayName: string } | null };
type RwaState = { balanceCredits: number; holdings: RwaHolding[]; trades: RwaTrade[]; distributions: RwaDistribution[]; assets: RwaAsset[]; currentPeriod: string; nextDistributionAt: string };
type ClassroomQuest = "fund_wallets" | "send_token" | "mint_nft" | "buy_rwa" | "launch_token";
type ClassroomSession = { id: string; title: string; quest: ClassroomQuest; instructions: string; status: "live" | "ended"; startedAt: string };
type ClassroomActivity = { status: "working" | "needs_help" | "completed"; proofLabel: string | null };
type ClassroomProof = { id: string; title: string; quest: ClassroomQuest; proofLabel: string; completedAt: string };
type CampaignSubmission = { id: string; campaignId: string; userId: string; contentUrl: string; status: "submitted" | "changes_requested" | "approved_for_payment" | "paid" | "rejected"; reviewNotes: string | null };
type CampusCampaign = { id: string; title: string; brand: string; brief: string; campaignType: "creator" | "faceless" | "clipper" | "user_acquisition"; platform: string; spots: number; rewardAmount: string; rewardCurrency: string; status: "draft" | "live" | "paused" | "complete"; joined: boolean; joinedCount: number; ownSubmission: CampaignSubmission | null };
type CampaignReviewItem = CampaignSubmission & { campaign: CampusCampaign | null; student: { username: string; displayName: string } | null };
type CampaignPayout = { id: string; submissionId: string; amount: string; currency: string; status: "approved" | "paid" | "failed"; transactionReference: string | null; paidAt: string | null; campaign: CampusCampaign | null };
type CampaignState = { role: "student" | "educator" | "owner"; campaigns: CampusCampaign[]; reviewQueue: CampaignReviewItem[]; paymentQueue: CampaignReviewItem[]; payouts: CampaignPayout[] };
type PartnerLabProof = { id: string; proofType: "launch" | "buy" | "sell" | "graduation" | "feedback"; transactionHash: string | null; feedback: string | null; status: "submitted" | "verified" | "rejected" };
type PartnerLabMember = { id: string; userId: string; username: string; displayName: string; walletAddress: string | null; role: "launcher" | "market_tester"; status: "invited" | "accepted"; proofs: PartnerLabProof[] };
type PartnerLabTeam = { id: string; name: string; characterKey: string; characterName: string; tokenName: string; tokenSymbol: string; tokenPitch: string; initialBuyEth: string; launcherUserId: string; tokenAddress: string | null; launchTxHash: string | null; curveProgressBps: number; graduationTxHash: string | null; feedbackReference: string | null; feedbackSubmittedAt: string | null; status: "forming" | "ready" | "launched" | "testing" | "submitted" | "verified"; reviewNotes: string | null; members: PartnerLabMember[]; progress: { accepted: number; launchProof: boolean; buyerProofs: number; sellProof: boolean; curveProgressBps: number; graduated: boolean; feedbackSubmitted: boolean; readyForReview: boolean } };
type PartnerLabState = { role: "student" | "educator" | "owner"; ownUserId: string; campaign: { key: string; title: string; partner: string; externalUrl: string; chain: string; chainId: number; rpcUrl: string; explorerUrl: string; faucetUrl: string; teamSize: number; fixedSupply: string; launchCostEth: string; raiseTargetEth: string; tradingFeePercent: number; reward: string; mechanicsStatus: string }; teams: PartnerLabTeam[]; reviewQueue: PartnerLabTeam[] };
type PartnerReward = { kind: "credential" | "token_airdrop" | "nft_mint"; id: string | null; tokenId: string | null; label: string; chain: Chain | null; status: string };
type PartnerDrop = { id: string; title: string; host: string; description: string; rewardLabel: string; rewardKind: PartnerReward["kind"]; rewardAssetId: string | null; reward: PartnerReward | null; eligibility: "open" | "attendance" | "live_quest" | "lesson" | "campaign"; eligibilityRef: string | null; maxClaims: number; status: "draft" | "live" | "closed"; claimedCount: number; ownClaim: { id: string; evidence: string; claimedAt: string } | null };
type DropState = { role: "student" | "educator" | "owner"; drops: PartnerDrop[]; credentials: Array<{ id: string; evidence: string; claimedAt: string; drop: PartnerDrop | null }>; rewardOptions: { tokenAirdrops: Array<{ id: string; label: string; tokenId: string; chain: Chain }>; collections: Array<{ id: string; label: string; chain: Chain }> } };
type LeagueBreakdown = { lessons: number; liveQuests: number; faucetClaims: number; tokenTransfers: number; nftMints: number; tokenLaunches: number; rwaTrades: number; campaigns: number; partnerDrops: number; airdrops: number; verifiedProjects: number };
type LeaguePlayer = { id: string; username: string; displayName: string; xp: number; rank: number; level: number; name: string; nextAt: number; badges: string[]; breakdown: LeagueBreakdown };
type LeagueState = { own: Omit<LeaguePlayer, "id" | "username" | "displayName" | "rank"> & { rank: number | null }; leaderboard: LeaguePlayer[]; missions: Array<{ id: string; title: string; xp: number; done: boolean; destination: Tab }>; scoring: Record<string, number> };
type CreatorFormat = "on_camera" | "faceless" | "voiceover" | "hands_only" | "screen_recording";
type CreatorProject = { id: string; campaignId: string | null; title: string; platform: string; format: CreatorFormat; objective: string; hook: string; shots: string[]; caption: string; status: "draft" | "ready"; reviewStatus: "not_requested" | "submitted" | "changes_requested" | "approved"; reviewNotes: string | null; createdAt: string; updatedAt: string; campaign: CampusCampaign | null };
type CreatorReviewProject = CreatorProject & { student: { username: string; displayName: string } | null };
type CreatorProjectState = { projects: CreatorProject[]; reviewQueue: CreatorReviewProject[] };
type BuilderMilestone = { label: string; done: boolean };
type BuilderMember = { id: string; userId: string; username: string; displayName: string; role: string; status: "invited" | "accepted" };
type BuilderProject = { id: string; title: string; chain: "ethereum" | "solana" | "multichain"; useCase: string; problem: string; audience: string; solution: string; milestones: BuilderMilestone[]; contractReference: string | null; demoUrl: string | null; status: "draft" | "building" | "submitted" | "changes_requested" | "verified"; reviewNotes: string | null; updatedAt: string; isOwner: boolean; invitationStatus: "invited" | "accepted" | "declined" | null; members: BuilderMember[] };
type BuilderReviewProject = BuilderProject & { student: { username: string; displayName: string } | null };
type BuilderProjectState = { role: "student" | "educator" | "owner"; projects: BuilderProject[]; reviewQueue: BuilderReviewProject[] };
type ShowcaseProject = { id: string; title: string; chain: BuilderProject["chain"]; useCase: string; problem: string; audience: string; solution: string; demoUrl: string | null; contractReference: string | null; featured: boolean; featuredAt: string | null; verifiedAt: string | null; applauseCount: number; applauded: boolean; team: Array<{ id: string; username: string; displayName: string; role: string }> };
type ShowcaseState = { role: "student" | "educator" | "owner"; projects: ShowcaseProject[] };
type CampusNotification = { key: string; kind: "assignment" | "invitation" | "review" | "campaign" | "drop" | "owner"; title: string; body: string; destination: "learn" | "create" | "tools" | "campaigns" | "drops" | "admin"; createdAt: string; referenceId?: string; read: boolean };
type NotificationState = { role: "student" | "educator" | "owner"; unreadCount: number; notifications: CampusNotification[] };
type FirstDayStep = { id: "profile" | "wallets" | "cohort" | "funds" | "transaction" | "badge" | "partner_lab"; number: string; title: string; description: string; destination: "home" | "wallet" | "market" | "games" | "campaigns"; complete: boolean; detail: string | null };
type FirstDayState = { role: "student" | "educator" | "owner"; completedCount: number; totalSteps: number; complete: boolean; next: FirstDayStep | null; steps: FirstDayStep[]; activeStudents: number; cohortProgress: Array<{ id: string; title: string; college: string; students: number; ready: number; counts: Record<FirstDayStep["id"], number>; stuck: Array<{ id: FirstDayStep["id"]; title: string; count: number }> }> };
type CohortRosterStudent = { id: string; username: string; displayName: string; email: string; joinedAt: string; ethereumAddress: string; solanaAddress: string; lessonsCompleted: number };
type CohortAssignment = { id: string; cohortId: string; course: Course; lessonId: number; title: string; instructions: string; dueAt: string | null; status: "active" | "archived"; completedCount?: number; totalStudents?: number };
type CampusCohort = { id: string; title: string; college: string; joinCode: string | null; expectedStudents: number; enrollmentOpen: boolean; status: "draft" | "active" | "complete"; memberCount: number; roster: CohortRosterStudent[]; assignments: CohortAssignment[] };
type CohortState = { role: "student" | "educator" | "owner"; gateEnabled: boolean; membership: { id: string; title: string; college: string; joinedAt?: string } | null; assignments: CohortAssignment[]; cohorts: CampusCohort[] };
type AttendanceRecord = { id: string; userId?: string; sessionId?: string; username?: string; displayName?: string; email?: string; checkedInAt: string; title?: string; host?: string; openedAt?: string };
type AttendanceSession = { id: string; cohortId: string; cohortTitle: string; title: string; host: string; checkInCode: string; status: "open" | "closed"; expiresAt: string; openedAt: string; closedAt: string | null; attendanceCount: number; records: AttendanceRecord[] };
type AttendanceState = { role: "student" | "educator" | "owner"; prompt: { id: string; title: string; host: string; expiresAt: string } | null; ownRecords: AttendanceRecord[]; sessions: AttendanceSession[] };
type PassportState = { settings: { id: string | null; shareSlug: string | null; isPublic: boolean; headline: string; bio: string; sharePath: string | null }; metrics: { lessonsCompleted: number; attendanceCount: number; credentials: number; classroomProofs: number; assetsBuilt: number; approvedCampaigns: number; paidCampaigns: number } };
type EducatorDashboard = {
  metrics: { activeStudents: number; bothWallets: number; lessonsCompleted: number; onchainActions: number; nftCollections: number; tokens: number; rwas: number; openAirdrops: number };
  roster: Array<{ id: string; username: string; displayName: string; email: string; ethereumReady: boolean; solanaReady: boolean; lessonsCompleted: number; ethFunded: boolean; solFunded: boolean; assetsCreated: number; issues: string[]; sessionStatus: ClassroomActivity["status"] | null; proofLabel: string | null }>;
  alerts: Array<{ userId: string; username: string; message: string }>;
  queues: Array<{ network: string; nextAvailableAt: number }>;
  currentSession: ClassroomSession | null;
  sessionProgress: number;
  sessionWorking: number;
  sessionNeedsHelp: number;
  recentSessions: Array<{ id: string; title: string; quest: ClassroomQuest; startedAt: string; endedAt: string | null; completed: number; participated: number; needsHelp: number }>;
};

type Drop = {
  id: number;
  title: string;
  host: string;
  claimed: number;
  supply: number;
  tone: string;
};

const navItems: { id: Tab; label: string; mark: string }[] = [
  { id: "home", label: "Home", mark: "⌂" },
  { id: "wallet", label: "Wallets", mark: "▱" },
  { id: "learn", label: "Learn", mark: "▶" },
  { id: "mask", label: "Ask Mask", mark: "M" },
  { id: "create", label: "Build lab", mark: "+" },
  { id: "games", label: "Playground", mark: "◆" },
  { id: "tools", label: "Creator tools", mark: "✦" },
  { id: "campaigns", label: "Campaigns", mark: "◎" },
  { id: "launchpad", label: "Launchpad", mark: "↗" },
  { id: "market", label: "Market", mark: "◈" },
  { id: "passport", label: "My passport", mark: "◇" },
  { id: "admin", label: "Educator view", mark: "▦" },
];

const ethereumLessons: Lesson[] = [
  { id: 1, title: "Meet Ethereum", copy: "A shared computer for money, ownership and applications.", time: "0:58", unit: "FOUNDATIONS", state: "complete", action: "Explore the network", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/bc1b33b9-875b-4fb0-9c83-9664a979f699-meet-ethereum-v2-faceless-approved.mp4" },
  { id: 2, title: "Smart contracts", copy: "Rules that execute when their conditions are met.", time: "0:58", unit: "FOUNDATIONS", state: "active", action: "Read a contract", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3df30db4-89ad-4dd7-b34e-6ee44b79e923-ethereum-smart-contracts-v5-faceless-approved.mp4" },
  { id: 3, title: "Tokenising a watch", copy: "How rules and ownership shares can move onchain.", time: "1:01", unit: "TOKENISATION", state: "open", action: "Create asset shares", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/8cc08734-a79f-4930-b5d3-cb83c38125a1-ethereum-rwa-watch-v6-faceless-approved.mp4" },
  { id: 4, title: "Tokenising a building", copy: "A hypothetical look at rights, rent and smaller shares.", time: "1:20", unit: "TOKENISATION", state: "open", action: "Model a building", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/e37d1f22-ddaa-460f-910e-e87193a6b4b7-ethereum-rwa-building-v2-faceless-approved.mp4" },
  { id: 5, title: "Transaction confirmation", copy: "Follow an Ethereum payment from wallet to confirmation.", time: "1:04", unit: "NETWORK", state: "open", action: "Send test ETH", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/5554e138-d284-4fa4-8330-4a1aef84533a-ethereum-tx-confirmation-v1-faceless-approved.mp4" },
  { id: 6, title: "Validators and Proof of Stake", copy: "Who builds blocks, who checks them and why honesty matters.", time: "0:43", unit: "NETWORK", state: "open", action: "Inspect a validator", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/2cb946d3-37b0-4d7b-a6fa-4e0d292a629c-ethereum-validators-pos-v1-faceless-approved.mp4" },
  { id: 7, title: "Ethereum gas", copy: "Why network work has a fee and why that fee changes.", time: "0:45", unit: "NETWORK", state: "open", action: "Compare gas", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/eb6e5f6a-24b4-41d7-8eec-35a357810e96-ethereum-gas-v3-faceless-approved.mp4" },
  { id: 8, title: "Ethereum supply", copy: "Validator rewards add ETH while base-fee burning removes it.", time: "0:49", unit: "NETWORK", state: "open", action: "View supply", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/0edb1abc-9984-4d8e-8c51-bb9be3f11281-ethereum-supply-v2-faceless-approved.mp4" },
  { id: 9, title: "What is an NFT?", copy: "A unique token that can act as a digital certificate.", time: "0:54", unit: "NFTS", state: "open", action: "Claim your head", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/314cb8a5-e80f-483c-88df-b539da820885-ethereum-nft-basics-v3-faceless-approved.mp4" },
  { id: 10, title: "Art and provenance", copy: "See the issuer, current owner and transfer history.", time: "0:52", unit: "NFTS", state: "open", action: "Mint original art", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/caf33a70-a613-44ec-b0c1-c2e8ef8b7e9f-ethereum-nft-art-provenance-v2-faceless-approved.mp4" },
  { id: 11, title: "A car's digital certificate", copy: "Link official records to a vehicle's ownership history.", time: "0:54", unit: "NFTS", state: "open", action: "View certificate", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/8ab52189-adbe-4a34-9373-6a81de53169a-ethereum-nft-car-certificate-v4-faceless-approved.mp4" },
  { id: 12, title: "Product authenticity", copy: "How official issuers and secure tags can help prove origin.", time: "0:58", unit: "NFTS", state: "open", action: "Verify a product", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/48ed2355-cce5-4836-a3d0-471f5551361d-ethereum-nft-product-authenticity-v1-faceless-approved.mp4" },
  { id: 13, title: "Borrow without selling ETH", copy: "Understand collateral, interest and liquidation risk.", time: "0:59", unit: "DEFI", state: "open", action: "Simulate a loan", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3ff1e0a9-a6d2-4699-80d3-c7005c265227-ethereum-defi-borrow-without-selling-v1-faceless-approved.mp4" },
  { id: 14, title: "Bank vs smart contract", copy: "Compare traditional finance routes with published DeFi rules.", time: "1:00", unit: "DEFI", state: "open", action: "Compare the routes", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/6cc53850-b5d3-4950-83a7-c0801475df67-ethereum-defi-bank-vs-contract-v1-faceless-approved.mp4" },
  { id: 15, title: "Token swaps and liquidity pools", copy: "How shared pools let a wallet exchange one token for another.", time: "1:06", unit: "DEFI", state: "open", action: "Try a test swap", course: "ethereum", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/9913f480-3109-4b59-a1c1-e777308856f9-ethereum-defi-token-swap-v1-faceless-approved.mp4" },
];

const blockchainLessons: Lesson[] = [
  { id: 1, title: "What is USDT?", copy: "Why a digital dollar token is useful for moving value online.", time: "0:36", unit: "MONEY", state: "complete", action: "Compare digital money", course: "blockchain", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/9b979628-a4d3-4460-bcbf-b9359f47a360-what-is-usdt-faceless-liam-v2.mp4" },
  { id: 2, title: "How P2P works", copy: "Understand peer-to-peer exchange, escrow and safety checks.", time: "0:52", unit: "MONEY", state: "open", action: "Walk through P2P", course: "blockchain", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/5d6bc817-9155-4263-b641-5254ed4532ef-p2p-usdt-explained-faceless-liam-v3.mp4" },
  { id: 3, title: "What is blockchain?", copy: "A shared record that many computers can verify together.", time: "0:28", unit: "FOUNDATIONS", state: "open", action: "Build a class ledger", course: "blockchain", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/9566c9a0-e1bf-4a7c-b7a3-1f00a7516032-what-is-blockchain-faceless-liam-v2.mp4" },
];

const bitcoinLessons: Lesson[] = [
  { id: 1, title: "Bitcoin recap", copy: "Review money, ledgers, mining, supply and transactions.", time: "1 min", unit: "RECAP", state: "complete", action: "Take the recap", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3ce71d95-f2ac-46b0-9dee-0507d6b7aebc-bitcoin-recap-v1-faceless-approved.mp4" },
  { id: 2, title: "Bitcoin money transfer", copy: "How value moves directly between Bitcoin wallets.", time: "0:43", unit: "TRANSACTIONS", state: "open", action: "Trace a transfer", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/e305b484-b659-4cfd-9b9b-faee2e7138d4-bitcoin-money-transfer-faceless-liam-v2.mp4" },
  { id: 3, title: "Satoshi and the beginning", copy: "Why Bitcoin was created and how the network began.", time: "0:42", unit: "ORIGINS", state: "open", action: "Open the first block", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/cbacfa80-4c6c-4f1a-a49d-0a146b473d1d-satoshi-beginning-faceless-liam-v2.mp4" },
  { id: 4, title: "Bitcoin mining", copy: "How miners compete to add valid blocks and protect the ledger.", time: "0:36", unit: "NETWORK", state: "open", action: "Simulate mining", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/a09c3137-d9ff-4dd8-a97e-def3a0e7d00b-bitcoin-mining-faceless-liam-v2.mp4" },
  { id: 5, title: "Bitcoin's fixed supply", copy: "Why the protocol limits supply to 21 million bitcoin.", time: "0:42", unit: "SUPPLY", state: "open", action: "Explore issuance", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/b0504cf6-7c43-470d-b7dd-4e81e2811a05-bitcoin-supply-faceless-liam-v3.mp4" },
  { id: 6, title: "Bitcoin Pizza Day", copy: "The famous early purchase that showed bitcoin could be spent.", time: "0:36", unit: "HISTORY", state: "open", action: "Follow the timeline", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/07864fd6-0d3a-4b9f-832d-adfb14e9ee63-bitcoin-pizza-day-faceless-liam-v2.mp4" },
  { id: 7, title: "Bitcoin transaction speed", copy: "Blocks, confirmations and why settlement takes time.", time: "0:31", unit: "TRANSACTIONS", state: "open", action: "Watch confirmations", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/9a6891c9-8ce3-426c-a51c-6c3d4b238f7d-bitcoin-transaction-speed-faceless-liam-v2.mp4" },
];

const lessonTracks: Record<Course, Lesson[]> = { blockchain: blockchainLessons, bitcoin: bitcoinLessons, ethereum: ethereumLessons };

const campaigns = [
  { id: 1, brand: "Sticksy", title: "Campus café experience", type: "Creator", category: "Food & Drink", platform: "Instagram", reward: "₹500", places: "18 spots", tone: "coral", brief: "Visit, film the experience and publish an original Reel." },
  { id: 2, brand: "RKS Builders", title: "Property walkthrough", type: "Faceless Creator", category: "Real Estate", platform: "Instagram", reward: "₹750", places: "8 spots", tone: "blue", brief: "Create a voiceover walkthrough using approved property footage." },
  { id: 3, brand: "Web3 Partner", title: "Explain one wallet feature", type: "Clipper", category: "Crypto", platform: "YouTube", reward: "$12", places: "24 spots", tone: "violet", brief: "Turn the supplied session into one accurate vertical explainer." },
  { id: 4, brand: "Campus App", title: "Bring your first five users", type: "User Acquisition", category: "Technology", platform: "Referral", reward: "₹300", places: "40 spots", tone: "green", brief: "Share your tracked link and help five genuine students onboard." },
];

const facelessPartnerCharacters = [
  { key: "lightbulb", name: "The Idea", personality: "The one with the next big thought.", image: "/faceless-ip/lightbulb.png" },
  { key: "soccer", name: "The Player", personality: "Competitive, social and always in the game.", image: "/faceless-ip/soccer.png" },
  { key: "ethereum", name: "The Builder", personality: "Ships the contract and explains how it works.", image: "/faceless-ip/ethereum.png" },
  { key: "bitcoin", name: "The Believer", personality: "Conviction, culture and internet money energy.", image: "/faceless-ip/bitcoin.png" },
  { key: "oldmoney", name: "The Hustler", personality: "Markets the launch and brings the community.", image: "/faceless-ip/oldmoney.png" },
  { key: "virus", name: "The Rebel", personality: "Finds edge cases and breaks the product first.", image: "/faceless-ip/virus.png" },
];

const buildDemos = [
  { icon: "T", title: "Launch a community token", copy: "Choose a name, supply and purpose, then deploy to an Ethereum or Solana test network.", level: "BEGINNER", chain: "ETH + SOL" },
  { icon: "N", title: "Create an NFT collection", copy: "Mint student art, event passes or digital certificates with guided metadata.", level: "BEGINNER", chain: "ETH + SOL" },
  { icon: "R", title: "Tokenise a real-world example", copy: "Model shares, rights and payouts without claiming legal ownership of a real asset.", level: "INTERMEDIATE", chain: "ETH" },
  { icon: "V", title: "Campus voting app", copy: "Create proposals, collect test votes and inspect the public result.", level: "INTERMEDIATE", chain: "SOL" },
  { icon: "L", title: "Loyalty and rewards pass", copy: "Issue points or collectible stamps for a café, club or campus event.", level: "BEGINNER", chain: "SOL" },
  { icon: "G", title: "Token-gated mini game", copy: "Let a testnet collectible unlock a level, skin or leaderboard entry.", level: "EXPERIMENT", chain: "ETH + SOL" },
];

const games = [
  { id: 1, title: "Block Runner", copy: "Collect transactions, avoid invalid blocks and learn why confirmation matters.", chain: "SOLANA DEVNET", reward: "Block Builder badge", status: "PLAYABLE", color: "purple" },
  { id: 2, title: "Gas Dash", copy: "Choose when to submit actions while simulated network demand changes.", chain: "SEPOLIA", reward: "Gas Scout badge", status: "PLAYABLE", color: "amber" },
  { id: 3, title: "Liquidity Lab", copy: "Balance a two-token pool and see how swaps change its reserves.", chain: "SEPOLIA", reward: "Pool Operator badge", status: "COMING NEXT", color: "blue" },
];

const creatorTools = [
  { number: "01", title: "Phone setup", copy: "Frame vertically, find clean light, protect your audio and set up a simple background.", action: "Open setup guide" },
  { number: "02", title: "Shoot the five shots", copy: "Capture a hook, wide shot, detail, proof and call to action without overthinking it.", action: "Open shot practice" },
  { number: "03", title: "Hook and script lab", copy: "Turn a campaign brief into a first line, problem, proof and clear call to action.", action: "Draft with Mask" },
  { number: "04", title: "On-camera or faceless", copy: "Choose a UGC style that fits you: presenter, voiceover, hands-only, screen or B-roll.", action: "Choose my format" },
  { number: "05", title: "Edit in Instagram Edits", copy: "Polish pacing, captions, music and safe zones on the phone before publishing.", action: "Open edit checklist" },
  { number: "06", title: "Submit professionally", copy: "Check the brief, disclosures, links, quality and usage rights before sending work.", action: "Run final checks" },
];

const initialDrops: Drop[] = [
  { id: 1, title: "Ethereum Classroom 01", host: "Faceless × Mask", claimed: 84, supply: 150, tone: "violet" },
  { id: 2, title: "Wallet Safety Graduate", host: "Partner preview", claimed: 46, supply: 100, tone: "green" },
  { id: 3, title: "Builder Session Pass", host: "Campus Web3 Series", claimed: 18, supply: 75, tone: "amber" },
];

const marketItems = [
  { id: 1, title: "Mind Over Noise", creator: "Aarav · CSE", price: "0.018", image: "/faceless-blue.png", tag: "1 of 1" },
  { id: 2, title: "Purple Protocol", creator: "Meera · Design", price: "0.024", image: "/faceless-purple.png", tag: "1 of 3" },
  { id: 3, title: "Stable State", creator: "Team Orbit", price: "0.012", image: "/faceless-usdt.png", tag: "2 of 5" },
];

const rwaAssetFallbacks: RwaAsset[] = [
  { id: "campus_tower", symbol: "TOWER", name: "Campus Tower A", category: "Imaginary building", totalUnits: 1_000, priceCredits: 125, incomeModel: "Simulated rent", annualYieldBps: 680, rights: "A simulated share of the modelled rental pool; not a deed, security or legal claim.", risk: "Occupancy, maintenance and legal-enforcement risk", description: "Split a fictional student residence into digital units and explore ownership records, rent distribution and liquidity.", unitsHeld: 0, holders: 0, monthlyEstimateCredits: 0, incomeClaimedThisPeriod: false, cashflow: { grossMonthlyCredits: 1011, vacancyCredits: 51, operatingExpenseCredits: 202, reserveCredits: 51, netDistributableCredits: 707, annualYieldBps: 679, vacancyBps: 500, operatingExpenseBps: 2000, reserveBps: 500 }, creator: null },
  { id: "solar_roof", symbol: "SOLAR", name: "Solar Roof Co-op", category: "Imaginary energy asset", totalUnits: 2_500, priceCredits: 64, incomeModel: "Energy credits", annualYieldBps: 420, rights: "A simulated share of modelled energy credits; no ownership of physical panels.", risk: "Weather, equipment, pricing and counterparty risk", description: "Model how a campus solar installation could represent participation rights and simulated energy revenue.", unitsHeld: 0, holders: 0, monthlyEstimateCredits: 0, incomeClaimedThisPeriod: false, cashflow: { grossMonthlyCredits: 800, vacancyCredits: 24, operatingExpenseCredits: 120, reserveCredits: 96, netDistributableCredits: 560, annualYieldBps: 420, vacancyBps: 300, operatingExpenseBps: 1500, reserveBps: 1200 }, creator: null },
  { id: "creator_studio", symbol: "STUDIO", name: "Creator Studio Equipment", category: "Imaginary business asset", totalUnits: 500, priceCredits: 38, incomeModel: "Booking revenue", annualYieldBps: 810, rights: "A simulated share of modelled booking revenue; no claim over the equipment.", risk: "Utilisation, damage, depreciation and operator risk", description: "Explore fractional access to cameras and production gear through a fictional revenue-sharing structure.", unitsHeld: 0, holders: 0, monthlyEstimateCredits: 0, incomeClaimedThisPeriod: false, cashflow: { grossMonthlyCredits: 183, vacancyCredits: 15, operatingExpenseCredits: 33, reserveCredits: 7, netDistributableCredits: 128, annualYieldBps: 808, vacancyBps: 800, operatingExpenseBps: 1800, reserveBps: 400 }, creator: null },
];

function MaskOrb({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mask-orb live compact" : "mask-orb live"} aria-label="Mask AI co-host">
      <LiveMask className="live-mask-art" />
    </div>
  );
}

function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function decimalToUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a valid amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Use no more than ${decimals} decimal places`);
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

const faucetNetworkMeta: Record<FaucetNetwork, { label: string; asset: string; fallback: string; icon: string; className: string; explorer: (hash: string) => string }> = {
  ethereum: { label: "ETHEREUM · SEPOLIA", asset: "ETH", fallback: "0.002", icon: "Ξ", className: "eth", explorer: (hash) => `https://sepolia.etherscan.io/tx/${hash}` },
  solana: { label: "SOLANA · DEVNET", asset: "SOL", fallback: "0.05", icon: "S", className: "sol", explorer: (hash) => `https://explorer.solana.com/tx/${hash}?cluster=devnet` },
  robinhood: { label: "ROBINHOOD CHAIN · TESTNET", asset: "ETH", fallback: "0.001", icon: "R", className: "rh", explorer: (hash) => `https://explorer.testnet.chain.robinhood.com/tx/${hash}` },
};

function identityTokenExpiresSoon(token: string, leewaySeconds = 30) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp * 1_000 <= Date.now() + leewaySeconds * 1_000;
  } catch {
    return true;
  }
}

const solanaDevnetRpc = createSolanaRpc("/api/solana-rpc");
const sepoliaPublicClient = createPublicClient({ chain: sepolia, transport: http() });
const campusEditionMintAbi = [{
  type: "function",
  name: "mint",
  stateMutability: "payable",
  inputs: [{ name: "amount", type: "uint256" }],
  outputs: [],
}] as const;
const campusTokenTransferAbi = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

export default function OnchainLab() {
  const { ready: privyReady, authenticated, user, login, logout, linkWallet, exportWallet: exportEthereumWallet } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { refreshUser } = useUser();
  const { wallets: ethereumWallets } = useEthereumWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { sendTransaction: sendEthereumTransaction } = useSendEthereumTransaction();
  const { signAndSendTransaction: sendSolanaTransaction } = useSignAndSendTransaction();
  const { exportWallet: exportSolanaWallet } = useExportSolanaWallet();
  const [active, setActive] = useState<Tab>("home");
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [activeChain, setActiveChain] = useState<Chain>("ethereum");
  const [headClaimed, setHeadClaimed] = useState(false);
  const [toast, setToast] = useState("");
  const [drops, setDrops] = useState(initialDrops);
  const [claimedDrops, setClaimedDrops] = useState<number[]>([]);
  const [dropState, setDropState] = useState<DropState | null>(null);
  const [dropBusy, setDropBusy] = useState<string | null>(null);
  const [dropDraft, setDropDraft] = useState({ title: "", host: "", description: "", rewardLabel: "Campus credential", rewardKind: "credential" as PartnerReward["kind"], rewardAssetId: "", eligibility: "live_quest" as PartnerDrop["eligibility"], eligibilityRef: "", maxClaims: "200" });
  const [leagueState, setLeagueState] = useState<LeagueState | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [creatorProjectState, setCreatorProjectState] = useState<CreatorProjectState | null>(null);
  const [creatorProjectBusy, setCreatorProjectBusy] = useState(false);
  const [creatorDraft, setCreatorDraft] = useState<{ id: string; campaignId: string; title: string; platform: string; format: CreatorFormat; objective: string; hook: string; shots: string[]; caption: string }>({ id: "", campaignId: "", title: "", platform: "Instagram Reels", format: "faceless", objective: "", hook: "", shots: ["", "", "", "", ""], caption: "" });
  const [creatorReviewNotes, setCreatorReviewNotes] = useState<Record<string, string>>({});
  const [builderProjectState, setBuilderProjectState] = useState<BuilderProjectState | null>(null);
  const [builderProjectBusy, setBuilderProjectBusy] = useState(false);
  const [buildArea, setBuildArea] = useState<"ideas" | "studio" | "nft" | "showcase">("ideas");
  const [showcaseState, setShowcaseState] = useState<ShowcaseState | null>(null);
  const [showcaseBusyId, setShowcaseBusyId] = useState<string | null>(null);
  const [notificationState, setNotificationState] = useState<NotificationState | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [firstDayState, setFirstDayState] = useState<FirstDayState | null>(null);
  const [builderReviewNotes, setBuilderReviewNotes] = useState<Record<string, string>>({});
  const [builderInvite, setBuilderInvite] = useState({ username: "", role: "Developer" });
  const [builderDraft, setBuilderDraft] = useState<{ id: string; title: string; chain: BuilderProject["chain"]; useCase: string; problem: string; audience: string; solution: string; milestones: BuilderMilestone[]; contractReference: string; demoUrl: string }>({ id: "", title: "", chain: "ethereum", useCase: "NFTs & digital ownership", problem: "", audience: "", solution: "", milestones: ["Map the user flow", "Build the first working demo", "Test with a classmate", "Add testnet or demo proof"].map((label) => ({ label, done: false })), contractReference: "", demoUrl: "" });
  const [cohortState, setCohortState] = useState<CohortState | null>(null);
  const [cohortBusy, setCohortBusy] = useState(false);
  const [cohortJoinCode, setCohortJoinCode] = useState("");
  const [cohortError, setCohortError] = useState("");
  const [cohortDraft, setCohortDraft] = useState({ title: "", college: "", expectedStudents: "200" });
  const [cohortAssignmentDraft, setCohortAssignmentDraft] = useState({ cohortId: "", course: "blockchain" as Course, lessonId: "1", instructions: "", dueAt: "" });
  const [attendanceState, setAttendanceState] = useState<AttendanceState | null>(null);
  const [attendanceCode, setAttendanceCode] = useState("");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState({ cohortId: "", title: "", host: "Faceless", durationMinutes: "15" });
  const [passportState, setPassportState] = useState<PassportState | null>(null);
  const [passportDraft, setPassportDraft] = useState({ headline: "Blockchain learner · Onchain builder · Creator", bio: "" });
  const [passportBusy, setPassportBusy] = useState(false);
  const [passportError, setPassportError] = useState("");
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course>("ethereum");
  const [selectedLesson, setSelectedLesson] = useState<Lesson>(ethereumLessons[1]);
  const [maskQuestion, setMaskQuestion] = useState("");
  const [maskArtwork, setMaskArtwork] = useState<MaskArtwork | null>(null);
  const [launchArtwork, setLaunchArtwork] = useState<MaskArtwork | null>(null);
  const [maskArtworkRights, setMaskArtworkRights] = useState(false);
  const [maskMessages, setMaskMessages] = useState<MaskMessage[]>([{ role: "assistant", text: "Ask me anything. If it connects to a Faceless lesson, I’ll use the approved material. If it doesn’t, I’ll answer it normally." }]);
  const [maskBusy, setMaskBusy] = useState(false);
  const identityTokenRef = useRef<string | null>(identityToken);
  const [maskLaunchProgress, setMaskLaunchProgress] = useState<LaunchProgress | null>(null);
  const [launchDraft, setLaunchDraft] = useState<LaunchDraft | null>(null);
  const [launchReviewReady, setLaunchReviewReady] = useState(false);
  const [launchTransactionStatus, setLaunchTransactionStatus] = useState<LaunchTransactionStatus>("idle");
  const [launchTransactionError, setLaunchTransactionError] = useState("");
  const [launchDeployment, setLaunchDeployment] = useState<LaunchDeployment | null>(null);
  const [walletAssetView, setWalletAssetView] = useState<WalletAssetView>("all");
  const [walletNfts, setWalletNfts] = useState<WalletNft[]>([]);
  const [campusTokens, setCampusTokens] = useState<CampusToken[]>([]);
  const [walletAssetsLoading, setWalletAssetsLoading] = useState(false);
  const [walletAssetsError, setWalletAssetsError] = useState("");
  const [marketCollections, setMarketCollections] = useState<MarketCollection[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketFilter, setMarketFilter] = useState<"all" | Chain>("all");
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [marketBuyingId, setMarketBuyingId] = useState<string | null>(null);
  const [marketPurchaseHash, setMarketPurchaseHash] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [tokenRecipient, setTokenRecipient] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [tokenDetailTab, setTokenDetailTab] = useState<"exchange" | "airdrop">("exchange");
  const [tokenAirdrops, setTokenAirdrops] = useState<TokenAirdrop[]>([]);
  const [airdropAmount, setAirdropAmount] = useState("");
  const [airdropBusy, setAirdropBusy] = useState(false);
  const [airdropError, setAirdropError] = useState("");
  const [transactionQueue, setTransactionQueue] = useState<{ position: number; seconds: number } | null>(null);
  const [marketArea, setMarketArea] = useState<"nfts" | "tokens" | "rwas">("nfts");
  const [rwaState, setRwaState] = useState<RwaState | null>(null);
  const [rwaBusy, setRwaBusy] = useState<string | null>(null);
  const [rwaError, setRwaError] = useState("");
  const [rwaStudioOpen, setRwaStudioOpen] = useState(false);
  const [rwaDraft, setRwaDraft] = useState({ name: "", symbol: "", category: "Imaginary property", description: "", rights: "", incomeModel: "", risk: "", totalUnits: "1000", priceCredits: "100", grossMonthlyCredits: "10000", vacancyPercent: "5", operatingExpensePercent: "20", reservePercent: "5" });
  const [rwaClock, setRwaClock] = useState(Date.now());
  const [usdPrices, setUsdPrices] = useState<UsdPrices | null>(null);
  const [claimedCampaigns, setClaimedCampaigns] = useState<number[]>([]);
  const [campaignState, setCampaignState] = useState<CampaignState | null>(null);
  const [campaignBusy, setCampaignBusy] = useState<string | null>(null);
  const [campaignSubmitId, setCampaignSubmitId] = useState<string | null>(null);
  const [campaignContentUrl, setCampaignContentUrl] = useState("");
  const [campaignDraft, setCampaignDraft] = useState({ brand: "", title: "", brief: "", campaignType: "creator" as CampusCampaign["campaignType"], platform: "Instagram", spots: "50", rewardAmount: "500", rewardCurrency: "INR" });
  const [campaignPayout, setCampaignPayout] = useState({ submissionId: "", destinationReference: "", transactionReference: "" });
  const [partnerLabState, setPartnerLabState] = useState<PartnerLabState | null>(null);
  const [partnerLabBusy, setPartnerLabBusy] = useState(false);
  const [partnerTeamDraft, setPartnerTeamDraft] = useState({ name: "", inviteUsernames: "" });
  const [partnerSetupDraft, setPartnerSetupDraft] = useState({ characterKey: "lightbulb", tokenName: "", tokenSymbol: "", tokenPitch: "", initialBuyEth: "0" });
  const [partnerProofDraft, setPartnerProofDraft] = useState({ tokenAddress: "", transactionHash: "", feedbackReference: "", curveProgressPercent: "0" });
  const [username, setUsername] = useState("aanya");
  const [campusUsername, setCampusUsername] = useState("");
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "ready" | "error">("idle");
  const [profileError, setProfileError] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStatus, setTransferStatus] = useState<"idle" | "resolving" | "ready" | "sending" | "sent" | "error">("idle");
  const [transferError, setTransferError] = useState("");
  const [transferReceipt, setTransferReceipt] = useState<TransferReceipt | null>(null);
  const [launchMode, setLaunchMode] = useState<LaunchMode>("testnet");
  const [faucetState, setFaucetState] = useState<FaucetState | null>(null);
  const [faucetBusy, setFaucetBusy] = useState<FaucetNetwork | "prepare" | "">("");
  const [faucetError, setFaucetError] = useState("");
  const [faucetDraft, setFaucetDraft] = useState<Record<FaucetNetwork, { amount: string; maxClaims: number; enabled: boolean }>>({
    ethereum: { amount: "0.002", maxClaims: 1, enabled: false },
    solana: { amount: "0.05", maxClaims: 1, enabled: false },
    robinhood: { amount: "0.001", maxClaims: 1, enabled: false },
  });
  const [rabbyTransfer, setRabbyTransfer] = useState({ address: "", amount: "0.0008", status: "idle" as "idle" | "sending" | "sent" | "error", hash: "", error: "" });
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [learningBusy, setLearningBusy] = useState(false);
  const [classroomSession, setClassroomSession] = useState<ClassroomSession | null>(null);
  const [classroomActivity, setClassroomActivity] = useState<ClassroomActivity | null>(null);
  const [classroomProofs, setClassroomProofs] = useState<ClassroomProof[]>([]);
  const [classroomActivityBusy, setClassroomActivityBusy] = useState(false);
  const [educatorDashboard, setEducatorDashboard] = useState<EducatorDashboard | null>(null);
  const [educatorBusy, setEducatorBusy] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<{ quest: ClassroomQuest; title: string; instructions: string }>({ quest: "fund_wallets", title: "Fund your first wallet", instructions: "Claim one testnet asset, then open your wallet and find the transaction receipt." });
  const learningResumeApplied = useRef(false);
  const lastProgressSent = useRef(0);

  const ethereumWallet = ethereumWallets.find((item) => item.walletClientType === "privy") ?? ethereumWallets[0];
  const solanaWallet = solanaWallets[0];
  const ethWalletAddress = ethereumWallet?.address ?? "0x71F49A2C";
  const solWalletAddress = solanaWallet?.address ?? "8maZxQ7P";
  const ethWallet = shortenAddress(ethWalletAddress);
  const solWallet = shortenAddress(solWalletAddress);
  const wallet = activeChain === "ethereum" ? ethWallet : solWallet;
  const displayName = user?.google?.name ?? user?.google?.email?.split("@")[0] ?? "Aanya K.";
  const displayEmail = user?.google?.email ?? "Student · Cohort 04";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const onboarded = demoMode || (authenticated && profileStatus === "ready");
  const cohortLocked = !demoMode && onboarded && cohortState?.gateEnabled === true && cohortState.role === "student" && !cohortState.membership;
  const completed = learningState?.completedCount ?? 0;
  const progress = Math.round((completed / 25) * 100);
  const selectedProgress = learningState?.records.find((record) => record.course === selectedLesson.course && record.lessonId === selectedLesson.id);
  const selectedComplete = selectedProgress?.status === "completed";

  const title = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Home", [active]);
  const visibleMarketCollections = marketCollections.filter((collection) => {
    const chainMatches = marketFilter === "all" || collection.chain === marketFilter;
    const search = marketSearch.trim().toLowerCase();
    const textMatches = !search || `${collection.name} ${collection.symbol} ${collection.creator.username} ${collection.creator.displayName}`.toLowerCase().includes(search);
    return chainMatches && textMatches;
  });
  const selectedMarket = marketCollections.find((collection) => collection.id === selectedMarketId) ?? null;
  const selectedToken = campusTokens.find((token) => token.id === selectedTokenId) ?? null;
  const liveRwaAssets = rwaState?.assets ?? rwaAssetFallbacks;
  const rwaDistributionMs = Math.max(0, new Date(rwaState?.nextDistributionAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString()).getTime() - rwaClock);
  const rwaDistributionCountdown = `${Math.floor(rwaDistributionMs / 86_400_000)}d ${Math.floor((rwaDistributionMs % 86_400_000) / 3_600_000)}h`;
  const selectedAirdrop = tokenAirdrops.find((airdrop) => airdrop.tokenId === selectedTokenId && (airdrop.status === "draft" || airdrop.status === "open"))
    ?? tokenAirdrops.find((airdrop) => airdrop.tokenId === selectedTokenId) ?? null;

  useEffect(() => {
    identityTokenRef.current = identityToken;
  }, [identityToken]);

  useEffect(() => {
    if (authenticated) setLoading(false);
  }, [authenticated]);

  useEffect(() => {
    const pending = window.sessionStorage.getItem("campus_pending_username");
    if (pending) setUsername(pending);
  }, []);

  useEffect(() => {
    if (!authenticated || !identityToken || !ethereumWallet || !solanaWallet || profileStatus !== "idle") return;
    void saveCampusProfile();
  }, [authenticated, identityToken, ethereumWallet?.address, solanaWallet?.address, profileStatus]);

  useEffect(() => {
    if (!authenticated || identityToken || profileStatus !== "idle") return;
    const timer = window.setTimeout(() => {
      setProfileStatus("error");
      setProfileError("Identity tokens need to be enabled once in Privy before we can secure your username.");
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [authenticated, identityToken, profileStatus]);

  useEffect(() => {
    if (!authenticated || !ethereumWallet || !solanaWallet) return;
    void refreshBalances();
    void loadReferencePrices();
  }, [authenticated, ethereumWallet?.address, solanaWallet?.address]);

  useEffect(() => {
    if (!authenticated || !identityToken || profileStatus !== "ready") return;
    void loadFaucetState();
    void loadLearningState();
    void loadWalletAssets();
    void loadClassroomSession();
    void loadCampaigns();
    void loadPartnerLab();
    void loadDrops();
    void loadLeague();
    void loadCreatorProjects();
    void loadBuilderProjects();
    void loadShowcase();
    void loadNotifications();
    void loadFirstDay();
    void loadCohorts();
    void loadAttendance();
    void loadPassport();
  }, [authenticated, identityToken, profileStatus]);

  useEffect(() => {
    if (!authenticated || profileStatus !== "ready") return;
    const timer = window.setInterval(() => void loadClassroomSession(), 15_000);
    return () => window.clearInterval(timer);
  }, [authenticated, profileStatus]);

  useEffect(() => {
    if (active === "admin" && faucetState?.role === "owner") void loadEducatorDashboard();
  }, [active, faucetState?.role]);

  useEffect(() => {
    if (!authenticated || profileStatus !== "ready" || (active !== "home" && active !== "admin")) return;
    void loadFirstDay();
  }, [active, authenticated, profileStatus, cohortState?.membership?.id, leagueState?.own.xp]);

  useEffect(() => {
    if (active !== "admin" || faucetState?.role !== "owner") return;
    const timer = window.setInterval(() => void loadEducatorDashboard(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, faucetState?.role]);

  useEffect(() => {
    if (!authenticated || profileStatus !== "ready" || (active !== "home" && active !== "admin")) return;
    const timer = window.setInterval(() => void loadAttendance(), 10_000);
    return () => window.clearInterval(timer);
  }, [authenticated, profileStatus, active]);

  useEffect(() => {
    if (active !== "market" || marketCollections.length || marketLoading) return;
    void loadMarket();
  }, [active, marketCollections.length, marketLoading]);

  useEffect(() => {
    if (active !== "market" || marketArea !== "rwas" || !identityToken || rwaState || rwaBusy) return;
    void loadRwaState();
  }, [active, marketArea, identityToken, rwaState, rwaBusy]);

  useEffect(() => {
    if (active !== "market" || marketArea !== "rwas") return;
    setRwaClock(Date.now());
    const timer = window.setInterval(() => setRwaClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [active, marketArea]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function copyWalletAddress(chain: Chain) {
    const addressToCopy = chain === "ethereum" ? ethWalletAddress : solWalletAddress;
    const chainName = chain === "ethereum" ? "Ethereum" : "Solana";

    try {
      await navigator.clipboard.writeText(addressToCopy);
      notify(`${chainName} address copied`);
    } catch {
      const field = document.createElement("textarea");
      field.value = addressToCopy;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      notify(copied ? `${chainName} address copied` : `Could not copy the ${chainName} address`);
    }
  }

  async function loadFaucetState() {
    if (!identityToken) return;
    try {
      const response = await fetch("/api/faucet", { headers: { "privy-id-token": identityToken } });
      const result = await response.json() as FaucetState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Campus Faucet is unavailable");
      setFaucetState(result);
      setFaucetDraft(Object.fromEntries(result.chains.map((item) => [item.chain, {
        amount: item.amount,
        maxClaims: item.maxClaims,
        enabled: item.enabled,
      }])) as Record<FaucetNetwork, { amount: string; maxClaims: number; enabled: boolean }>);
      setFaucetError("");
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Campus Faucet is unavailable");
    }
  }

  async function loadLearningState() {
    if (!identityToken) return;
    try {
      const response = await fetch("/api/learning", { headers: { "privy-id-token": identityToken } });
      const result = await response.json() as LearningState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Learning progress is unavailable");
      setLearningState(result);
      if (!learningResumeApplied.current && result.resume) {
        const lesson = lessonTracks[result.resume.course].find((item) => item.id === result.resume?.lessonId);
        if (lesson) {
          setSelectedCourse(result.resume.course);
          setSelectedLesson(lesson);
        }
        learningResumeApplied.current = true;
      }
    } catch {
      // Lessons stay available even if progress sync is briefly unavailable.
    }
  }

  async function loadClassroomSession() {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return;
    try {
      const response = await fetch("/api/session", { headers: { "privy-id-token": requestToken } });
      const result = await response.json() as { session?: ClassroomSession | null; activity?: ClassroomActivity | null; proofs?: ClassroomProof[] };
      if (response.ok) { setClassroomSession(result.session ?? null); setClassroomActivity(result.activity ?? null); setClassroomProofs(result.proofs ?? []); }
    } catch { /* The next poll will retry quietly. */ }
  }

  async function updateClassroomActivity(action: "working" | "needs_help" | "complete") {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return;
    setClassroomActivityBusy(true);
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action }) });
      const result = await response.json() as { activity?: ClassroomActivity; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Quest status could not be updated");
      setClassroomActivity(result.activity ?? null);
      notify(action === "complete" ? "Onchain proof verified — quest complete" : action === "needs_help" ? "Your educator can now see that you need help" : "You are marked as working on the quest");
    } catch (error) { notify(error instanceof Error ? error.message : "Quest status could not be updated"); }
    finally { setClassroomActivityBusy(false); }
  }

  async function loadCampaigns() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/campaigns", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as CampaignState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campaigns are unavailable"); setCampaignState(result); } catch { /* Campaign previews remain visible during a brief outage. */ }
  }

  async function campaignAction(action: "join" | "submit" | "review" | "create" | "record_payment", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setCampaignBusy(String(payload.campaignId ?? payload.submissionId ?? action));
    try { const response = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as CampaignState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campaign action failed"); setCampaignState(result); setCampaignSubmitId(null); setCampaignContentUrl(""); if (action === "record_payment") setCampaignPayout({ submissionId: "", destinationReference: "", transactionReference: "" }); notify(action === "join" ? "Campaign added to your workspace" : action === "submit" ? "Work submitted for review" : action === "create" ? "Campaign published to students" : action === "record_payment" ? "Payment added to the student ledger" : "Submission review saved"); } catch (error) { notify(error instanceof Error ? error.message : "Campaign action failed"); } finally { setCampaignBusy(null); }
  }

  async function loadPartnerLab() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/partner-lab", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as PartnerLabState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Partner lab is unavailable"); setPartnerLabState(result); } catch { /* The campaign shell remains visible while Campus reconnects. */ }
  }

  async function partnerLabAction(action: "create_team" | "accept_invite" | "save_setup" | "submit_launch" | "submit_proof" | "update_curve" | "submit_graduation" | "submit_feedback" | "verify_team", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setPartnerLabBusy(true);
    try {
      const response = await fetch("/api/partner-lab", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json() as PartnerLabState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Partner-lab action failed");
      setPartnerLabState(result); setPartnerProofDraft({ tokenAddress: "", transactionHash: "", feedbackReference: "", curveProgressPercent: "0" });
      notify(action === "create_team" ? "Five-person team invitations sent" : action === "accept_invite" ? "You joined the partner-lab team" : action === "save_setup" ? "Faceless token setup saved" : action === "submit_launch" ? "Launch receipt added to the team proof" : action === "submit_proof" ? "Pressure-test proof saved" : action === "update_curve" ? "Live bonding progress updated" : action === "submit_graduation" ? "Graduation receipt saved" : action === "submit_feedback" ? "Founder feedback submission recorded" : "Team verified for the partner report");
      void loadFirstDayRunway();
    } catch (error) { notify(error instanceof Error ? error.message : "Partner-lab action failed"); }
    finally { setPartnerLabBusy(false); }
  }

  async function loadDrops() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/drops", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as DropState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Partner drops are unavailable"); setDropState(result); } catch { /* Preview drops remain visible during a brief outage. */ }
  }

  async function loadLeague() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setLeagueLoading(true);
    try { const response = await fetch("/api/league", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as LeagueState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campus League is unavailable"); setLeagueState(result); } catch (error) { notify(error instanceof Error ? error.message : "Campus League is unavailable"); } finally { setLeagueLoading(false); }
  }

  async function loadCreatorProjects() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/creator-projects", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as CreatorProjectState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Creator projects are unavailable"); setCreatorProjectState(result); } catch { /* The workspace remains editable and can retry on save. */ }
  }

  function openCreatorProject(project?: CreatorProject) {
    setCreatorDraft(project ? { id: project.id, campaignId: project.campaignId ?? "", title: project.title, platform: project.platform, format: project.format, objective: project.objective, hook: project.hook, shots: project.shots, caption: project.caption } : { id: "", campaignId: "", title: "", platform: "Instagram Reels", format: "faceless", objective: "", hook: "", shots: ["", "", "", "", ""], caption: "" });
  }

  async function saveCreatorProject(action: "save" | "mark_ready") {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setCreatorProjectBusy(true);
    try { const response = await fetch("/api/creator-projects", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...creatorDraft }) }); const result = await response.json() as CreatorProjectState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Creator project could not be saved"); setCreatorProjectState(result); if (result.projects[0]) openCreatorProject(result.projects[0]); notify(action === "mark_ready" ? "Content plan ready to shoot and edit" : "Creator project saved"); } catch (error) { notify(error instanceof Error ? error.message : "Creator project could not be saved"); } finally { setCreatorProjectBusy(false); }
  }

  async function creatorProjectReviewAction(action: "submit_review" | "review", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setCreatorProjectBusy(true);
    try { const response = await fetch("/api/creator-projects", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as CreatorProjectState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Creator review could not be updated"); setCreatorProjectState(result); const current = result.projects.find((project) => project.id === creatorDraft.id); if (current) openCreatorProject(current); notify(action === "submit_review" ? "Shoot plan sent for educator review" : "Creator plan review saved"); } catch (error) { notify(error instanceof Error ? error.message : "Creator review could not be updated"); } finally { setCreatorProjectBusy(false); }
  }

  async function loadBuilderProjects() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/builder-projects", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as BuilderProjectState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Project Studio is unavailable"); setBuilderProjectState(result); } catch { /* Project Studio retries on the next action. */ }
  }

  async function loadShowcase() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/showcase", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as ShowcaseState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campus Showcase is unavailable"); setShowcaseState(result); } catch { /* Showcase retries on the next action. */ }
  }

  async function showcaseAction(action: "applaud" | "feature" | "unfeature", projectId: string) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setShowcaseBusyId(projectId);
    try { const response = await fetch("/api/showcase", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, projectId }) }); const result = await response.json() as ShowcaseState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Showcase could not be updated"); setShowcaseState(result); notify(action === "applaud" ? "Campus applause updated" : action === "feature" ? "Project featured for demo day" : "Project removed from the featured row"); } catch (error) { notify(error instanceof Error ? error.message : "Showcase could not be updated"); } finally { setShowcaseBusyId(null); }
  }

  async function loadNotifications() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/notifications", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as NotificationState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campus Inbox is unavailable"); setNotificationState(result); } catch { /* Inbox retries when opened. */ }
  }

  async function notificationAction(action: "mark" | "mark_all", key?: string) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setNotificationBusy(true);
    try { const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, key }) }); const result = await response.json() as NotificationState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Campus Inbox could not be updated"); setNotificationState(result); } catch (error) { notify(error instanceof Error ? error.message : "Campus Inbox could not be updated"); } finally { setNotificationBusy(false); }
  }

  function openNotification(notification: CampusNotification) {
    if (!notification.read) void notificationAction("mark", notification.key);
    if (notification.destination === "create") setBuildArea("studio");
    setActive(notification.destination);
    setNotificationOpen(false);
  }

  async function loadFirstDay() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/onboarding", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as FirstDayState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "First-Day Runway is unavailable"); setFirstDayState(result); } catch { /* Runway refreshes with the next verified Campus action. */ }
  }

  function openFirstDayStep(step: FirstDayStep) {
    if (step.id === "transaction") setMarketArea("nfts");
    setActive(step.destination);
  }

  function openBuilderProject(project?: BuilderProject) {
    setBuilderDraft(project ? { id: project.id, title: project.title, chain: project.chain, useCase: project.useCase, problem: project.problem, audience: project.audience, solution: project.solution, milestones: project.milestones, contractReference: project.contractReference ?? "", demoUrl: project.demoUrl ?? "" } : { id: "", title: "", chain: activeChain, useCase: "NFTs & digital ownership", problem: "", audience: "", solution: "", milestones: ["Map the user flow", "Build the first working demo", "Test with a classmate", "Add testnet or demo proof"].map((label) => ({ label, done: false })), contractReference: "", demoUrl: "" });
  }

  async function builderProjectAction(action: "save" | "submit" | "review" | "invite" | "respond" | "remove_member", payload: Record<string, unknown> = {}) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setBuilderProjectBusy(true);
    try { const response = await fetch("/api/builder-projects", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...(action === "save" ? builderDraft : {}), ...payload }) }); const result = await response.json() as BuilderProjectState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Project could not be updated"); setBuilderProjectState(result); const current = result.projects.find((project) => project.id === builderDraft.id) ?? result.projects[0]; if (current) openBuilderProject(current); else openBuilderProject(); if (action === "review") { void loadPassport(); void loadShowcase(); } if (action === "invite") setBuilderInvite((currentInvite) => ({ ...currentInvite, username: "" })); notify(action === "submit" ? "Project sent for educator verification" : action === "review" ? payload.status === "verified" ? "Project verified and added to every accepted teammate’s Passport" : "Project feedback sent to the student" : action === "invite" ? "Campus teammate invited" : action === "respond" ? payload.status === "accepted" ? "Team invitation accepted" : "Team invitation declined" : action === "remove_member" ? "Project team updated" : "Build project saved"); } catch (error) { notify(error instanceof Error ? error.message : "Project could not be updated"); } finally { setBuilderProjectBusy(false); }
  }

  function copyCreatorPlan() {
    const format = creatorDraft.format.replaceAll("_", " ");
    const plan = `${creatorDraft.title}\n${creatorDraft.platform} · ${format}\n\nOBJECTIVE\n${creatorDraft.objective}\n\nHOOK\n${creatorDraft.hook}\n\nFIVE SHOTS\n${creatorDraft.shots.map((shot, index) => `${index + 1}. ${shot}`).join("\n")}\n\nCAPTION\n${creatorDraft.caption}`;
    void navigator.clipboard.writeText(plan).then(() => notify("Shoot plan copied — paste it into Notes or your editing workflow"));
  }

  async function loadCohorts() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/cohorts", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as CohortState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Cohort access is unavailable"); setCohortState(result); } catch { /* A later refresh or action will retry. */ }
  }

  async function cohortAction(action: "create" | "join" | "set_enrollment" | "complete" | "move" | "assign_lesson" | "archive_assignment", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setCohortBusy(true); setCohortError("");
    try { const response = await fetch("/api/cohorts", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as CohortState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Cohort action failed"); setCohortState(result); if (action === "create") setCohortDraft({ title: "", college: "", expectedStudents: "200" }); if (action === "assign_lesson") setCohortAssignmentDraft((current) => ({ ...current, instructions: "", dueAt: "" })); if (action === "join") { setCohortJoinCode(""); void loadLeague(); } notify(action === "join" ? "Welcome to your Campus cohort" : action === "create" ? "Private cohort opened" : action === "assign_lesson" ? "Lesson assigned to the cohort" : "Cohort settings updated"); } catch (error) { const message = error instanceof Error ? error.message : "Cohort action failed"; setCohortError(message); notify(message); } finally { setCohortBusy(false); }
  }

  async function loadAttendance() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/attendance", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as AttendanceState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Attendance is unavailable"); setAttendanceState(result); } catch { /* The next classroom refresh retries quietly. */ }
  }

  async function attendanceAction(action: "open" | "check_in" | "close", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setAttendanceBusy(true); setAttendanceError("");
    try { const response = await fetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as AttendanceState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Attendance could not be updated"); setAttendanceState(result); if (action === "open") setAttendanceDraft((current) => ({ ...current, title: "" })); if (action === "check_in") setAttendanceCode(""); notify(action === "open" ? "Live check-in opened" : action === "check_in" ? "Attendance verified ✓" : "Attendance check-in closed"); } catch (error) { const message = error instanceof Error ? error.message : "Attendance could not be updated"; setAttendanceError(message); notify(message); } finally { setAttendanceBusy(false); }
  }

  async function loadPassport() {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    try { const response = await fetch("/api/passport", { headers: { "privy-id-token": requestToken } }); const result = await response.json() as PassportState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Proof Passport is unavailable"); setPassportState(result); setPassportDraft({ headline: result.settings.headline, bio: result.settings.bio }); } catch { /* Passport can retry when the student opens it. */ }
  }

  async function passportAction(action: "save" | "rotate" | "unpublish", payload: Record<string, unknown> = {}) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setPassportBusy(true); setPassportError("");
    try { const response = await fetch("/api/passport", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as PassportState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Proof Passport could not be updated"); setPassportState(result); setPassportDraft({ headline: result.settings.headline, bio: result.settings.bio }); notify(action === "unpublish" ? "Proof Passport is private again" : action === "rotate" ? "A new private share link was created" : result.settings.isPublic ? "Proof Passport published" : "Passport details saved"); } catch (error) { setPassportError(error instanceof Error ? error.message : "Proof Passport could not be updated"); } finally { setPassportBusy(false); }
  }

  async function copyPassportLink() {
    if (!passportState?.settings.sharePath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${passportState.settings.sharePath}`);
    notify("Public Proof Passport link copied");
  }

  function exportAttendance(session: AttendanceSession) {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Session", "Cohort", "Name", "Username", "Email", "Checked in at"], ...session.records.map((record) => [session.title, session.cohortTitle, record.displayName ?? "Student", `@${record.username ?? "student"}`, record.email ?? "", record.checkedInAt])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attendance.csv`; link.click(); URL.revokeObjectURL(url); notify("Attendance roster downloaded");
  }

  function exportCohortRoster(cohort: CampusCohort) {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Name", "Username", "Email", "Ethereum address", "Solana address", "Lessons completed", "Joined at"], ...cohort.roster.map((student) => [student.displayName, `@${student.username}`, student.email, student.ethereumAddress, student.solanaAddress, student.lessonsCompleted, student.joinedAt])];
    const csv = rows.map((row) => row.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${cohort.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-roster.csv`; link.click(); URL.revokeObjectURL(url); notify("Cohort roster downloaded");
  }

  async function partnerDropAction(action: "create" | "claim", payload: Record<string, unknown>) {
    const requestToken = await campusIdentityToken(); if (!requestToken) return;
    setDropBusy(String(payload.dropId ?? action));
    try { const response = await fetch("/api/drops", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...payload }) }); const result = await response.json() as DropState & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Partner drop action failed"); setDropState(result); if (action === "create") { setDropDraft({ title: "", host: "", description: "", rewardLabel: "Campus credential", rewardKind: "credential", rewardAssetId: "", eligibility: "live_quest", eligibilityRef: "", maxClaims: "200" }); notify("Partner drop opened to students"); } else { const claimed = result.drops.find((item) => item.id === payload.dropId); notify(claimed?.rewardKind === "credential" ? "Partner credential added to your Passport" : "Verified — your onchain reward is unlocked"); } } catch (error) { notify(error instanceof Error ? error.message : "Partner drop action failed"); } finally { setDropBusy(null); }
  }

  function openPartnerReward(drop: PartnerDrop) {
    if (!drop.reward) return notify("This reward is not available yet");
    if (drop.reward.kind === "token_airdrop" && drop.reward.tokenId) {
      setMarketArea("tokens"); setSelectedTokenId(drop.reward.tokenId); setTokenDetailTab("airdrop"); setActive("market");
      notify("Token reward opened — claim it to your Campus wallet");
    } else if (drop.reward.kind === "nft_mint" && drop.reward.id) {
      setMarketArea("nfts"); setSelectedMarketId(drop.reward.id); setActive("market");
      notify("Collectible reward opened — your wallet approves the mint");
    }
  }

  async function loadEducatorDashboard() {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return;
    setEducatorBusy(true);
    try {
      const response = await fetch("/api/admin/dashboard", { headers: { "privy-id-token": requestToken } });
      const result = await response.json() as EducatorDashboard & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Classroom dashboard is unavailable");
      setEducatorDashboard(result);
      setClassroomSession(result.currentSession);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Classroom dashboard is unavailable");
    } finally { setEducatorBusy(false); }
  }

  async function updateClassroomSession(action: "start_session" | "end_session") {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return;
    setEducatorBusy(true);
    try {
      const response = await fetch("/api/admin/dashboard", { method: "POST", headers: { "content-type": "application/json", "privy-id-token": requestToken }, body: JSON.stringify({ action, ...sessionDraft }) });
      const result = await response.json() as EducatorDashboard & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The classroom session could not be updated");
      setEducatorDashboard(result);
      setClassroomSession(result.currentSession);
      notify(action === "start_session" ? "Live quest sent to the class" : "Classroom session ended");
    } catch (error) { notify(error instanceof Error ? error.message : "The classroom session could not be updated"); }
    finally { setEducatorBusy(false); }
  }

  function chooseSessionQuest(quest: ClassroomQuest) {
    const templates: Record<ClassroomQuest, { title: string; instructions: string }> = {
      fund_wallets: { title: "Fund your first wallet", instructions: "Claim one testnet asset, then open your wallet and find the transaction receipt." },
      send_token: { title: "Send a token to a classmate", instructions: "Choose a classmate by username, review the wallet address, then approve the testnet transfer." },
      mint_nft: { title: "Mint your first NFT", instructions: "Open the NFT market, choose a classroom collection and approve one testnet mint." },
      buy_rwa: { title: "Buy a tokenised asset", instructions: "Open the RWA market, inspect the cash-flow waterfall and buy one fictional unit with practice credits." },
      launch_token: { title: "Launch a classroom token", instructions: "Ask Mask to prepare a token, review every field, then deploy it on Sepolia or Solana Devnet." },
    };
    setSessionDraft({ quest, ...templates[quest] });
  }

  function downloadClassReport() {
    if (!educatorDashboard) return;
    const escape = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
    const headings = ["Name", "Username", "Email", "Ethereum wallet", "Solana wallet", "Lessons completed", "Assets created", "Live quest status", "Verified proof", "Issues"];
    const rows = educatorDashboard.roster.map((student) => [student.displayName, `@${student.username}`, student.email, student.ethereumReady, student.solanaReady, student.lessonsCompleted, student.assetsCreated, student.sessionStatus ?? "not_started", student.proofLabel ?? "", student.issues.join("; ")]);
    const csv = [headings, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `faceless-campus-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    notify("Class report downloaded");
  }

  async function loadWalletAssets() {
    if (!identityToken) return;
    setWalletAssetsLoading(true);
    setWalletAssetsError("");
    try {
      const [response, tokenResponse, airdropResponse] = await Promise.all([
        fetch("/api/launch", { headers: { "privy-id-token": identityToken } }),
        fetch("/api/tokens", { headers: { "privy-id-token": identityToken } }),
        fetch("/api/airdrops", { headers: { "privy-id-token": identityToken } }),
      ]);
      const result = await response.json() as { nfts?: WalletNft[]; resumableLaunch?: ResumableLaunch | null; error?: string };
      const tokenResult = await tokenResponse.json() as { tokens?: CampusToken[]; error?: string };
      const airdropResult = await airdropResponse.json() as { airdrops?: TokenAirdrop[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Wallet assets are unavailable");
      if (!tokenResponse.ok) throw new Error(tokenResult.error ?? "Campus tokens are unavailable");
      if (!airdropResponse.ok) throw new Error(airdropResult.error ?? "Token airdrops are unavailable");
      setWalletNfts(result.nfts ?? []);
      setCampusTokens(tokenResult.tokens ?? []);
      setTokenAirdrops(airdropResult.airdrops ?? []);
      if (result.resumableLaunch && !launchDeployment) {
        const pending = result.resumableLaunch;
        setLaunchDraft({
          assetType: "nft_collection",
          chain: pending.chain,
          name: pending.name,
          symbol: pending.symbol,
          description: pending.description,
          supply: pending.maxSupply,
          mintPrice: pending.mintPrice,
          royaltyPercent: pending.royaltyPercent,
          decimals: null,
          purpose: pending.purpose,
          artworkReady: true,
          authorityMode: null,
        });
        setLaunchDeployment({
          chain: pending.chain,
          launchId: pending.launchId,
          metadataUrl: pending.metadataUrl,
          deployHash: pending.deployHash,
          contractAddress: pending.contractAddress,
        });
        setArtPreview(pending.image);
        setActiveChain(pending.chain);
        setLaunchReviewReady(true);
        setLaunchTransactionStatus("deployed");
      }
    } catch (error) {
      setWalletAssetsError(error instanceof Error ? error.message : "Wallet assets are unavailable");
    } finally {
      setWalletAssetsLoading(false);
    }
  }

  async function loadMarket() {
    setMarketLoading(true);
    setMarketError("");
    try {
      const response = await fetch("/api/market");
      const result = await response.json() as { collections?: MarketCollection[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Campus Market is unavailable");
      setMarketCollections(result.collections ?? []);
      const requestToken = await campusIdentityToken();
      if (requestToken) {
        const [tokenResponse, airdropResponse] = await Promise.all([
          fetch("/api/tokens", { headers: { "privy-id-token": requestToken } }),
          fetch("/api/airdrops", { headers: { "privy-id-token": requestToken } }),
        ]);
        const tokenResult = await tokenResponse.json() as { tokens?: CampusToken[]; error?: string };
        const airdropResult = await airdropResponse.json() as { airdrops?: TokenAirdrop[] };
        if (tokenResponse.ok) setCampusTokens(tokenResult.tokens ?? []);
        if (airdropResponse.ok) setTokenAirdrops(airdropResult.airdrops ?? []);
      }
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Campus Market is unavailable");
    } finally {
      setMarketLoading(false);
    }
  }

  async function buyMarketCollection(collection: MarketCollection) {
    if (collection.chain === "solana") return void mintPublicSolanaCollection(collection);
    if (!authenticated || !identityToken) return notify("Sign in before collecting an NFT");
    if (!ethereumWallet) return notify("Your Campus Ethereum wallet is unavailable");
    if (collection.minted >= collection.maxSupply) return notify("This edition is sold out");
    setMarketBuyingId(collection.id);
    setMarketPurchaseHash(null);
    try {
      await ethereumWallet.switchChain(11155111);
      const value = parseEther(collection.mintPrice || "0");
      const data = encodeFunctionData({ abi: campusEditionMintAbi, functionName: "mint", args: [1n] });
      const { hash } = await sendEthereumTransaction(
        { to: collection.contractAddress as Hex, data, value, chainId: 11155111 },
        { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } },
      );
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
      if (receipt.status !== "success") throw new Error("Sepolia rejected the mint. No NFT was purchased.");
      setMarketPurchaseHash(hash);
      const requestToken = await campusIdentityToken();
      if (requestToken) {
        const record = await fetch("/api/market", {
          method: "POST",
          headers: { "content-type": "application/json", "privy-id-token": requestToken },
          body: JSON.stringify({ collectionId: collection.id, transactionHash: hash, buyerAddress: ethereumWallet.address }),
        });
        const recorded = await record.json() as { error?: string };
        if (!record.ok) throw new Error(recorded.error ?? "The NFT minted, but Campus could not save the receipt");
      }
      await Promise.all([loadMarket(), loadWalletAssets()]);
      notify(`${collection.name} was minted to your Campus wallet`);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "The NFT could not be purchased");
    } finally {
      setMarketBuyingId(null);
    }
  }

  async function preparePublicSolanaMint(collection: MarketCollection) {
    if (!solanaWallet || solanaWallet.address !== collection.creatorAddress) return notify("Only the collection creator can open its public mint");
    const remaining = collection.maxSupply - collection.minted;
    if (remaining < 1) return notify("This collection is already fully minted");
    setMarketBuyingId(collection.id);
    setMarketPurchaseHash(null);
    setMarketError("");
    try {
      await waitForCampusSolanaTurn();
      const { umi, studentSigner } = createStudentUmi();
      const candyMachine = generateSigner(umi);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${collection.id}:${collection.metadata}:${remaining}`));
      const price = Number(collection.mintPrice || "0");
      const builder = await createCoreCandyMachine(umi, {
        candyMachine,
        collection: publicKey(collection.contractAddress),
        collectionUpdateAuthority: studentSigner,
        authority: studentSigner.publicKey,
        itemsAvailable: remaining,
        isMutable: true,
        configLineSettings: none(),
        hiddenSettings: some({ name: collection.name, uri: collection.metadata, hash: new Uint8Array(digest) }),
        guards: price > 0 ? { solPayment: some({ lamports: sol(price), destination: studentSigner.publicKey }) } : {},
      });
      let transaction = await builder.buildWithLatestBlockhash(umi);
      transaction = await candyMachine.signTransaction(transaction);
      const { signature } = await sendCampusSolanaTransaction(umi.transactions.serialize(transaction));
      const hash = getBase58Decoder().decode(signature);
      await waitForSolanaConfirmation(hash);
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh the page and try once more.");
      const record = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "record_sale", launchId: collection.id, transactionHash: hash, candyMachineAddress: candyMachine.publicKey.toString() }),
      });
      const result = await record.json() as { error?: string };
      if (!record.ok) throw new Error(result.error ?? "The public mint was created, but Campus could not save it");
      setMarketPurchaseHash(hash);
      await loadMarket();
      notify(`${collection.name} is now open for student minting`);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "The public Solana mint could not be prepared");
    } finally {
      setMarketBuyingId(null);
    }
  }

  async function mintPublicSolanaCollection(collection: MarketCollection) {
    if (!authenticated) return notify("Sign in before minting an NFT");
    if (!solanaWallet) return notify("Your Campus Solana wallet is unavailable");
    if (!collection.candyMachineAddress) return notify("The creator has not opened this public mint yet");
    if (collection.minted >= collection.maxSupply) return notify("This collection is sold out");
    setMarketBuyingId(collection.id);
    setMarketPurchaseHash(null);
    setMarketError("");
    try {
      await waitForCampusSolanaTurn();
      const { umi } = createStudentUmi();
      const asset = generateSigner(umi);
      const price = Number(collection.mintPrice || "0");
      const builder = mintCoreCandyMachine(umi, {
        candyMachine: publicKey(collection.candyMachineAddress),
        asset,
        collection: publicKey(collection.contractAddress),
        mintArgs: price > 0 ? { solPayment: some({ destination: publicKey(collection.creatorAddress) }) } : {},
      });
      let transaction = await builder.buildWithLatestBlockhash(umi);
      transaction = await asset.signTransaction(transaction);
      const { signature } = await sendCampusSolanaTransaction(umi.transactions.serialize(transaction));
      const hash = getBase58Decoder().decode(signature);
      await waitForSolanaConfirmation(hash);
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh the page and try once more.");
      const record = await fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ collectionId: collection.id, transactionHash: hash, buyerAddress: solanaWallet.address, assetAddress: asset.publicKey.toString() }),
      });
      const result = await record.json() as { error?: string };
      if (!record.ok) throw new Error(result.error ?? "The NFT minted, but Campus could not save the receipt");
      setMarketPurchaseHash(hash);
      await Promise.all([loadMarket(), loadWalletAssets()]);
      notify(`${collection.name} was minted to your Solana Campus wallet`);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "The Solana NFT could not be minted");
    } finally {
      setMarketBuyingId(null);
    }
  }

  async function mintCreatorSolanaCollection(collection: MarketCollection) {
    if (!solanaWallet || solanaWallet.address !== collection.creatorAddress) return notify("Only the collection creator can mint this first Core edition");
    setMarketBuyingId(collection.id);
    setMarketPurchaseHash(null);
    setMarketError("");
    try {
      await waitForCampusSolanaTurn();
      const { umi, studentSigner } = createStudentUmi();
      const coreCollection = await fetchCollection(umi, publicKey(collection.contractAddress));
      const assetSigner = generateSigner(umi);
      const builder = createCoreAsset(umi, {
        asset: assetSigner,
        collection: coreCollection,
        authority: studentSigner,
        payer: studentSigner,
        owner: studentSigner.publicKey,
        updateAuthority: studentSigner.publicKey,
        name: `${collection.name} #1`,
        uri: collection.metadata,
        plugins: [{ type: "Edition", number: 1 }],
      });
      let transaction = await builder.buildWithLatestBlockhash(umi);
      transaction = await assetSigner.signTransaction(transaction);
      const serialized = umi.transactions.serialize(transaction);
      const { signature } = await sendCampusSolanaTransaction(serialized);
      const hash = getBase58Decoder().decode(signature);
      await waitForSolanaConfirmation(hash);
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh the page and try once more.");
      const record = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "record_mint", launchId: collection.id, transactionHash: hash, assetAddress: assetSigner.publicKey.toString() }),
      });
      const result = await record.json() as { error?: string };
      if (!record.ok) throw new Error(result.error ?? "The Core NFT minted, but Campus could not save its receipt");
      await Promise.all([loadMarket(), loadWalletAssets()]);
      notify(`${collection.name} #1 was minted to your Solana Campus wallet`);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "The first Solana edition could not be minted");
    } finally {
      setMarketBuyingId(null);
    }
  }

  async function loadRwaState() {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return;
    setRwaBusy("loading");
    setRwaError("");
    try {
      const response = await fetch("/api/rwa", { headers: { "privy-id-token": requestToken } });
      const result = await response.json() as RwaState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The RWA practice market is unavailable");
      setRwaState(result);
    } catch (error) {
      setRwaError(error instanceof Error ? error.message : "The RWA practice market is unavailable");
    } finally {
      setRwaBusy(null);
    }
  }

  async function tradeRwa(assetId: string, side: "buy" | "sell") {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return notify("Sign in to use the RWA practice market");
    setRwaBusy(`${assetId}:${side}`);
    setRwaError("");
    try {
      const response = await fetch("/api/rwa", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "trade", assetId, side, units: 1 }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The practice trade could not be completed");
      setRwaState(null);
      notify(`${side === "buy" ? "Bought" : "Sold"} 1 practice unit`);
    } catch (error) {
      setRwaError(error instanceof Error ? error.message : "The practice trade could not be completed");
    } finally {
      setRwaBusy(null);
    }
  }

  async function createRwaCaseStudy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestToken = await campusIdentityToken();
    if (!requestToken) return notify("Sign in to publish an RWA case study");
    setRwaBusy("create");
    setRwaError("");
    try {
      const response = await fetch("/api/rwa", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "create", ...rwaDraft, totalUnits: Number(rwaDraft.totalUnits), priceCredits: Number(rwaDraft.priceCredits) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The RWA case study could not be published");
      setRwaDraft({ name: "", symbol: "", category: "Imaginary property", description: "", rights: "", incomeModel: "", risk: "", totalUnits: "1000", priceCredits: "100", grossMonthlyCredits: "10000", vacancyPercent: "5", operatingExpensePercent: "20", reservePercent: "5" });
      setRwaStudioOpen(false);
      setRwaState(null);
      notify("Your fictional RWA is live in the Campus practice market");
    } catch (error) {
      setRwaError(error instanceof Error ? error.message : "The RWA case study could not be published");
    } finally {
      setRwaBusy(null);
    }
  }

  async function claimRwaIncome(asset: RwaAsset) {
    const requestToken = await campusIdentityToken();
    if (!requestToken) return notify("Sign in to receive the simulated distribution");
    setRwaBusy(`${asset.id}:income`);
    setRwaError("");
    try {
      const response = await fetch("/api/rwa", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "claim_income", assetId: asset.id }),
      });
      const result = await response.json() as { amountCredits?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "The simulated income could not be distributed");
      setRwaState(null);
      notify(`${result.amountCredits ?? asset.monthlyEstimateCredits} simulated rent credits added`);
    } catch (error) {
      setRwaError(error instanceof Error ? error.message : "The simulated income could not be distributed");
    } finally {
      setRwaBusy(null);
    }
  }

  async function loadReferencePrices() {
    try {
      const response = await fetch("/api/prices");
      const result = await response.json() as { usd?: UsdPrices };
      if (response.ok && result.usd) setUsdPrices(result.usd);
    } catch {
      // Balances remain usable when the optional market reference is unavailable.
    }
  }

  async function saveLessonProgress(lesson: Lesson, status: "in_progress" | "completed", positionSeconds = 0, durationSeconds = 0) {
    if (!identityToken || learningBusy) return;
    if (status === "completed") setLearningBusy(true);
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({ course: lesson.course, lessonId: lesson.id, status, positionSeconds, durationSeconds }),
      });
      const result = await response.json() as LearningState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Lesson progress could not be saved");
      setLearningState(result);
      if (status === "completed") notify(`${lesson.title} completed — activity unlocked`);
    } catch (error) {
      if (status === "completed") notify(error instanceof Error ? error.message : "Lesson progress could not be saved");
    } finally {
      if (status === "completed") setLearningBusy(false);
    }
  }

  function trackVideoProgress(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    const now = Math.floor(video.currentTime);
    if (now - lastProgressSent.current < 10) return;
    lastProgressSent.current = now;
    void saveLessonProgress(selectedLesson, "in_progress", now, Math.floor(video.duration || 0));
  }

  function resumeLearningQuest() {
    const resume = learningState?.resume;
    if (resume) {
      const lesson = lessonTracks[resume.course].find((item) => item.id === resume.lessonId);
      if (lesson) {
        setSelectedCourse(resume.course);
        setSelectedLesson(lesson);
      }
    }
    setActive("learn");
  }

  async function claimCampusFaucet(chain: FaucetNetwork = activeChain) {
    if (!identityToken) return notify("Sign in to claim classroom test funds");
    if (chain !== "robinhood") setActiveChain(chain);
    setFaucetBusy(chain);
    setFaucetError("");
    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({ chain }),
      });
      const result = await response.json() as { ok?: boolean; amount?: string; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Test funds could not be sent");
      notify(`${result.amount} ${chain === "ethereum" ? "Sepolia ETH" : chain === "solana" ? "Devnet SOL" : "Robinhood test ETH"} sent to your wallet`);
      await loadFaucetState();
      window.setTimeout(() => void refreshBalances(), 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test funds could not be sent";
      setFaucetError(message);
      notify(message);
      await loadFaucetState();
    } finally {
      setFaucetBusy("");
    }
  }

  async function prepareFaucetWallets() {
    if (!identityToken) return;
    setFaucetBusy("prepare");
    setFaucetError("");
    try {
      const response = await fetch("/api/faucet/admin", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({ action: "prepare" }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Distributor wallets could not be prepared");
      notify("All Campus Faucet wallets are ready to fund");
      await loadFaucetState();
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Distributor wallets could not be prepared");
    } finally {
      setFaucetBusy("");
    }
  }

  async function saveFaucetConfig(chain: FaucetNetwork) {
    if (!identityToken) return;
    setFaucetBusy(chain);
    setFaucetError("");
    try {
      const response = await fetch("/api/faucet/admin", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({ action: "update", chain, ...faucetDraft[chain] }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Faucet settings could not be saved");
      notify(`${chain === "ethereum" ? "Sepolia" : chain === "solana" ? "Solana Devnet" : "Robinhood Testnet"} faucet settings saved`);
      await loadFaucetState();
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Faucet settings could not be saved");
    } finally {
      setFaucetBusy("");
    }
  }

  async function sendRobinhoodFundsToRabby(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = rabbyTransfer.address.trim();
    if (!ethereumWallet) return setRabbyTransfer((current) => ({ ...current, status: "error", error: "Your Campus Ethereum wallet is unavailable" }));
    if (!isAddress(destination)) return setRabbyTransfer((current) => ({ ...current, status: "error", error: "Paste the 0x address shown inside your Rabby wallet" }));
    if (destination.toLowerCase() === ethereumWallet.address.toLowerCase()) return setRabbyTransfer((current) => ({ ...current, status: "error", error: "Paste your Rabby address, not your Campus wallet address" }));
    if (!/^\d+(\.\d{1,18})?$/.test(rabbyTransfer.amount)) return setRabbyTransfer((current) => ({ ...current, status: "error", error: "Enter a valid test ETH amount" }));
    const value = parseEther(rabbyTransfer.amount);
    if (value <= 0n || value > parseEther("0.005")) return setRabbyTransfer((current) => ({ ...current, status: "error", error: "Send between 0 and 0.005 test ETH" }));
    setRabbyTransfer((current) => ({ ...current, status: "sending", error: "", hash: "" }));
    try {
      await ethereumWallet.switchChain(46630);
      const { hash } = await sendEthereumTransaction(
        { to: destination as Hex, value, chainId: 46630 },
        { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } },
      );
      setRabbyTransfer((current) => ({ ...current, status: "sent", hash, error: "" }));
      notify("Robinhood test ETH sent to Rabby");
    } catch (error) {
      setRabbyTransfer((current) => ({ ...current, status: "error", error: error instanceof Error ? error.message : "The Rabby transfer was not completed" }));
    }
  }

  async function saveCampusProfile() {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(cleanUsername)) {
      setProfileStatus("error");
      setProfileError("Choose 3–24 letters, numbers or underscores, starting with a letter.");
      return;
    }
    if (!identityToken) {
      setProfileStatus("error");
      setProfileError("Identity tokens need to be enabled once in Privy before we can secure your username.");
      return;
    }

    setProfileStatus("saving");
    setProfileError("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const result = await response.json() as { username?: string; error?: string };
      if (!response.ok || !result.username) throw new Error(result.error ?? "Campus profile could not be saved");
      const savedUsername = result.username.replace(/^@/, "");
      setUsername(savedUsername);
      setCampusUsername(savedUsername);
      setProfileStatus("ready");
      window.sessionStorage.removeItem("campus_pending_username");
      notify(`@${savedUsername} now points to both classroom wallets`);
    } catch (error) {
      setProfileStatus("error");
      setProfileError(error instanceof Error ? error.message : "Campus profile could not be saved");
    }
  }

  function enterLab() {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(cleanUsername)) {
      setProfileError("Choose 3–24 letters, numbers or underscores, starting with a letter.");
      return;
    }
    if (authenticated) {
      setProfileStatus("idle");
      setProfileError("");
      return;
    }
    window.sessionStorage.setItem("campus_pending_username", cleanUsername);
    setLoading(true);
    login({ loginMethods: ["google"] });
    window.setTimeout(() => setLoading(false), 2500);
  }

  async function exportWallet(chain: Chain) {
    try {
      if (chain === "ethereum" && ethereumWallet) await exportEthereumWallet({ address: ethereumWallet.address });
      if (chain === "solana" && solanaWallet) await exportSolanaWallet({ address: solanaWallet.address });
    } catch {
      notify(`${chain === "ethereum" ? "Ethereum" : "Solana"} wallet export was cancelled`);
    }
  }

  async function refreshBalances() {
    if (ethereumWallet) {
      try {
        await ethereumWallet.switchChain(11155111);
        const provider = await ethereumWallet.getEthereumProvider();
        const result = await provider.request({ method: "eth_getBalance", params: [ethereumWallet.address, "latest"] });
        if (typeof result === "string") setBalance(Number(BigInt(result)) / 1e18);
      } catch {
        // A balance refresh should never interrupt the classroom UI.
      }
    }
    if (solanaWallet) {
      try {
        const result = await solanaDevnetRpc.getBalance(address(solanaWallet.address)).send();
        setSolBalance(Number(result.value) / 1e9);
      } catch {
        // A balance refresh should never interrupt the classroom UI.
      }
    }
  }

  async function resolveRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = recipientName.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(clean)) {
      setTransferStatus("error");
      setTransferError("Enter a valid Campus username");
      return;
    }

    setTransferStatus("resolving");
    setTransferError("");
    setRecipient(null);
    setTransferReceipt(null);
    try {
      const response = await fetch(`/api/resolve/${encodeURIComponent(clean)}`);
      const result = await response.json() as Recipient & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Username not found");
      const chainWallet = result.wallets.find((item) => item.chain === activeChain);
      if (!chainWallet) throw new Error(`@${clean} does not have a ${activeChain === "ethereum" ? "Sepolia" : "Solana Devnet"} wallet`);
      const ownAddress = activeChain === "ethereum" ? ethereumWallet?.address : solanaWallet?.address;
      if (ownAddress?.toLowerCase() === chainWallet.address.toLowerCase()) throw new Error("Choose another student—you cannot send this practice transfer to yourself");
      setRecipient(result);
      setTransferStatus("ready");
    } catch (error) {
      setTransferStatus("error");
      setTransferError(error instanceof Error ? error.message : "Username could not be resolved");
    }
  }

  async function sendTestnetTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = recipient?.wallets.find((item) => item.chain === activeChain)?.address;
    if (!recipient || !destination) return;

    setTransferStatus("sending");
    setTransferError("");
    try {
      if (activeChain === "ethereum") {
        if (!ethereumWallet) throw new Error("Ethereum wallet is unavailable");
        const value = decimalToUnits(transferAmount, 18);
        if (value <= 0n || value > 50_000_000_000_000_000n) throw new Error("Send between 0 and 0.05 test ETH");
        await ethereumWallet.switchChain(11155111);
        const { hash } = await sendEthereumTransaction(
          { to: destination, value, chainId: 11155111 },
          { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } },
        );
        setTransferReceipt({ chain: "ethereum", hash, username: recipient.username, amount: transferAmount, explorer: `https://sepolia.etherscan.io/tx/${hash}` });
      } else {
        if (!solanaWallet) throw new Error("Solana wallet is unavailable");
        const lamports = decimalToUnits(transferAmount, 9);
        if (lamports <= 0n || lamports > 1_000_000_000n) throw new Error("Send between 0 and 1 test SOL");
        await waitForCampusSolanaTurn();
        const { value: latestBlockhash } = await solanaDevnetRpc.getLatestBlockhash().send();
        const instruction = getTransferSolInstruction({
          amount: lamports,
          destination: address(destination),
          source: createNoopSigner(address(solanaWallet.address)),
        });
        const transaction = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayer(address(solanaWallet.address), tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions([instruction], tx),
          (tx) => compileTransaction(tx),
          (tx) => new Uint8Array(getTransactionEncoder().encode(tx)),
        );
        const { signature } = await sendCampusSolanaTransaction(transaction);
        const hash = getBase58Decoder().decode(signature);
        setTransferReceipt({ chain: "solana", hash, username: recipient.username, amount: transferAmount, explorer: `https://explorer.solana.com/tx/${hash}?cluster=devnet` });
      }
      setTransferStatus("sent");
      notify(`Testnet transfer sent to ${recipient.username}`);
      window.setTimeout(() => void refreshBalances(), 1800);
    } catch (error) {
      setTransferStatus("error");
      setTransferError(error instanceof Error ? error.message : "Transaction was not sent");
    }
  }

  async function sendCampusToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedToken) return;
    const cleanUsername = tokenRecipient.trim().toLowerCase().replace(/^@/, "");
    const amount = BigInt(tokenAmount || "0");
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(cleanUsername)) return setTokenError("Enter a valid Campus username");
    if (!/^\d+$/.test(tokenAmount) || amount < 1n) return setTokenError("Send at least 1 whole token");
    if (amount > BigInt(selectedToken.owned)) return setTokenError(`You have ${selectedToken.owned} ${selectedToken.symbol}`);
    setTokenBusy(true);
    setTokenError("");
    try {
      const resolvedResponse = await fetch(`/api/resolve/${encodeURIComponent(cleanUsername)}`);
      const resolved = await resolvedResponse.json() as Recipient & { error?: string };
      if (!resolvedResponse.ok) throw new Error(resolved.error ?? "Username not found");
      const destination = resolved.wallets.find((item) => item.chain === selectedToken.chain)?.address;
      if (!destination) throw new Error(`@${cleanUsername} has no Campus ${selectedToken.chain === "ethereum" ? "Ethereum" : "Solana"} wallet`);
      const ownAddress = selectedToken.chain === "ethereum" ? ethereumWallet?.address : solanaWallet?.address;
      if (!ownAddress || ownAddress.toLowerCase() === destination.toLowerCase()) throw new Error("Choose another student");
      let transactionHash = "";
      if (selectedToken.chain === "ethereum") {
        if (!ethereumWallet) throw new Error("Your Campus Ethereum wallet is unavailable");
        await ethereumWallet.switchChain(11155111);
        const data = encodeFunctionData({ abi: campusTokenTransferAbi, functionName: "transfer", args: [destination as Hex, amount * (10n ** BigInt(selectedToken.decimals))] });
        const { hash } = await sendEthereumTransaction({ to: selectedToken.tokenAddress as Hex, data, chainId: 11155111 }, { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } });
        const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
        if (receipt.status !== "success") throw new Error("Sepolia rejected the token transfer");
        transactionHash = hash;
      } else {
        if (!solanaWallet) throw new Error("Your Campus Solana wallet is unavailable");
        await waitForCampusSolanaTurn();
        const owner = createNoopSigner(address(solanaWallet.address));
        const mint = address(selectedToken.tokenAddress);
        const [source] = await findAssociatedTokenPda({ owner: owner.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
        const [destinationAccount] = await findAssociatedTokenPda({ owner: address(destination), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
        const instructions = [
          getCreateAssociatedTokenIdempotentInstruction({ payer: owner, ata: destinationAccount, owner: address(destination), mint }),
          getTransferCheckedInstruction({ source, mint, destination: destinationAccount, authority: owner, amount: amount * (10n ** BigInt(selectedToken.decimals)), decimals: selectedToken.decimals }),
        ];
        const { value: latestBlockhash } = await solanaDevnetRpc.getLatestBlockhash().send();
        const transaction = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayer(owner.address, tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions(instructions, tx),
          (tx) => compileTransaction(tx),
          (tx) => new Uint8Array(getTransactionEncoder().encode(tx)),
        );
        const { signature } = await sendCampusSolanaTransaction(transaction);
        transactionHash = getBase58Decoder().decode(signature);
        await waitForSolanaConfirmation(transactionHash);
      }
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired after the transfer. The on-chain transfer is safe.");
      const record = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "record_transfer", tokenId: selectedToken.id, toUsername: cleanUsername, amount: amount.toString(), transactionHash, fromAddress: ownAddress, toAddress: destination }),
      });
      const result = await record.json() as { error?: string };
      if (!record.ok) throw new Error(result.error ?? "The transfer succeeded, but Campus could not save the receipt");
      setTokenAmount("");
      setTokenRecipient("");
      await loadWalletAssets();
      notify(`${amount.toString()} ${selectedToken.symbol} sent to @${cleanUsername}`);
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : "The token transfer was not completed");
    } finally {
      setTokenBusy(false);
    }
  }

  async function createTokenAirdrop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedToken) return;
    if (!/^\d+$/.test(airdropAmount) || BigInt(airdropAmount) < 1n) return setAirdropError("Enter at least 1 whole token per student");
    setAirdropBusy(true);
    setAirdropError("");
    try {
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh and try again.");
      const response = await fetch("/api/airdrops", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "create", tokenId: selectedToken.id, amountPerClaim: airdropAmount }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The airdrop could not be prepared");
      await loadWalletAssets();
      notify("Classroom airdrop prepared. Fund the vault once to open claims.");
    } catch (error) {
      setAirdropError(error instanceof Error ? error.message : "The airdrop could not be prepared");
    } finally {
      setAirdropBusy(false);
    }
  }

  async function fundTokenAirdrop() {
    if (!selectedToken || !selectedAirdrop?.distributorAddress || selectedAirdrop.status !== "draft") return;
    setAirdropBusy(true);
    setAirdropError("");
    try {
      const amount = BigInt(selectedAirdrop.totalAllocation);
      let transactionHash = "";
      let fromAddress = "";
      if (selectedToken.chain === "ethereum") {
        if (!ethereumWallet) throw new Error("Your Campus Ethereum wallet is unavailable");
        fromAddress = ethereumWallet.address;
        await ethereumWallet.switchChain(11155111);
        const data = encodeFunctionData({
          abi: campusTokenTransferAbi,
          functionName: "transfer",
          args: [selectedAirdrop.distributorAddress as Hex, amount * (10n ** BigInt(selectedToken.decimals))],
        });
        const { hash } = await sendEthereumTransaction({ to: selectedToken.tokenAddress as Hex, data, chainId: 11155111 }, { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } });
        const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
        if (receipt.status !== "success") throw new Error("Sepolia rejected the vault funding transaction");
        transactionHash = hash;
      } else {
        if (!solanaWallet) throw new Error("Your Campus Solana wallet is unavailable");
        fromAddress = solanaWallet.address;
        await waitForCampusSolanaTurn();
        const owner = createNoopSigner(address(solanaWallet.address));
        const mint = address(selectedToken.tokenAddress);
        const distributor = address(selectedAirdrop.distributorAddress);
        const [source] = await findAssociatedTokenPda({ owner: owner.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
        const [destination] = await findAssociatedTokenPda({ owner: distributor, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
        const { value: latestBlockhash } = await solanaDevnetRpc.getLatestBlockhash().send();
        const transaction = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayer(owner.address, tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions([
            getCreateAssociatedTokenIdempotentInstruction({ payer: owner, ata: destination, owner: distributor, mint }),
            getTransferCheckedInstruction({ source, mint, destination, authority: owner, amount: amount * (10n ** BigInt(selectedToken.decimals)), decimals: selectedToken.decimals }),
          ], tx),
          (tx) => compileTransaction(tx),
          (tx) => new Uint8Array(getTransactionEncoder().encode(tx)),
        );
        const { signature } = await sendCampusSolanaTransaction(transaction);
        transactionHash = getBase58Decoder().decode(signature);
        await waitForSolanaConfirmation(transactionHash);
      }
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("The vault was funded onchain, but your Campus session expired. Refresh before trying anything else.");
      const response = await fetch("/api/airdrops", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "record_funding", airdropId: selectedAirdrop.id, transactionHash, fromAddress }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The vault was funded, but Campus could not open claims");
      setAirdropAmount("");
      await loadWalletAssets();
      notify(`${selectedToken.symbol} claims are now open to verified students`);
    } catch (error) {
      setAirdropError(error instanceof Error ? error.message : "The airdrop vault was not funded");
    } finally {
      setAirdropBusy(false);
    }
  }

  async function claimTokenAirdrop() {
    if (!selectedToken || !selectedAirdrop || selectedAirdrop.status !== "open") return;
    setAirdropBusy(true);
    setAirdropError("");
    try {
      if (selectedToken.chain === "solana") await waitForCampusSolanaTurn();
      const requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh and try again.");
      const response = await fetch("/api/airdrops", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": requestToken },
        body: JSON.stringify({ action: "claim", airdropId: selectedAirdrop.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The token claim could not be completed");
      await loadWalletAssets();
      notify(`${selectedAirdrop.amountPerClaim} ${selectedToken.symbol} claimed to your Campus wallet`);
    } catch (error) {
      setAirdropError(error instanceof Error ? error.message : "The token claim could not be completed");
    } finally {
      setAirdropBusy(false);
    }
  }

  function resetTransferForChain(chain: Chain) {
    setActiveChain(chain);
    setRecipient(null);
    setTransferAmount("");
    setTransferError("");
    setTransferReceipt(null);
    setTransferStatus("idle");
  }

  function claimHead() {
    if (headClaimed) return notify("Your Faceless head is already in your wallet");
    setHeadClaimed(true);
    notify("Faceless Head #084 claimed on Sepolia");
  }

  function claimDrop(id: number) {
    if (claimedDrops.includes(id)) return notify("You already claimed this drop");
    setClaimedDrops((current) => [...current, id]);
    setDrops((current) => current.map((drop) => drop.id === id ? { ...drop, claimed: drop.claimed + 1 } : drop));
    notify("Partner badge added to your onchain passport");
  }

  function handleArt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return notify("Upload a PNG, JPG or WebP image");
    if (file.size > 4 * 1024 * 1024) return notify("Keep artwork under 4 MB");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return notify("Artwork could not be read");
      const artwork = { dataUrl: reader.result, name: file.name, type: file.type, size: file.size };
      setLaunchArtwork(artwork);
      setArtPreview(artwork.dataUrl);
    };
    reader.onerror = () => notify("Artwork could not be read");
    reader.readAsDataURL(file);
  }

  function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!launchArtwork) return notify("Upload the collection artwork first");
    const data = new FormData(event.currentTarget);
    const name = String(data.get("collectionName") || "").trim();
    const description = String(data.get("creatorStory") || "").trim();
    const symbol = String(data.get("symbol") || "").trim().toUpperCase();
    const supply = Number(data.get("editionSize"));
    if (!name || !description || !symbol || !Number.isInteger(supply) || supply < 1) return notify("Complete the collection details first");
    openLaunchDraft({
      assetType: "nft_collection",
      chain: activeChain,
      name,
      symbol,
      description,
      supply,
      mintPrice: "0",
      royaltyPercent: 5,
      decimals: null,
      purpose: "Original student artwork",
      artworkReady: true,
      authorityMode: null,
    });
    notify("Testnet launch ready — no educator approval required");
  }

  function openLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setSelectedCourse(lesson.course);
    setActive("learn");
    lastProgressSent.current = 0;
    const record = learningState?.records.find((item) => item.course === lesson.course && item.lessonId === lesson.id);
    if (record?.status !== "completed") void saveLessonProgress(lesson, "in_progress", record?.positionSeconds ?? 0, record?.durationSeconds ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseCourse(course: Course) {
    setSelectedCourse(course);
    const firstIncomplete = lessonTracks[course].find((lesson) => !learningState?.records.some((record) => record.course === course && record.lessonId === lesson.id && record.status === "completed"));
    setSelectedLesson(firstIncomplete ?? lessonTracks[course][0]);
  }

  async function campusIdentityToken(forceRefresh = false) {
    const current = identityTokenRef.current;
    if (!current) return null;
    if (!forceRefresh && !identityTokenExpiresSoon(current)) return current;

    await refreshUser();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const refreshed = identityTokenRef.current;
      if (refreshed && refreshed !== current && !identityTokenExpiresSoon(refreshed, 0)) return refreshed;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return identityTokenRef.current && !identityTokenExpiresSoon(identityTokenRef.current, 0) ? identityTokenRef.current : null;
  }

  async function sendCampusSolanaTransaction(transaction: Uint8Array) {
    if (!solanaWallet) throw new Error("Your Campus Solana wallet is unavailable");
    if (!await getAccessToken()) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
    try {
      return await sendSolanaTransaction({ transaction, wallet: solanaWallet, chain: "solana:devnet" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/failed to connect to wallet/i.test(message)) throw error;
      await refreshUser();
      if (!await getAccessToken()) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      try {
        return await sendSolanaTransaction({ transaction, wallet: solanaWallet, chain: "solana:devnet" });
      } catch (retryError) {
        if (retryError instanceof Error && /failed to connect to wallet/i.test(retryError.message)) {
          throw new Error("The Campus wallet could not reconnect. Refresh this page once, then press Mint first edition again.");
        }
        throw retryError;
      }
    }
  }

  async function waitForCampusSolanaTurn() {
    let requestToken = await campusIdentityToken();
    if (!requestToken) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
    const joinQueue = (token: string) => fetch("/api/transaction-queue", {
      method: "POST",
      headers: { "content-type": "application/json", "privy-id-token": token },
      body: JSON.stringify({ network: "solana_devnet" }),
    });
    let response = await joinQueue(requestToken);
    if (response.status === 401) {
      requestToken = await campusIdentityToken(true);
      if (!requestToken) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
      response = await joinQueue(requestToken);
    }
    const result = await response.json() as { readyAt?: number; position?: number; error?: string };
    if (!response.ok || !result.readyAt) throw new Error(result.error ?? "The Campus transaction queue is unavailable");
    const position = Math.max(1, result.position ?? 1);
    let seconds = Math.max(0, Math.ceil((result.readyAt - Date.now()) / 1_000));
    setTransactionQueue({ position, seconds });
    while (seconds > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      seconds = Math.max(0, Math.ceil((result.readyAt - Date.now()) / 1_000));
      setTransactionQueue({ position, seconds });
    }
    setTransactionQueue(null);
  }

  async function askMask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = maskQuestion.trim() || (maskArtwork ? "I’ve attached my artwork for the NFT collection. Inspect it and continue the launch setup." : "");
    if (!question || maskBusy) return;
    if (!identityToken) return notify("Sign in to ask the live Mask");
    if (maskArtwork && !maskArtworkRights) return notify("Confirm that you created the artwork or have permission to use it");
    const startingNewLaunch = /(?:help me launch|i want to launch|start.*launch)/i.test(question) && maskLaunchProgress?.ready;
    const activeLaunchProgress = startingNewLaunch ? null : maskLaunchProgress;
    if (startingNewLaunch) setMaskLaunchProgress(null);
    const previous = maskMessages.slice(-30).map(({ role, text }) => ({ role, text }));
    const submittedArtwork = maskArtwork;
    setMaskMessages((current) => [...current, { role: "user", text: question, image: submittedArtwork?.dataUrl, imageName: submittedArtwork?.name }]);
    setMaskQuestion("");
    setMaskBusy(true);
    try {
      const requestBody = JSON.stringify({
          question,
          history: previous,
          launchProgress: activeLaunchProgress,
          artwork: submittedArtwork ? { ...submittedArtwork, rightsConfirmed: true } : null,
          lesson: { course: selectedLesson.course, title: selectedLesson.title, summary: selectedLesson.copy },
      });
      let requestToken = await campusIdentityToken();
      if (!requestToken) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
      const sendQuestion = (token: string) => fetch("/api/mask", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": token },
        body: requestBody,
      });
      let response = await sendQuestion(requestToken);
      if (response.status === 401) {
        requestToken = await campusIdentityToken(true);
        if (!requestToken) throw new Error("Your Campus session expired. Refresh the page or sign in again—your wallets and work are safe.");
        response = await sendQuestion(requestToken);
      }
      const result = await response.json() as { answer?: string; citations?: MaskCitation[]; launchDraft?: LaunchDraft | null; launchProgress?: LaunchProgress | null; openLaunchpad?: boolean; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "Mask could not answer right now");
      if (result.launchProgress) setMaskLaunchProgress(result.launchProgress);
      if (submittedArtwork) {
        setLaunchArtwork(submittedArtwork);
        setArtPreview(submittedArtwork.dataUrl);
        setMaskArtwork(null);
        setMaskArtworkRights(false);
      }
      setMaskMessages((current) => [...current, { role: "assistant", text: result.answer!, citations: result.citations, launchDraft: result.launchDraft }]);
      if (result.openLaunchpad && result.launchDraft) openLaunchDraft(result.launchDraft);
    } catch (error) {
      setMaskMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "I couldn’t answer that right now. Please try again." }]);
    } finally {
      setMaskBusy(false);
    }
  }

  function attachMaskArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return notify("Upload a PNG, JPG or WebP image");
    if (file.size > 4 * 1024 * 1024) return notify("Keep artwork under 4 MB");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return notify("Artwork could not be read");
      setMaskArtwork({ dataUrl: reader.result, name: file.name, type: file.type, size: file.size });
      setMaskArtworkRights(false);
    };
    reader.onerror = () => notify("Artwork could not be read");
    reader.readAsDataURL(file);
  }

  function openLaunchDraft(draft: LaunchDraft) {
    setLaunchDraft(draft);
    if (launchArtwork) setArtPreview(launchArtwork.dataUrl);
    setActiveChain(draft.chain);
    setLaunchMode("testnet");
    setLaunchReviewReady(false);
    setLaunchTransactionStatus("idle");
    setLaunchTransactionError("");
    setLaunchDeployment(null);
    setActive("launchpad");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLaunchDraft<K extends keyof LaunchDraft>(key: K, value: LaunchDraft[K]) {
    setLaunchDraft((current) => current ? { ...current, [key]: value } : current);
    setLaunchReviewReady(false);
    setLaunchTransactionStatus("idle");
    setLaunchTransactionError("");
    setLaunchDeployment(null);
  }

  function prepareLaunchApproval(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!launchDraft) return;
    setLaunchReviewReady(true);
    notify("Launch review ready — your wallet has not signed anything yet");
  }

  async function saveLaunchReceipt(action: "record_deploy" | "record_mint", launchId: string, transactionHash: string, contractAddress?: string, assetAddress?: string) {
    if (!identityToken) throw new Error("Sign in again before saving the launch receipt");
    const response = await fetch("/api/launch", {
      method: "POST",
      headers: { "content-type": "application/json", "privy-id-token": identityToken },
      body: JSON.stringify({ action, launchId, transactionHash, contractAddress, assetAddress }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The launch receipt could not be saved");
  }

  async function prepareTokenRecord() {
    if (!launchDraft || launchDraft.assetType !== "token") throw new Error("Open a token draft first");
    const creatorAddress = launchDraft.chain === "ethereum" ? ethereumWallet?.address : solanaWallet?.address;
    if (!creatorAddress) throw new Error(`Your Campus ${launchDraft.chain === "ethereum" ? "Ethereum" : "Solana"} wallet is unavailable`);
    const requestToken = await campusIdentityToken();
    if (!requestToken) throw new Error("Your Campus session expired. Refresh the page and try again.");
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json", "privy-id-token": requestToken },
      body: JSON.stringify({
        action: "prepare", chain: launchDraft.chain, creatorAddress, name: launchDraft.name,
        symbol: launchDraft.symbol, description: launchDraft.description, purpose: launchDraft.purpose,
        supply: launchDraft.supply, decimals: launchDraft.decimals ?? (launchDraft.chain === "ethereum" ? 18 : 9),
        authorityMode: launchDraft.authorityMode ?? "keep",
      }),
    });
    const result = await response.json() as { tokenId?: string; deploymentData?: Hex; error?: string };
    if (!response.ok || !result.tokenId) throw new Error(result.error ?? "The Campus token could not be prepared");
    return result;
  }

  async function recordTokenDeployment(tokenId: string, transactionHash: string, tokenAddress: string, creatorTokenAccount?: string) {
    const requestToken = await campusIdentityToken();
    if (!requestToken) throw new Error("Your Campus session expired after deployment. Your token is safe; refresh once to save it.");
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json", "privy-id-token": requestToken },
      body: JSON.stringify({ action: "record_deploy", tokenId, transactionHash, tokenAddress, creatorTokenAccount }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The token deployed, but Campus could not save its receipt");
  }

  async function deploySepoliaToken() {
    if (!launchDraft || launchDraft.assetType !== "token" || !ethereumWallet) return;
    setLaunchTransactionError("");
    setLaunchTransactionStatus("uploading");
    try {
      const prepared = await prepareTokenRecord();
      if (!prepared.deploymentData) throw new Error("The Sepolia token deployment is incomplete");
      await ethereumWallet.switchChain(11155111);
      setLaunchTransactionStatus("awaiting_signature");
      const { hash } = await sendEthereumTransaction({ data: prepared.deploymentData, chainId: 11155111 }, { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } });
      setLaunchTransactionStatus("confirming");
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Sepolia rejected the deployment. No token was created.");
      await recordTokenDeployment(prepared.tokenId!, hash, receipt.contractAddress);
      setLaunchDeployment({ chain: "ethereum", launchId: prepared.tokenId!, metadataUrl: "", deployHash: hash, contractAddress: receipt.contractAddress });
      setLaunchTransactionStatus("deployed");
      await loadWalletAssets();
      notify(`${launchDraft.symbol} is live on Sepolia`);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The Sepolia token was not deployed");
    }
  }

  async function deploySolanaToken() {
    if (!launchDraft || launchDraft.assetType !== "token" || !solanaWallet) return;
    setLaunchTransactionError("");
    setLaunchTransactionStatus("uploading");
    try {
      const prepared = await prepareTokenRecord();
      await waitForCampusSolanaTurn();
      const payer = createNoopSigner(address(solanaWallet.address));
      const mint = await generateKeyPairSigner();
      const [creatorTokenAccount] = await findAssociatedTokenPda({ owner: payer.address, mint: mint.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      const rent = await solanaDevnetRpc.getMinimumBalanceForRentExemption(82n).send();
      const decimals = launchDraft.decimals ?? 9;
      const supplyUnits = BigInt(launchDraft.supply) * (10n ** BigInt(decimals));
      const instructions: Instruction[] = [
        getCreateAccountInstruction({ payer, newAccount: mint, lamports: rent, space: 82n, programAddress: TOKEN_PROGRAM_ADDRESS }),
        getInitializeMint2Instruction({ mint: mint.address, decimals, mintAuthority: payer.address, freezeAuthority: launchDraft.authorityMode === "keep" ? payer.address : null }),
        getCreateAssociatedTokenInstruction({ payer, ata: creatorTokenAccount, owner: payer.address, mint: mint.address }),
        getMintToInstruction({ mint: mint.address, token: creatorTokenAccount, mintAuthority: payer, amount: supplyUnits }),
      ];
      if (launchDraft.authorityMode === "revoke") instructions.push(getSetAuthorityInstruction({ owned: mint.address, owner: payer, authorityType: AuthorityType.MintTokens, newAuthority: null }));
      const { value: latestBlockhash } = await solanaDevnetRpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(payer.address, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx),
      );
      const partiallySigned = await partiallySignTransactionMessageWithSigners(message);
      setLaunchTransactionStatus("awaiting_signature");
      const { signature } = await sendCampusSolanaTransaction(new Uint8Array(getTransactionEncoder().encode(partiallySigned)));
      const hash = getBase58Decoder().decode(signature);
      setLaunchTransactionStatus("confirming");
      await waitForSolanaConfirmation(hash);
      await recordTokenDeployment(prepared.tokenId!, hash, mint.address, creatorTokenAccount);
      setLaunchDeployment({ chain: "solana", launchId: prepared.tokenId!, metadataUrl: "", deployHash: hash, contractAddress: mint.address });
      setLaunchTransactionStatus("deployed");
      await loadWalletAssets();
      notify(`${launchDraft.symbol} is live on Solana Devnet`);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The Solana token was not deployed");
    }
  }

  async function deploySepoliaEdition() {
    if (!launchDraft || launchDraft.assetType !== "nft_collection") return;
    if (launchDraft.chain !== "ethereum") return notify("The Solana deployment adapter is the next connector. Choose Sepolia to deploy now.");
    if (!identityToken) return notify("Sign in again before preparing the deployment");
    if (!ethereumWallet) return notify("Your Campus Ethereum wallet is unavailable");
    if (!launchArtwork) return notify("Return to Mask and attach the collection artwork first");

    setLaunchTransactionError("");
    setLaunchTransactionStatus("uploading");
    try {
      const response = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({
          action: "prepare",
          creatorAddress: ethereumWallet.address,
          name: launchDraft.name,
          symbol: launchDraft.symbol,
          description: launchDraft.description,
          purpose: launchDraft.purpose,
          maxSupply: launchDraft.supply,
          mintPrice: launchDraft.mintPrice ?? "0",
          royaltyPercent: launchDraft.royaltyPercent ?? 0,
          artworkDataUrl: launchArtwork.dataUrl,
        }),
      });
      const prepared = await response.json() as { launchId?: string; deploymentData?: Hex; metadataUrl?: string; error?: string };
      if (!response.ok || !prepared.launchId || !prepared.deploymentData || !prepared.metadataUrl) {
        throw new Error(prepared.error ?? "The Sepolia deployment could not be prepared");
      }

      await ethereumWallet.switchChain(11155111);
      setLaunchTransactionStatus("awaiting_signature");
      const { hash } = await sendEthereumTransaction(
        { data: prepared.deploymentData, chainId: 11155111 },
        { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } },
      );
      setLaunchTransactionStatus("confirming");
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Sepolia rejected the deployment. No collection was created.");
      const contractAddress = receipt.contractAddress as Hex;
      await saveLaunchReceipt("record_deploy", prepared.launchId, hash as Hex, contractAddress);
      setLaunchDeployment({ chain: "ethereum", launchId: prepared.launchId, metadataUrl: prepared.metadataUrl, deployHash: hash, contractAddress });
      setLaunchTransactionStatus("deployed");
      notify("Collection contract deployed on Sepolia");
      window.setTimeout(() => void refreshBalances(), 1200);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The collection was not deployed");
    }
  }

  async function waitForSolanaConfirmation(transactionSignature: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch("/api/solana-rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[transactionSignature], { searchTransactionHistory: true }] }),
      });
      const result = await response.json() as { result?: { value?: Array<{ err: unknown; confirmationStatus?: string } | null> }; error?: { message?: string } };
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Solana Devnet could not confirm the transaction");
      const status = result.result?.value?.[0];
      if (status?.err) throw new Error("Solana Devnet rejected the transaction");
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    throw new Error("Solana Devnet is taking longer than expected. Check the explorer before trying again.");
  }

  function createStudentUmi() {
    if (!solanaWallet) throw new Error("Your Campus Solana wallet is unavailable");
    const umi = createUmi(`${window.location.origin}/api/solana-rpc`).use(mplCore()).use(mplCandyMachine());
    const studentSigner = createUmiNoopSigner(publicKey(solanaWallet.address));
    umi.use(signerIdentity(studentSigner));
    return { umi, studentSigner };
  }

  async function deploySolanaCollection() {
    if (!launchDraft || launchDraft.assetType !== "nft_collection") return;
    if (!identityToken) return notify("Sign in again before preparing the collection");
    if (!solanaWallet) return notify("Your Campus Solana wallet is unavailable");
    if (!launchArtwork) return notify("Return to Mask and attach the collection artwork first");

    setLaunchTransactionError("");
    setLaunchTransactionStatus("uploading");
    try {
      const response = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({
          action: "prepare",
          chain: "solana",
          creatorAddress: solanaWallet.address,
          name: launchDraft.name,
          symbol: launchDraft.symbol,
          description: launchDraft.description,
          purpose: launchDraft.purpose,
          maxSupply: launchDraft.supply,
          mintPrice: launchDraft.mintPrice ?? "0",
          royaltyPercent: launchDraft.royaltyPercent ?? 0,
          artworkDataUrl: launchArtwork.dataUrl,
        }),
      });
      const prepared = await response.json() as { launchId?: string; metadataUrl?: string; error?: string };
      if (!response.ok || !prepared.launchId || !prepared.metadataUrl) throw new Error(prepared.error ?? "The Solana collection could not be prepared");

      await waitForCampusSolanaTurn();
      const { umi, studentSigner } = createStudentUmi();
      const collectionSigner = generateSigner(umi);
      const plugins: Parameters<typeof createCoreCollection>[1]["plugins"] = [{
        type: "MasterEdition",
        maxSupply: launchDraft.supply,
        name: null,
        uri: null,
      }];
      if ((launchDraft.royaltyPercent ?? 0) > 0) {
        plugins.push({
          type: "Royalties",
          basisPoints: Math.round((launchDraft.royaltyPercent ?? 0) * 100),
          creators: [{ address: studentSigner.publicKey, percentage: 100 }],
          ruleSet: ruleSet("None"),
        });
      }
      const builder = createCoreCollection(umi, {
        collection: collectionSigner,
        updateAuthority: studentSigner.publicKey,
        name: launchDraft.name,
        uri: prepared.metadataUrl,
        plugins,
      });
      let transaction = await builder.buildWithLatestBlockhash(umi);
      transaction = await collectionSigner.signTransaction(transaction);
      const serialized = umi.transactions.serialize(transaction);

      setLaunchTransactionStatus("awaiting_signature");
      const { signature } = await sendCampusSolanaTransaction(serialized);
      const hash = getBase58Decoder().decode(signature);
      setLaunchTransactionStatus("confirming");
      await waitForSolanaConfirmation(hash);
      const collectionAddress = collectionSigner.publicKey.toString();
      await saveLaunchReceipt("record_deploy", prepared.launchId, hash, collectionAddress);
      setLaunchDeployment({ chain: "solana", launchId: prepared.launchId, metadataUrl: prepared.metadataUrl, deployHash: hash, contractAddress: collectionAddress });
      setLaunchTransactionStatus("deployed");
      notify("Metaplex Core collection created on Solana Devnet");
      window.setTimeout(() => void refreshBalances(), 1200);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The Solana collection was not created");
    }
  }

  async function mintFirstSepoliaEdition() {
    if (!launchDraft || !launchDeployment || !ethereumWallet) return;
    setLaunchTransactionError("");
    setLaunchTransactionStatus("minting");
    try {
      await ethereumWallet.switchChain(11155111);
      const data = encodeFunctionData({ abi: campusEditionMintAbi, functionName: "mint", args: [1n] });
      const price = launchDraft.mintPrice?.trim().toLowerCase();
      const value = !price || price === "free" ? 0n : parseEther(price);
      const { hash } = await sendEthereumTransaction(
        { to: launchDeployment.contractAddress, data, value, chainId: 11155111 },
        { address: ethereumWallet.address, uiOptions: { showWalletUIs: true } },
      );
      const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: hash as Hex });
      if (receipt.status !== "success") throw new Error("Sepolia rejected the mint. No NFT was created.");
      await saveLaunchReceipt("record_mint", launchDeployment.launchId, hash as Hex);
      setLaunchDeployment((current) => current ? { ...current, mintHash: hash as Hex } : current);
      setLaunchTransactionStatus("minted");
      await loadWalletAssets();
      notify("Your first edition was minted on Sepolia");
      window.setTimeout(() => void refreshBalances(), 1200);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The first NFT was not minted");
    }
  }

  async function mintFirstSolanaEdition() {
    if (!launchDraft || !launchDeployment || launchDeployment.chain !== "solana" || !solanaWallet) return;
    setLaunchTransactionError("");
    setLaunchTransactionStatus("minting");
    try {
      await waitForCampusSolanaTurn();
      const { umi, studentSigner } = createStudentUmi();
      const collection = await fetchCollection(umi, publicKey(launchDeployment.contractAddress));
      const assetSigner = generateSigner(umi);
      const builder = createCoreAsset(umi, {
        asset: assetSigner,
        collection,
        authority: studentSigner,
        payer: studentSigner,
        owner: studentSigner.publicKey,
        updateAuthority: studentSigner.publicKey,
        name: `${launchDraft.name} #1`,
        uri: launchDeployment.metadataUrl,
        plugins: [{ type: "Edition", number: 1 }],
      });
      let transaction = await builder.buildWithLatestBlockhash(umi);
      transaction = await assetSigner.signTransaction(transaction);
      const serialized = umi.transactions.serialize(transaction);
      const { signature } = await sendCampusSolanaTransaction(serialized);
      const hash = getBase58Decoder().decode(signature);
      await waitForSolanaConfirmation(hash);
      const assetAddress = assetSigner.publicKey.toString();
      await saveLaunchReceipt("record_mint", launchDeployment.launchId, hash, undefined, assetAddress);
      setLaunchDeployment((current) => current ? { ...current, mintHash: hash, assetAddress } : current);
      setLaunchTransactionStatus("minted");
      await loadWalletAssets();
      notify("Your first Solana NFT was minted to your Campus wallet");
      window.setTimeout(() => void refreshBalances(), 1200);
    } catch (error) {
      setLaunchTransactionStatus("error");
      setLaunchTransactionError(error instanceof Error ? error.message : "The first Solana NFT was not minted");
    }
  }

  function deployLaunchCollection() {
    if (launchDraft?.assetType === "token") return void (launchDraft.chain === "solana" ? deploySolanaToken() : deploySepoliaToken());
    if (launchDraft?.chain === "solana") return void deploySolanaCollection();
    return void deploySepoliaEdition();
  }

  function mintFirstLaunchEdition() {
    if (launchDeployment?.chain === "solana") return void mintFirstSolanaEdition();
    return void mintFirstSepoliaEdition();
  }

  function claimCampaign(id: number) {
    if (claimedCampaigns.includes(id)) return notify("This mission is already in your workspace");
    setClaimedCampaigns((current) => [...current, id]);
    notify("Campaign claimed — Mask prepared your brief checklist");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActive("home")} aria-label="Faceless Onchain Lab home">
          <span className="brand-glyph"><MaskOrb compact /></span>
          <span><strong>FACELESS</strong><small>CAMPUS OS</small></span>
        </button>

        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.filter((item) => item.id !== "admin" || faucetState?.role === "owner").map((item) => (
            <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => setActive(item.id)}>
              <span className="nav-mark">{item.mark}</span>{item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-lab-card">
          <div className="tiny-label">CURRENT LAB</div>
          <strong>3 courses · 25 lessons</strong>
          <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
          <span>{completed} learning milestones complete</span>
        </div>

        <div className="sidebar-profile">
          <span className="profile-dot">{initials}</span>
          <span><strong>{displayName}</strong><small>{authenticated ? displayEmail : "Student · Cohort 04"}</small></span>
          <button aria-label={authenticated ? "Sign out" : "Profile options"} onClick={() => authenticated ? logout() : notify("Sign in to open your profile")}>{authenticated ? "↗" : "•••"}</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="mobile-brand">FACELESS LAB</span>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <div className="chain-switch" aria-label="Active test network"><button className={activeChain === "ethereum" ? "active" : ""} onClick={() => setActiveChain("ethereum")}><i /> ETH · SEPOLIA</button><button className={activeChain === "solana" ? "active sol" : "sol"} onClick={() => setActiveChain("solana")}><i /> SOL · DEVNET</button></div>
            <button className={notificationOpen ? "inbox-button active" : "inbox-button"} aria-label={`Campus Inbox${notificationState?.unreadCount ? `, ${notificationState.unreadCount} unread` : ""}`} onClick={() => { setNotificationOpen((open) => !open); void loadNotifications(); }}><span>◌</span>{Boolean(notificationState?.unreadCount) && <b>{Math.min(99, notificationState?.unreadCount ?? 0)}</b>}</button>
            <button className="wallet-pill" onClick={() => setActive("wallet")}><span>◇</span> {wallet}</button>
          </div>
        </header>

        {notificationOpen && <><button className="inbox-scrim" aria-label="Close Campus Inbox" onClick={() => setNotificationOpen(false)} /><aside className="campus-inbox" aria-label="Campus Inbox"><header><div><span className="eyebrow">CAMPUS INBOX</span><h2>What needs your attention.</h2><p>Assignments, invitations, feedback and opportunities—together in one calm place.</p></div><button aria-label="Close Campus Inbox" onClick={() => setNotificationOpen(false)}>×</button></header><div className="inbox-toolbar"><span><b>{notificationState?.unreadCount ?? 0}</b> unread</span><button disabled={notificationBusy || !notificationState?.unreadCount} onClick={() => void notificationAction("mark_all")}>Mark all read</button></div><div className="inbox-list">{notificationState?.notifications.length ? notificationState.notifications.map((notification) => <button key={notification.key} className={notification.read ? "inbox-item read" : "inbox-item"} onClick={() => openNotification(notification)}><i>{notification.kind === "assignment" ? "L" : notification.kind === "invitation" ? "+" : notification.kind === "review" ? "✓" : notification.kind === "campaign" ? "₹" : notification.kind === "drop" ? "◆" : "!"}</i><span><small>{notification.kind.replaceAll("_", " ")} · {new Date(notification.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small><b>{notification.title}</b><p>{notification.body}</p><em>Open {notification.destination === "create" ? "Project Studio" : notification.destination === "tools" ? "Creator Tools" : notification.destination === "admin" ? "Educator View" : notification.destination} →</em></span>{!notification.read && <u aria-label="Unread" />}</button>) : <div className="inbox-empty"><span>✓</span><h3>You’re all caught up.</h3><p>New Campus actions will appear here automatically.</p></div>}</div><footer>Private to your verified Campus account · never stores wallet keys</footer></aside></>}

        <div className="content-area">
          {classroomSession && active !== "admin" && <section className="live-class-quest">
            <span className="live-pulse">LIVE</span>
            <div><small>CLASSROOM QUEST FROM YOUR EDUCATOR</small><h3>{classroomSession.title}</h3><p>{classroomSession.instructions}</p>{classroomActivity?.proofLabel && <em>✓ {classroomActivity.proofLabel}</em>}</div>
            <div className="live-quest-actions"><button onClick={() => {
              if (classroomSession.quest === "fund_wallets" || classroomSession.quest === "send_token") setActive("wallet");
              else if (classroomSession.quest === "mint_nft") { setMarketArea("nfts"); setActive("market"); }
              else if (classroomSession.quest === "buy_rwa") { setMarketArea("rwas"); setActive("market"); }
              else setActive("mask");
              void updateClassroomActivity("working");
            }}>{classroomActivity?.status === "working" ? "Continue quest →" : "Start quest →"}</button>{classroomActivity?.status !== "completed" && <><button className="quest-proof" onClick={() => updateClassroomActivity("complete")} disabled={classroomActivityBusy}>Verify my proof</button><button className="quest-help" onClick={() => updateClassroomActivity("needs_help")} disabled={classroomActivityBusy}>I need help</button></>}</div>
          </section>}
          {active === "home" && (
            <div className="dashboard-grid">
              <section className="hero-panel">
                <div className="hero-copy">
                  <span className="eyebrow">LEARN · BUILD · PLAY · CREATE · EARN</span>
                  <h2>Learn the idea.<br /><em>Build your version.</em></h2>
                  <p>Mask connects 25 lessons to Ethereum and Solana testnet actions, games, projects and creator opportunities.</p>
                  <button className="primary" onClick={resumeLearningQuest}>{learningState?.resume ? "Continue your lesson" : "Start learning"} <span>→</span></button>
                </div>
                <div className="hero-visual">
                  <div className="signal-ring ring-one" />
                  <div className="signal-ring ring-two" />
                  <MaskOrb />
                  <div className="speech-card">Next up: your first transaction.<small>Mask is ready when you are.</small></div>
                </div>
              </section>

              <section className="progress-card card">
                <div className="section-head"><span><b>YOUR PROGRESS</b><small>Blockchain · Bitcoin · Ethereum</small></span><strong>{progress}%</strong></div>
                <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
                <div className="progress-stats">
                  <span><b>{completed}</b><small>Lessons done</small></span>
                  <span><b>03</b><small>Assets owned</small></span>
                  <span><b>02</b><small>Test networks</small></span>
                </div>
              </section>

              {firstDayState && <section className={firstDayState.complete ? "first-day-runway complete" : "first-day-runway"}><header><div><span className="eyebrow">YOUR FIRST DAY ONCHAIN</span><h2>{firstDayState.complete ? "Runway complete." : "One clear path. No hunting around."}</h2><p>{firstDayState.complete ? "Your identity, wallets, classroom access and first proof are ready." : "Campus OS checks real account and testnet activity, then opens the exact next step."}</p></div><aside><strong>{firstDayState.completedCount}/{firstDayState.totalSteps}</strong><span>steps ready</span><i><b style={{ width: `${(firstDayState.completedCount / firstDayState.totalSteps) * 100}%` }} /></i></aside></header><div className="first-day-steps">{firstDayState.steps.map((step) => <button key={step.id} className={step.complete ? "done" : firstDayState.next?.id === step.id ? "next" : ""} onClick={() => openFirstDayStep(step)} disabled={step.complete && step.id !== "badge"}><span>{step.complete ? "✓" : step.number}</span><div><small>{step.complete ? step.detail || "VERIFIED" : firstDayState.next?.id === step.id ? "DO THIS NEXT" : "UPCOMING"}</small><b>{step.title}</b><p>{step.description}</p></div><em>{step.complete ? "DONE" : firstDayState.next?.id === step.id ? "OPEN →" : ""}</em></button>)}</div>{firstDayState.next ? <footer><span><b>Next: {firstDayState.next.title}</b><small>{firstDayState.next.description}</small></span><button onClick={() => openFirstDayStep(firstDayState.next!)}>Continue first-day setup →</button></footer> : <footer className="finished"><span><b>First Passport proof unlocked</b><small>Keep learning, building and creating to grow your verified record.</small></span><button onClick={() => setActive("passport")}>Open my Passport →</button></footer>}</section>}

              {attendanceState?.prompt && <section className="attendance-checkin card"><div className="attendance-live-mark"><i /> LIVE CHECK-IN</div><div><small>{attendanceState.prompt.host}</small><h3>{attendanceState.prompt.title}</h3><p>Your educator has opened attendance for this room. Enter the code shown in class.</p></div><form onSubmit={(event) => { event.preventDefault(); void attendanceAction("check_in", { code: attendanceCode }); }}><input aria-label="Classroom attendance code" value={attendanceCode} onChange={(event) => { setAttendanceCode(event.target.value.toUpperCase()); setAttendanceError(""); }} placeholder="6-DIGIT CODE" maxLength={6} /><button disabled={attendanceBusy || attendanceCode.length !== 6}>{attendanceBusy ? "Verifying…" : "Check in →"}</button></form>{attendanceError && <span>{attendanceError}</span>}<small>Closes {new Date(attendanceState.prompt.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · tied to your verified Campus profile</small></section>}

              <section className="wallet-card card">
                <div className="section-head"><span><b>CLASSROOM WALLET</b><small>{wallet}</small></span><button onClick={() => copyWalletAddress(activeChain)}>Copy</button></div>
                <div className="balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? balance.toFixed(3) : solBalance.toFixed(2)} <span>{activeChain === "ethereum" ? "ETH" : "SOL"}</span></strong><em>{usdPrices ? `≈ ${formatUsd((activeChain === "ethereum" ? balance * usdPrices.ethereum : solBalance * usdPrices.solana))} USD reference` : "Loading USD reference…"}</em><em>Testnet only · not redeemable for USD</em></div>
                <button className={(activeChain === "ethereum" ? balance : solBalance) ? "secondary claimed" : "secondary"} onClick={() => claimCampusFaucet(activeChain)} disabled={Boolean(faucetBusy)}>{faucetBusy === activeChain ? "Sending test funds…" : `Claim test ${activeChain === "ethereum" ? "ETH" : "SOL"}`}</button>
              </section>

              <section className="quest-card card">
                <div className="quest-index">{String((learningState?.resume?.lessonId ?? 1)).padStart(2, "0")}</div>
                <div><span className="eyebrow">ACTIVE LESSON</span><h3>{learningState?.resume ? lessonTracks[learningState.resume.course].find((lesson) => lesson.id === learningState.resume?.lessonId)?.title : "Start with blockchain basics"}</h3><p>Watch the explainer, ask Mask a question and unlock its guided activity.</p></div>
                <button onClick={resumeLearningQuest}>{learningState?.resume ? "Resume" : "Start"} →</button>
              </section>

              <section className="home-mission card">
                <div className="section-head"><span><b>LIVE CAMPAIGN</b><small>Matched to your creator mode</small></span><em>₹500</em></div>
                <div><span className="mission-logo">ST</span><span><b>Campus café experience</b><small>Sticksy · Creator · Instagram</small></span><button onClick={() => setActive("campaigns")}>View mission →</button></div>
              </section>

              <section className="activity-card card">
                <div className="section-head"><span><b>RECENT ONCHAIN ACTIVITY</b><small>Readable by anyone</small></span><button onClick={() => setActive("wallet")}>View all</button></div>
                <div className="activity-row"><span className="activity-icon purple">✦</span><span><b>Ethereum Lab Pass</b><small>Minted · 7 min ago</small></span><code>0x8f...21c</code></div>
                <div className="activity-row"><span className="activity-icon green">↓</span><span><b>Received test ETH</b><small>Faceless Faucet · 12 min ago</small></span><code>0x31...aa9</code></div>
              </section>

              <section className="launch-strip card">
                <div className="section-head"><span><b>STUDENT LAUNCHPAD</b><small>Fresh work from the classroom</small></span><button onClick={() => setActive("launchpad")}>Explore all →</button></div>
                <div className="mini-market">
                  {marketItems.slice(0, 3).map((item) => <button key={item.id} onClick={() => setActive("launchpad")}><img src={item.image} alt="" /><span><b>{item.title}</b><small>{item.creator}</small></span><em>{item.price} Ξ</em></button>)}
                </div>
              </section>
            </div>
          )}

          {active === "learn" && (
            <div className="page-stack">
              <section className="page-intro learn-intro">
                <div><span className="eyebrow">25 APPROVED FACELESS LESSONS</span><h2>Learn the chain.<br />Then use it.</h2><p>Blockchain basics, Bitcoin and Ethereum—connected to Mask and a practical activity.</p><span className="learning-sync"><i style={{ width: `${progress}%` }} /><b>{completed} of 25 complete · saved to your Campus profile</b></span></div>
                <button className="lesson-orb" onClick={() => setActive("mask")}><MaskOrb compact /><span>Ask Mask<small>Grounded in this course</small></span></button>
              </section>
              {Boolean(cohortState?.assignments.length) && <section className="cohort-learning-plan card"><div><span className="eyebrow">YOUR COHORT PLAN · {cohortState?.membership?.title}</span><h3>What your educator wants you to learn next.</h3><p>Complete these lessons at your pace. Your progress updates automatically for the classroom.</p></div><div>{cohortState?.assignments.map((assignment) => { const lesson = lessonTracks[assignment.course].find((item) => item.id === assignment.lessonId); const done = learningState?.records.some((record) => record.course === assignment.course && record.lessonId === assignment.lessonId && record.status === "completed"); return <button key={assignment.id} className={done ? "done" : ""} onClick={() => lesson && openLesson(lesson)}><span>{done ? "✓" : String(assignment.lessonId).padStart(2, "0")}</span><div><small>{assignment.course} · {assignment.dueAt ? `DUE ${new Date(assignment.dueAt).toLocaleDateString()}` : "NO DEADLINE"}</small><b>{assignment.title}</b>{assignment.instructions && <em>{assignment.instructions}</em>}</div><strong>{done ? "Complete" : "Open →"}</strong></button>; })}</div></section>}
              <div className="course-switcher" aria-label="Course tracks">
                {(["blockchain", "bitcoin", "ethereum"] as Course[]).map((course) => { const courseState = learningState?.courseProgress.find((item) => item.course === course); return <button key={course} className={selectedCourse === course ? "active" : ""} onClick={() => chooseCourse(course)}><span>{course === "blockchain" ? "01" : course === "bitcoin" ? "02" : "03"}</span><b>{course === "blockchain" ? "Blockchain basics" : course === "bitcoin" ? "Bitcoin foundations" : "Ethereum & applications"}</b><small>{courseState?.completed ?? 0} / {lessonTracks[course].length} complete</small></button>; })}
              </div>
              <section className="lesson-player card">
                <div className="video-frame">{selectedLesson.video ? <video key={selectedLesson.video} controls preload="metadata" src={selectedLesson.video} onLoadedMetadata={(event) => { const savedPosition = selectedProgress?.positionSeconds ?? 0; if (savedPosition > 0 && savedPosition < event.currentTarget.duration - 3) event.currentTarget.currentTime = savedPosition; }} onPlay={() => { if (!selectedComplete) void saveLessonProgress(selectedLesson, "in_progress", selectedProgress?.positionSeconds ?? 0, selectedProgress?.durationSeconds ?? 0); }} onTimeUpdate={trackVideoProgress} onEnded={(event) => void saveLessonProgress(selectedLesson, "completed", Math.floor(event.currentTarget.duration || 0), Math.floor(event.currentTarget.duration || 0))}>Your browser does not support video playback.</video> : <div className="mask-video-sync"><MaskOrb /><b>{selectedLesson.title}</b><span>MASK-SYNCED LESSON</span><button onClick={() => { if (!selectedComplete) void saveLessonProgress(selectedLesson, "in_progress"); notify("Lesson opened from the Mask course library"); }}>Open lesson ▶</button></div>}<span>APPROVED FACELESS LESSON</span></div>
                <div className="lesson-focus">
                  <span className="eyebrow">LESSON {String(selectedLesson.id).padStart(2, "0")} · {selectedLesson.unit}</span>
                  <h3>{selectedLesson.title}</h3>
                  <p>{selectedLesson.copy}</p>
                  <div className={selectedComplete ? "lesson-complete-panel done" : "lesson-complete-panel"}><span>{selectedComplete ? "✓" : "○"}</span><div><b>{selectedComplete ? "Lesson complete" : "Finish this lesson"}</b><small>{selectedComplete ? "Your guided activity is unlocked." : "The video also completes automatically when it ends."}</small></div>{!selectedComplete && <button disabled={learningBusy} onClick={() => saveLessonProgress(selectedLesson, "completed", selectedProgress?.positionSeconds ?? 0, selectedProgress?.durationSeconds ?? 0)}>{learningBusy ? "Saving…" : "Mark complete"}</button>}</div>
                  <div className="lesson-actions"><button className="primary" disabled={!selectedComplete} onClick={() => notify(`${selectedLesson.action} opened in guided mode`)}>{selectedComplete ? `${selectedLesson.action} →` : "Complete to unlock"}</button><button className="secondary" onClick={() => setActive("mask")}>Ask Mask</button></div>
                  <small>Progress follows your Campus profile across devices. Mask can bring you back to this exact lesson.</small>
                </div>
              </section>
              <div className="course-head"><div><span className="eyebrow">CURRENT COURSE</span><h3>{selectedCourse === "blockchain" ? "Blockchain basics" : selectedCourse === "bitcoin" ? "Bitcoin foundations" : "Ethereum & applications"} · {lessonTracks[selectedCourse].length} lessons</h3></div><span>{learningState?.courseProgress.find((item) => item.course === selectedCourse)?.completed ?? 0} complete</span></div>
              <div className="lesson-library">
                {lessonTracks[selectedCourse].map((lesson) => (
                  <button key={lesson.id} className={`${selectedLesson.id === lesson.id ? "library-card active" : "library-card"}${learningState?.records.some((record) => record.course === lesson.course && record.lessonId === lesson.id && record.status === "completed") ? " completed" : ""}`} onClick={() => openLesson(lesson)}>
                    <span className="library-number">{learningState?.records.some((record) => record.course === lesson.course && record.lessonId === lesson.id && record.status === "completed") ? "✓" : String(lesson.id).padStart(2, "0")}</span>
                    <span className="library-copy"><small>{lesson.unit}</small><strong>{lesson.title}</strong><em>{lesson.copy}</em></span>
                    <span className="library-time">{lesson.time}<b>▶</b></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {active === "mask" && (
            <div className="mask-page">
              <section className="mask-stage">
                <div className="mask-stage-copy"><span className="eyebrow">YOUR AI CO-HOST</span><h2>Ask Mask.<br /><em>Anything.</em></h2><p>A general AI co-host that also understands every approved Faceless lesson. Curriculum when relevant—direct answers when it isn’t.</p></div>
                <div className="mask-stage-orb"><div className="signal-ring ring-one" /><div className="signal-ring ring-two" /><MaskOrb /></div>
              </section>
              <section className="mask-chat card">
                <div className="mask-context"><span><b>HYBRID ANSWER MODE</b><small>GENERAL KNOWLEDGE · FACELESS CURRICULUM · CURRENT WEB WHEN NEEDED</small></span><button onClick={() => setActive("learn")}>Optional context: {selectedLesson.title} ↗</button></div>
                <div className="mask-conversation" aria-live="polite">{maskMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-answer ${message.role}`}>
                  {message.role === "assistant" ? <MaskOrb compact /> : <span className="student-chat-mark">{initials}</span>}
                  <div><small>{message.role === "assistant" ? "MASK" : "YOU"}</small>{message.image ? <figure className="mask-message-art"><img src={message.image} alt="Artwork uploaded by the student" /><figcaption>{message.imageName}</figcaption></figure> : null}<p>{message.text}</p>{message.citations?.length ? <div className="mask-citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title} ↗</a>)}</div> : null}{message.launchDraft ? <button className="mask-launch-card" onClick={() => openLaunchDraft(message.launchDraft!)}><span><b>{message.launchDraft.assetType === "nft_collection" ? "NFT COLLECTION" : "TOKEN"} · {message.launchDraft.chain === "ethereum" ? "SEPOLIA" : "SOLANA DEVNET"}</b><strong>{message.launchDraft.name} ({message.launchDraft.symbol})</strong><small>{message.launchDraft.supply.toLocaleString()} supply · Review before anything is signed</small></span><em>Open in Launchpad →</em></button> : null}</div>
                </div>)}{maskBusy && <div className="chat-answer assistant thinking"><MaskOrb compact /><div><small>MASK</small><p>Thinking…</p></div></div>}</div>
                <div className="prompt-chips">{["Help me launch an NFT collection", "Help me launch a token", "Explain gas simply"].map((prompt) => <button key={prompt} onClick={() => setMaskQuestion(prompt)}>{prompt}</button>)}</div>
                {maskArtwork && <div className="mask-art-attachment"><img src={maskArtwork.dataUrl} alt="Artwork ready to attach" /><div><b>{maskArtwork.name}</b><small>{(maskArtwork.size / 1024 / 1024).toFixed(2)} MB · Ready for Mask</small><label><input type="checkbox" checked={maskArtworkRights} onChange={(event) => setMaskArtworkRights(event.target.checked)} /> I created this artwork or have permission to use it.</label></div><button type="button" onClick={() => { setMaskArtwork(null); setMaskArtworkRights(false); }} aria-label="Remove attached artwork">×</button></div>}
                <form className="mask-form" onSubmit={askMask}><label className="mask-upload-button" title="Attach artwork"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={attachMaskArtwork} /><span>＋</span><small>Art</small></label><input value={maskQuestion} onChange={(event) => setMaskQuestion(event.target.value)} placeholder={maskArtwork ? "Add a note for Mask (optional)…" : "Ask Mask anything…"} aria-label="Question for Mask" maxLength={1500} /><button type="submit" disabled={maskBusy}>{maskBusy ? "Thinking…" : maskArtwork ? "Send artwork →" : "Ask Mask →"}</button></form>
                <small className="prototype-note">Mask can explain and guide, but never signs wallet transactions or guarantees financial outcomes.</small>
              </section>
              <section className="mask-tools"><article><span>01</span><b>Understand</b><p>Explain the concept using the lesson you are watching.</p></article><article><span>02</span><b>Create</b><p>Turn the concept into a safe testnet activity.</p></article><article><span>03</span><b>Campaign</b><p>Convert a partner brief into a checklist, hook and script.</p></article></section>
            </div>
          )}

          {active === "wallet" && (
            <div className="page-stack">
              <section className="wallet-hero">
                <div><span className="eyebrow">YOUR MULTICHAIN CLASSROOM IDENTITY</span><h2>{wallet}</h2><p>{authenticated ? "Your Privy wallets are ready for supervised Ethereum and Solana practice." : "Demo identity · sign in with Google to create your real classroom wallets."}</p></div>
                <div className="wallet-balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? `${balance.toFixed(4)} ETH` : `${solBalance.toFixed(3)} SOL`}</strong><em>{usdPrices ? `≈ ${formatUsd(activeChain === "ethereum" ? balance * usdPrices.ethereum : solBalance * usdPrices.solana)} USD reference` : "Loading USD reference…"}</em><button onClick={() => claimCampusFaucet(activeChain)}>Claim from Campus Faucet ↓</button></div>
              </section>
              <div className="dual-wallets"><button className={activeChain === "ethereum" ? "active" : ""} onClick={() => resetTransferForChain("ethereum")}><span className="chain-coin eth">Ξ</span><span><small>ETHEREUM CLASSROOM WALLET</small><b>{ethWallet}</b><em>{balance.toFixed(4)} test ETH · Sepolia</em></span><strong>Open →</strong></button><button className={activeChain === "solana" ? "active" : ""} onClick={() => resetTransferForChain("solana")}><span className="chain-coin sol">S</span><span><small>SOLANA CLASSROOM WALLET</small><b>{solWallet}</b><em>{solBalance.toFixed(3)} test SOL · Devnet</em></span><strong>Open →</strong></button></div>
              <section className="wallet-addresses card" aria-label="Full classroom wallet addresses">
                <div className="section-head"><span><b>YOUR WALLET ADDRESSES</b><small>Use these when funding or receiving testnet assets</small></span></div>
                <div className="wallet-address-row">
                  <span className="chain-coin eth">Ξ</span>
                  <span><small>ETHEREUM · SEPOLIA</small><code>{ethWalletAddress}</code></span>
                  <button onClick={() => copyWalletAddress("ethereum")}>Copy ETH address</button>
                </div>
                <div className="wallet-address-row">
                  <span className="chain-coin sol">S</span>
                  <span><small>SOLANA · DEVNET</small><code>{solWalletAddress}</code></span>
                  <button onClick={() => copyWalletAddress("solana")}>Copy SOL address</button>
                </div>
              </section>
              <section className="campus-faucet card">
                <div className="faucet-intro">
                  <span className="eyebrow">FACELESS CAMPUS FAUCET</span>
                  <h3>Test funds without the Wi-Fi queue.</h3>
                  <p>Claims are tied to your verified Campus account, not the shared college internet connection.</p>
                  <span className="faucet-safe"><i /> Testnet only · no real monetary value</span>
                </div>
                <div className="faucet-options">
                  {(["ethereum", "solana", "robinhood"] as const).map((chain) => {
                    const config = faucetState?.chains.find((item) => item.chain === chain);
                    const meta = faucetNetworkMeta[chain];
                    const remaining = Math.max(0, (config?.maxClaims ?? 1) - (config?.claimsUsed ?? 0));
                    const ready = Boolean(config?.enabled && config.configured && faucetState?.signerReady);
                    return <article key={chain}>
                      <div className="faucet-chain"><span className={`chain-coin ${meta.className}`}>{meta.icon}</span><span><small>{meta.label}</small><b>{config?.amount ?? meta.fallback} {meta.asset}</b></span></div>
                      <div className="faucet-availability"><span>{remaining} of {config?.maxClaims ?? 1} claims left</span><i><b style={{ width: `${((config?.claimsUsed ?? 0) / Math.max(1, config?.maxClaims ?? 1)) * 100}%` }} /></i></div>
                      <button disabled={!ready || remaining === 0 || Boolean(faucetBusy)} onClick={() => claimCampusFaucet(chain)}>{faucetBusy === chain ? "Sending…" : remaining === 0 ? "Claim limit reached ✓" : ready ? `Claim ${chain === "robinhood" ? "Robinhood test ETH" : `test ${meta.asset}`}` : "Opening soon"}</button>
                    </article>;
                  })}
                  {faucetError && <div className="faucet-message">{faucetError}</div>}
                  {faucetState?.recent[0] && <div className={`faucet-recent ${faucetState.recent[0].status}`}><span>{faucetState.recent[0].status === "sent" ? "✓" : faucetState.recent[0].status === "failed" ? "!" : "…"}</span><div><small>LATEST CLAIM</small><b>{faucetState.recent[0].amount} {faucetNetworkMeta[faucetState.recent[0].chain].label.replace(" · ", " ")} · {faucetState.recent[0].status}</b></div>{faucetState.recent[0].transactionHash && <a href={faucetNetworkMeta[faucetState.recent[0].chain].explorer(faucetState.recent[0].transactionHash)} target="_blank" rel="noreferrer">View receipt ↗</a>}</div>}
                </div>
              </section>
              {authenticated && <section className="transfer-lab card">
                <div className="transfer-intro"><span className="eyebrow">SEND BY CAMPUS USERNAME</span><h3>Your first real testnet transfer.</h3><p>Find a classmate by username, verify the resolved wallet, then approve the transaction yourself. Test assets have no real value.</p><div className="transfer-steps"><span className={recipient ? "done" : "active"}><b>1</b> Find</span><span className={recipient && transferStatus !== "sent" ? "active" : transferStatus === "sent" ? "done" : ""}><b>2</b> Review</span><span className={transferStatus === "sent" ? "done" : ""}><b>3</b> Approve</span></div></div>
                <div className="transfer-panel">
                  <div className="transfer-network"><span className={`chain-coin ${activeChain === "ethereum" ? "eth" : "sol"}`}>{activeChain === "ethereum" ? "Ξ" : "S"}</span><span><small>SENDING ON</small><b>{activeChain === "ethereum" ? "Ethereum Sepolia" : "Solana Devnet"}</b></span><em>TESTNET</em></div>
                  <form className="recipient-search" onSubmit={resolveRecipient}><label htmlFor="recipient-name">Recipient username</label><div><span>@</span><input id="recipient-name" value={recipientName} onChange={(event) => { setRecipientName(event.target.value); setRecipient(null); setTransferReceipt(null); setTransferStatus("idle"); setTransferError(""); }} placeholder="classmate" autoComplete="off" /><button disabled={transferStatus === "resolving"}>{transferStatus === "resolving" ? "Finding…" : "Find wallet"}</button></div></form>
                  {recipient && <form className="transfer-review" onSubmit={sendTestnetTransfer}><div className="resolved-person"><span>✓</span><div><small>VERIFIED CAMPUS RECIPIENT</small><b>{recipient.username} · {recipient.displayName}</b><code>{shortenAddress(recipient.wallets.find((item) => item.chain === activeChain)?.address ?? "")}</code></div><button type="button" onClick={() => { setRecipient(null); setTransferStatus("idle"); }}>Change</button></div><label htmlFor="transfer-amount">Amount in test {activeChain === "ethereum" ? "ETH" : "SOL"}</label><div className="amount-row"><input id="transfer-amount" inputMode="decimal" value={transferAmount} onChange={(event) => { setTransferAmount(event.target.value); setTransferError(""); }} placeholder={activeChain === "ethereum" ? "0.001" : "0.01"} /><span>{activeChain === "ethereum" ? "ETH" : "SOL"}</span><button disabled={transferStatus === "sending" || !transferAmount}>{transferStatus === "sending" ? "Waiting for approval…" : `Review & send →`}</button></div><small className="transfer-limit">Classroom limit: 0.05 test ETH or 1 test SOL per transfer. Privy shows the final confirmation.</small></form>}
                  {transferError && <div className="transfer-message error">{transferError}</div>}
                  {transferReceipt && <div className="transfer-message success"><span>✓</span><div><b>Transfer submitted to {transferReceipt.username}</b><small>{transferReceipt.amount} {transferReceipt.chain === "ethereum" ? "test ETH" : "test SOL"}</small></div><a href={transferReceipt.explorer} target="_blank" rel="noreferrer">View transaction ↗</a></div>}
                </div>
              </section>}
              {authenticated && <section className="wallet-control card"><div><span className="eyebrow">YOU CONTROL YOUR WALLETS</span><h3>Connect or export whenever you need.</h3><p>Faceless never receives or stores your private keys. Export opens Privy’s protected wallet screen.</p></div><div><button onClick={() => linkWallet({ walletChainType: "ethereum-and-solana" })}>Connect MetaMask or Phantom</button><button disabled={!ethereumWallet} onClick={() => exportWallet("ethereum")}>Export Ethereum</button><button disabled={!solanaWallet} onClick={() => exportWallet("solana")}>Export Solana</button></div></section>}
              <section className="wallet-assets card">
                <div className="wallet-assets-head"><div><span className="eyebrow">YOUR ONCHAIN ITEMS</span><h3>Tokens, NFTs and everything you launch.</h3><p>Campus OS shows test funds and assets created through the launchpad in one place.</p></div><button disabled={walletAssetsLoading} onClick={() => void loadWalletAssets()}>{walletAssetsLoading ? "Refreshing…" : "Refresh assets ↻"}</button></div>
                <div className="wallet-asset-tabs" role="tablist" aria-label="Wallet asset type">{(["all", "tokens", "nfts"] as WalletAssetView[]).map((view) => <button role="tab" aria-selected={walletAssetView === view} className={walletAssetView === view ? "active" : ""} key={view} onClick={() => setWalletAssetView(view)}>{view === "all" ? "All assets" : view === "tokens" ? "Tokens" : "NFTs"}</button>)}</div>
                {(walletAssetView === "all" || walletAssetView === "tokens") && <div className="wallet-token-grid">
                  <article><span className="chain-coin eth">Ξ</span><div><small>ETHEREUM · SEPOLIA</small><b>{balance.toFixed(4)} ETH</b><strong>{usdPrices ? `≈ ${formatUsd(balance * usdPrices.ethereum)}` : "USD reference unavailable"}</strong><em>Reference only · test token</em></div><a href={`https://sepolia.etherscan.io/address/${ethWalletAddress}`} target="_blank" rel="noreferrer">Explorer ↗</a></article>
                  <article><span className="chain-coin sol">S</span><div><small>SOLANA · DEVNET</small><b>{solBalance.toFixed(3)} SOL</b><strong>{usdPrices ? `≈ ${formatUsd(solBalance * usdPrices.solana)}` : "USD reference unavailable"}</strong><em>Reference only · test token</em></div><a href={`https://explorer.solana.com/address/${solWalletAddress}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer ↗</a></article>
                  {campusTokens.filter((token) => BigInt(token.owned) > 0n).map((token) => <article key={token.id}><span className={`chain-coin ${token.chain === "ethereum" ? "eth" : "sol"}`}>{token.symbol.slice(0, 2)}</span><div><small>{token.standard.toUpperCase()} · {token.chain === "ethereum" ? "SEPOLIA" : "SOLANA DEVNET"}</small><b>{Number(token.owned).toLocaleString()} {token.symbol}</b><strong>Campus token · no USD value</strong><em>{token.authorityMode === "revoke" ? "Fixed supply" : "Creator mint authority active"}</em></div><button onClick={() => { setSelectedTokenId(token.id); setMarketArea("tokens"); setActive("market"); }}>Send →</button></article>)}
                </div>}
                {(walletAssetView === "all" || walletAssetView === "nfts") && <div className="wallet-nft-area">
                  <div className="wallet-nft-title"><b>NFTs in your Campus wallet</b><small>{walletNfts.length} launchpad item{walletNfts.length === 1 ? "" : "s"}</small></div>
                  {walletAssetsLoading && walletNfts.length === 0 ? <div className="wallet-assets-empty">Reading your Campus launches…</div> : walletAssetsError ? <div className="wallet-assets-empty error">{walletAssetsError}</div> : walletNfts.length ? <div className="wallet-nft-grid">{walletNfts.map((asset) => <article key={asset.id} className="wallet-nft-card"><img src={asset.image} alt={asset.name} /><div><span><small>{asset.standard} · {asset.network === "sepolia" ? "SEPOLIA" : "SOLANA DEVNET"}</small><b>{asset.name}</b><em>{asset.quantity} owned · edition supply {asset.maxSupply}</em></span><div>{asset.contractAddress && <a href={asset.chain === "ethereum" ? `https://sepolia.etherscan.io/address/${asset.contractAddress}` : `https://core.metaplex.com/explorer/${asset.contractAddress}?env=devnet`} target="_blank" rel="noreferrer">{asset.chain === "ethereum" ? "Contract" : "Collection"} ↗</a>}{asset.assetAddress && <a href={`https://core.metaplex.com/explorer/${asset.assetAddress}?env=devnet`} target="_blank" rel="noreferrer">NFT ↗</a>}{asset.mintTransactionHash && <a href={asset.chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${asset.mintTransactionHash}` : `https://explorer.solana.com/tx/${asset.mintTransactionHash}?cluster=devnet`} target="_blank" rel="noreferrer">Mint receipt ↗</a>}<a href={asset.metadata} target="_blank" rel="noreferrer">Metadata ↗</a></div></div></article>)}</div> : <div className="wallet-assets-empty"><b>No launchpad NFTs yet.</b><span>Mint an NFT on testnet and it will appear here automatically.</span><button onClick={() => setActive("create")}>Launch your first NFT →</button></div>}
                </div>}
                <small className="wallet-assets-note">Incoming assets from outside Campus OS will be added when the full testnet indexer is connected.</small>
              </section>
            </div>
          )}

          {active === "create" && (
            <div className="page-stack">
              <section className="build-hero"><div><span className="eyebrow">IDEA → DEMO → TESTNET PROJECT</span><h2>See what is possible.<br />Then deploy your version.</h2><p>Every demo explains the idea, shows how it works and opens a guided build for Ethereum or Solana.</p></div><div className="build-chain"><button className={activeChain === "ethereum" ? "active" : ""} onClick={() => setActiveChain("ethereum")}>Ξ Ethereum<br /><small>Sepolia</small></button><button className={activeChain === "solana" ? "active sol" : "sol"} onClick={() => setActiveChain("solana")}>S Solana<br /><small>Devnet</small></button></div></section>
              <nav className="build-area-tabs" aria-label="Build Lab sections"><button className={buildArea === "ideas" ? "active" : ""} onClick={() => setBuildArea("ideas")}><b>01</b><span>Ideas<small>See what is possible</small></span></button><button className={buildArea === "studio" ? "active" : ""} onClick={() => setBuildArea("studio")}><b>02</b><span>Project Studio<small>Build with your team</small></span></button><button className={buildArea === "nft" ? "active" : ""} onClick={() => setBuildArea("nft")}><b>03</b><span>NFT Builder<small>Launch original art</small></span></button><button className={buildArea === "showcase" ? "active" : ""} onClick={() => { setBuildArea("showcase"); void loadShowcase(); }}><b>04</b><span>Showcase<small>Verified Campus work</small></span></button></nav>
              {buildArea === "ideas" && <div className="build-demo-grid">{buildDemos.map((demo) => <article className="build-demo card" key={demo.title}><span>{demo.icon}</span><div><small>{demo.level} · {demo.chain}</small><h3>{demo.title}</h3><p>{demo.copy}</p></div><button onClick={() => { setBuildArea("studio"); setBuilderDraft((current) => ({ ...current, title: demo.title, chain: demo.chain === "SOL" ? "solana" : demo.chain === "ETH" ? "ethereum" : "multichain", useCase: demo.title.includes("NFT") ? "NFTs & digital ownership" : demo.title.includes("token") ? "Tokens & communities" : demo.title.includes("real-world") ? "RWA tokenisation" : demo.title.includes("game") ? "Gaming & collectibles" : current.useCase })); }}>Build this idea →</button></article>)}</div>}
              {buildArea === "studio" && <section className="builder-studio card">
                <header className="builder-studio-head"><div><span className="eyebrow">PERSISTENT PROJECT STUDIO</span><h3>Turn the idea into proof you actually built.</h3><p>Define the user problem, work through four clear milestones, attach a testnet or demo reference, then request educator verification.</p></div><button onClick={() => openBuilderProject()}>＋ New build</button></header>
                <div className="builder-studio-layout"><aside><small>YOUR BUILDS</small>{builderProjectState?.projects.length ? builderProjectState.projects.slice(0, 8).map((project) => <button key={project.id} className={builderDraft.id === project.id ? "active" : ""} onClick={() => openBuilderProject(project)}><span><b>{project.title}</b><small>{project.isOwner ? "Project lead" : "Team project"} · {project.chain}</small></span><em className={project.invitationStatus === "invited" ? "invited" : project.status}>{project.invitationStatus === "invited" ? "INVITED" : project.status.replaceAll("_", " ")}</em></button>) : <p>No saved builds yet. Start with a problem worth solving.</p>}</aside>
                  <form onSubmit={(event) => { event.preventDefault(); void builderProjectAction("save"); }}><div className="builder-project-fields"><label>Project name<input required value={builderDraft.title} onChange={(event) => setBuilderDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Campus event credential" /></label><label>Network<select value={builderDraft.chain} onChange={(event) => setBuilderDraft((current) => ({ ...current, chain: event.target.value as BuilderProject["chain"] }))}><option value="ethereum">Ethereum · Sepolia</option><option value="solana">Solana · Devnet</option><option value="multichain">Multichain</option></select></label><label>Use case<select value={builderDraft.useCase} onChange={(event) => setBuilderDraft((current) => ({ ...current, useCase: event.target.value }))}><option>NFTs & digital ownership</option><option>Tokens & communities</option><option>Payments & transfers</option><option>RWA tokenisation</option><option>Gaming & collectibles</option><option>Identity & credentials</option><option>Creator economy</option><option>Other</option></select></label><label className="wide">What problem are you solving?<textarea required value={builderDraft.problem} onChange={(event) => setBuilderDraft((current) => ({ ...current, problem: event.target.value }))} placeholder="Describe the current difficulty in one clear paragraph." /></label><label>Who is it for?<textarea required value={builderDraft.audience} onChange={(event) => setBuilderDraft((current) => ({ ...current, audience: event.target.value }))} placeholder="Students, creators, clubs, collectors…" /></label><label className="span-two">How does your version work?<textarea required value={builderDraft.solution} onChange={(event) => setBuilderDraft((current) => ({ ...current, solution: event.target.value }))} placeholder="Explain the user flow without technical jargon." /></label></div>
                    <div className="builder-milestones"><header><span><b>BUILD MILESTONES</b><small>{builderDraft.milestones.filter((item) => item.done).length} of 4 complete</small></span><i><b style={{ width: `${(builderDraft.milestones.filter((item) => item.done).length / 4) * 100}%` }} /></i></header>{builderDraft.milestones.map((milestone, index) => <label key={milestone.label} className={milestone.done ? "done" : ""}><input type="checkbox" checked={milestone.done} onChange={(event) => setBuilderDraft((current) => ({ ...current, milestones: current.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, done: event.target.checked } : item) }))} /><span><b>{String(index + 1).padStart(2, "0")}</b><strong>{milestone.label}</strong></span><em>{milestone.done ? "DONE ✓" : "TO DO"}</em></label>)}</div>
                    <div className="builder-proof-fields"><label>Public demo link · optional<input type="url" value={builderDraft.demoUrl} onChange={(event) => setBuilderDraft((current) => ({ ...current, demoUrl: event.target.value }))} placeholder="https://your-demo…" /></label><label>Testnet contract, mint or transaction<input value={builderDraft.contractReference} onChange={(event) => setBuilderDraft((current) => ({ ...current, contractReference: event.target.value }))} placeholder="0x… or Solana address / transaction" /></label></div>
                    {(() => { const project = builderProjectState?.projects.find((item) => item.id === builderDraft.id); if (!project) return null; return <section className="builder-team"><header><span><b>PROJECT TEAM</b><small>Accepted teammates receive the same verified Passport credit</small></span><em>{project.members.filter((member) => member.status === "accepted").length} contributors</em></header>{project.invitationStatus === "invited" && <div className="builder-invite-banner"><span><b>You were invited as {project.members.find((member) => member.userId !== project.members[0]?.userId && member.username === campusUsername)?.role ?? "a contributor"}</b><small>Accept before editing milestones or receiving verified credit.</small></span><button type="button" onClick={() => void builderProjectAction("respond", { projectId: project.id, status: "declined" })}>Decline</button><button type="button" onClick={() => void builderProjectAction("respond", { projectId: project.id, status: "accepted" })}>Join project ✓</button></div>}<div className="builder-team-list">{project.members.map((member) => <article key={member.id}><span className="profile-dot">{member.displayName.slice(0, 2).toUpperCase()}</span><span><b>{member.displayName}</b><small>@{member.username} · {member.role}</small></span><em className={member.status}>{member.status}</em>{project.isOwner && member.userId !== project.members[0]?.userId && project.status !== "verified" && <button type="button" aria-label={`Remove @${member.username}`} onClick={() => void builderProjectAction("remove_member", { projectId: project.id, memberUserId: member.userId })}>×</button>}{!project.isOwner && member.username === campusUsername && project.status !== "verified" && <button type="button" aria-label="Leave project" onClick={() => void builderProjectAction("remove_member", { projectId: project.id, memberUserId: member.userId })}>×</button>}</article>)}</div>{project.isOwner && project.status !== "submitted" && project.status !== "verified" && <div className="builder-team-invite"><label>Campus username<input value={builderInvite.username} onChange={(event) => setBuilderInvite((current) => ({ ...current, username: event.target.value.replace(/^@/, "") }))} placeholder="classmate" /></label><label>Project role<select value={builderInvite.role} onChange={(event) => setBuilderInvite((current) => ({ ...current, role: event.target.value }))}><option>Developer</option><option>Designer</option><option>Researcher</option><option>Content & community</option><option>Product lead</option><option>Smart contract developer</option></select></label><button type="button" disabled={!builderInvite.username || builderProjectBusy} onClick={() => void builderProjectAction("invite", { projectId: project.id, ...builderInvite })}>Invite teammate →</button></div>}</section>; })()}
                    {(() => { const project = builderProjectState?.projects.find((item) => item.id === builderDraft.id); const canEdit = !project || project.isOwner || project.invitationStatus === "accepted"; return <div className="builder-project-actions"><button disabled={builderProjectBusy || !canEdit}>{builderProjectBusy ? "Saving…" : project && !canEdit ? "Accept invitation to edit" : "Save progress"}</button><button type="button" onClick={() => { setMaskQuestion(`Help me improve this blockchain project idea: ${builderDraft.title}. Problem: ${builderDraft.problem}. Audience: ${builderDraft.audience}. Proposed solution: ${builderDraft.solution}`); setActive("mask"); }}>Improve with Mask</button>{(!project || project.isOwner) && <button className="primary" type="button" disabled={!project || project.status === "submitted" || project.status === "verified" || builderProjectBusy} onClick={() => void builderProjectAction("submit", { id: project?.id })}>{project?.status === "submitted" ? "Waiting for verification…" : project?.status === "verified" ? "Verified to every Passport ✓" : "Request verification →"}</button>}{project && !project.isOwner && project.invitationStatus === "accepted" && <span className="builder-collab-note">You can update the build. The project lead submits it for verification.</span>}{project?.reviewNotes && <p className={project.status}>{project.reviewNotes}</p>}</div>; })()}
                  </form></div>
                <footer><span><b>01 · Frame</b> Start with the human problem</span><span><b>02 · Build</b> Create the smallest working version</span><span><b>03 · Prove</b> Add a demo or testnet receipt</span><span><b>04 · Verify</b> Publish approved work to Passport</span></footer>
              </section>}
              {buildArea === "nft" && <section className="guided-builder"><div className="creator-copy"><span className="eyebrow">GUIDED BUILD · ORIGINAL ART</span><h2>Turn an idea into an onchain object.</h2><p>Create a testnet collection, mint original work and decide how many editions should exist.</p><div className="creator-note"><b>Testnet freedom</b><span>Only upload work you created.</span><span>Testnet assets have no real value.</span><span>Launches need your wallet approval—not educator approval.</span></div></div>
              <form className="creator-form card" onSubmit={createCollection}>
                <div className="form-head"><span><b>NEW TESTNET COLLECTION</b><small>Idea → wallet review → launch</small></span><em>{activeChain === "ethereum" ? "SEPOLIA" : "SOLANA DEVNET"}</em></div>
                <label>Collection name<input name="collectionName" required placeholder="e.g. Campus Signals" /></label>
                <label>Creator story<textarea name="creatorStory" required placeholder="What inspired the work? What should a collector understand?" /></label>
                <div className="form-row"><label>Symbol<input name="symbol" required placeholder="SIGNAL" maxLength={8} /></label><label>Edition size<input name="editionSize" required type="number" min="1" max="1000" defaultValue="3" /></label></div>
                <label className="upload-box"><input type="file" accept="image/*" onChange={handleArt} /><span>{artPreview ? <img src={artPreview} alt="Artwork preview" /> : <><b>＋</b><strong>Upload first artwork</strong><small>PNG, JPG or WebP · original work only</small></>}</span></label>
                <label className="creator-rights"><input type="checkbox" required /> I created this artwork or have permission to use it.</label>
                <button className="primary full" type="submit">Review & launch on testnet →</button>
                <div className="testnet-open-note"><b>No educator gate on testnet.</b><span>Your wallet still shows every transaction before it is sent.</span></div>
              </form>
              </section>}
              {buildArea === "showcase" && <section className="campus-showcase"><header className="showcase-head"><div><span className="eyebrow">VERIFIED CAMPUS SHOWCASE</span><h2>Built here. Proved here.<br /><i>Seen by the cohort.</i></h2><p>Only educator-verified projects appear. One student gets one applause per project, and featured builds form the demo-day shortlist.</p></div><aside><b>{showcaseState?.projects.length ?? 0}</b><small>verified builds</small><span>{showcaseState?.projects.filter((project) => project.featured).length ?? 0} featured for demo day</span></aside></header>{showcaseState?.projects.length ? <div className="showcase-grid">{showcaseState.projects.map((project, index) => <article key={project.id} className={project.featured ? "showcase-card featured" : "showcase-card"}><div className="showcase-card-top"><span>{project.featured ? "FEATURED BUILD" : `VERIFIED · ${String(index + 1).padStart(2, "0")}`}</span><em>{project.chain === "multichain" ? "ETH + SOL" : project.chain.toUpperCase()}</em></div><div className="showcase-card-copy"><small>{project.useCase}</small><h3>{project.title}</h3><p>{project.solution}</p><div><b>Built for</b><span>{project.audience}</span></div></div><div className="showcase-team"><span>{project.team.slice(0, 3).map((member) => <i key={member.id} title={`${member.displayName} · ${member.role}`}>{member.displayName.slice(0, 2).toUpperCase()}</i>)}</span><small>{project.team.map((member) => `@${member.username}`).join(" · ")}</small></div><footer>{project.demoUrl ? <a href={project.demoUrl} target="_blank" rel="noreferrer">Open demo ↗</a> : project.contractReference ? <span className="showcase-proof">Onchain proof ✓</span> : <span /> }<button className={project.applauded ? "applauded" : ""} disabled={showcaseBusyId === project.id} onClick={() => void showcaseAction("applaud", project.id)}>◆ {project.applauseCount} {project.applauded ? "Applauded" : "Applaud"}</button>{showcaseState.role === "owner" && <button className="feature-action" disabled={showcaseBusyId === project.id} onClick={() => void showcaseAction(project.featured ? "unfeature" : "feature", project.id)}>{project.featured ? "Unfeature" : "Feature →"}</button>}</footer></article>)}</div> : <div className="showcase-empty card"><span>04</span><div><h3>The first verified build will appear here.</h3><p>Complete all four Project Studio milestones, add a working demo or testnet proof, and ask the educator to verify it.</p></div><button onClick={() => setBuildArea("studio")}>Open Project Studio →</button></div>}<footer className="showcase-rules"><span><b>Verified only</b> Educator review protects the signal.</span><span><b>Cohort visibility</b> Students see work from their Campus class.</span><span><b>No popularity XP</b> Applause celebrates work but never changes grades or league rank.</span></footer></section>}
            </div>
          )}

          {active === "games" && (
            <div className="page-stack">
              <section className="league-hero"><div><span className="eyebrow">FACELESS CAMPUS LEAGUE</span><h2>Learn it. Prove it.<br /><i>Climb the league.</i></h2><p>XP comes only from Campus-verified learning and testnet actions. No self-reported scores and no real-money rewards.</p><button onClick={() => void loadLeague()} disabled={leagueLoading}>{leagueLoading ? "Updating league…" : "Refresh verified XP ↻"}</button></div><aside><MaskOrb compact /><span><small>YOUR VERIFIED XP</small><strong>{leagueState?.own.xp ?? 0}</strong><b>LVL {leagueState?.own.level ?? 1} · {leagueState?.own.name ?? "Wallet Rookie"}</b></span><div><i style={{ width: `${Math.min(100, ((leagueState?.own.xp ?? 0) / (leagueState?.own.nextAt ?? 100)) * 100)}%` }} /></div><small>{leagueState?.own.rank ? `Campus rank #${leagueState.own.rank}` : "Educator view"} · next level at {leagueState?.own.nextAt ?? 100} XP</small></aside></section>
              <div className="league-layout"><section className="league-board card"><div className="section-head"><span><b>LIVE LEADERBOARD</b><small>Top verified builders in this Campus cohort</small></span><em>{leagueState?.leaderboard.length ?? 0} ranked</em></div><div>{leagueState?.leaderboard.length ? leagueState.leaderboard.slice(0, 12).map((player) => <article key={player.id} className={player.username === campusUsername ? "you" : ""}><strong>{String(player.rank).padStart(2, "0")}</strong><span className="profile-dot">{player.displayName.slice(0, 2).toUpperCase()}</span><div><b>{player.displayName}</b><small>@{player.username} · {player.name}</small></div><em>{player.xp} XP</em></article>) : <p className="league-empty">Verified activity will appear here as students complete Campus quests.</p>}</div></section><section className="league-missions card"><div className="section-head"><span><b>XP MISSIONS</b><small>Every mission checks real Campus proof</small></span></div><div>{leagueState?.missions.map((mission) => <article key={mission.id} className={mission.done ? "done" : ""}><span>{mission.done ? "✓" : "+"}</span><div><b>{mission.title}</b><small>{mission.done ? "Verified on Campus" : `Earn ${mission.xp} XP`}</small></div><button onClick={() => setActive(mission.destination)}>{mission.done ? "View" : "Start →"}</button></article>) ?? <p className="league-empty">Loading your missions…</p>}</div></section></div>
              <div className="league-badges"><div><span className="eyebrow">YOUR PROOF BADGES</span><h3>Unlocked by actions—not button clicks.</h3></div>{leagueState?.own.badges.length ? <section>{leagueState.own.badges.map((badge) => <span key={badge}>◆ {badge}</span>)}</section> : <p>Complete your first mission to unlock a verified badge.</p>}</div>
              <div className="game-grid">{games.map((game) => <article className={`game-card ${game.color}`} key={game.id}><div className="game-art"><span>{String(game.id).padStart(2, "0")}</span><div className="pixel-track"><i /><i /><i /><b /></div><em>{game.id < 3 ? "VERIFIED QUEST" : game.status}</em></div><div className="game-copy"><small>{game.chain}</small><h3>{game.title}</h3><p>{game.copy}</p><div><span>PROOF: {game.reward}</span><button onClick={() => game.id === 1 ? setActive("market") : game.id === 2 ? setActive("launchpad") : notify(`${game.title} added to the next game lab`)}>{game.id < 3 ? "Start quest →" : "Notify me"}</button></div></div></article>)}</div>
              <section className="game-builder card"><div><span className="eyebrow">STUDENT GAME LAB</span><h3>Have a game idea?</h3><p>Start from a wallet login, collectible, score or reward mechanic. Mask turns the idea into a build map and suggests whether Ethereum or Solana fits better.</p></div><button onClick={() => setActive("mask")}>Design it with Mask →</button></section>
            </div>
          )}

          {active === "tools" && (
            <div className="page-stack">
              <section className="tools-hero">
                <div><span className="eyebrow">CREATOR TOOLS</span><h2>Learn the craft.<br />Make better content.</h2><p>Simple, phone-first guidance for turning an idea or brief into content you can confidently publish.</p><button className="primary" onClick={() => setActive("mask")}>Plan with Mask →</button></div>
                <div className="tools-flow" aria-label="Creator workflow"><span><b>01</b>Understand</span><span><b>02</b>Script</span><span><b>03</b>Shoot</span><span><b>04</b>Edit</span></div>
              </section>
              <section className="creator-workspace card"><div className="creator-workspace-head"><div><span className="eyebrow">SAVED CREATOR WORKSPACE</span><h3>Turn the brief into a shoot-ready plan.</h3><p>Plan here, shoot on your phone, then trim and caption inside Instagram Edits.</p></div><button onClick={() => openCreatorProject()}>＋ New project</button></div><div className="creator-workspace-layout"><form onSubmit={(event) => { event.preventDefault(); void saveCreatorProject("save"); }}><div className="creator-project-grid"><label>Project or campaign<input required value={creatorDraft.title} onChange={(event) => setCreatorDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Campus café Reel" /></label><label>Platform<select value={creatorDraft.platform} onChange={(event) => setCreatorDraft((current) => ({ ...current, platform: event.target.value }))}><option>Instagram Reels</option><option>YouTube Shorts</option><option>X video</option><option>LinkedIn</option></select></label><label>Format<select value={creatorDraft.format} onChange={(event) => setCreatorDraft((current) => ({ ...current, format: event.target.value as CreatorFormat }))}><option value="faceless">Faceless</option><option value="on_camera">On camera</option><option value="voiceover">Voiceover</option><option value="hands_only">Hands only</option><option value="screen_recording">Screen recording</option></select></label><label className="wide">Objective<textarea required value={creatorDraft.objective} onChange={(event) => setCreatorDraft((current) => ({ ...current, objective: event.target.value }))} placeholder="What should the viewer understand, feel or do?" /></label><label className="wide hook-field">Hook<input value={creatorDraft.hook} onChange={(event) => setCreatorDraft((current) => ({ ...current, hook: event.target.value }))} placeholder="The first line or visual that stops the scroll" /></label></div><div className="five-shot-plan"><div><b>THE FIVE-SHOT PLAN</b><small>One clear job for every clip</small></div>{["Hook", "Context", "Detail", "Proof", "Call to action"].map((label, index) => <label key={label}><span>{index + 1}</span><b>{label}</b><input value={creatorDraft.shots[index] ?? ""} onChange={(event) => setCreatorDraft((current) => ({ ...current, shots: current.shots.map((shot, shotIndex) => shotIndex === index ? event.target.value : shot) }))} placeholder={index === 0 ? "Opening visual or spoken line" : index === 4 ? "What should the viewer do next?" : `What will shot ${index + 1} show?`} /></label>)}</div><label className="creator-caption">Caption + disclosure<textarea value={creatorDraft.caption} onChange={(event) => setCreatorDraft((current) => ({ ...current, caption: event.target.value }))} placeholder="Write the caption, CTA and any required ad/partner disclosure." /></label><div className="creator-project-actions"><button type="submit" disabled={creatorProjectBusy}>{creatorProjectBusy ? "Saving…" : "Save draft"}</button><button type="button" onClick={() => void saveCreatorProject("mark_ready")} disabled={creatorProjectBusy}>Mark ready to shoot →</button><button type="button" onClick={copyCreatorPlan}>Copy plan</button></div></form><aside><div className="section-head"><span><b>YOUR PROJECTS</b><small>Continue where you left off</small></span></div>{creatorProjectState?.projects.length ? creatorProjectState.projects.slice(0, 6).map((project) => <button className={creatorDraft.id === project.id ? "active" : ""} key={project.id} onClick={() => openCreatorProject(project)}><span><b>{project.title}</b><small>{project.platform} · {project.format.replaceAll("_", " ")}</small></span><em>{project.status === "ready" ? "READY" : "DRAFT"}</em></button>) : <p>No saved projects yet. Start with your next campaign or content idea.</p>}{Boolean(campaignState?.campaigns.some((campaign) => campaign.joined)) && <div className="creator-briefs"><b>JOINED CAMPAIGNS</b>{campaignState?.campaigns.filter((campaign) => campaign.joined).slice(0, 3).map((campaign) => <button key={campaign.id} onClick={() => setCreatorDraft((current) => ({ ...current, title: campaign.title, platform: campaign.platform, objective: campaign.brief }))}><span><strong>{campaign.brand}</strong><small>{campaign.title}</small></span><em>Use brief →</em></button>)}</div>}</aside></div><footer><span><b>1 · Plan</b> Campus OS</span><span><b>2 · Shoot</b> Phone camera</span><span><b>3 · Edit</b> Instagram Edits</span><span><b>4 · Submit</b> Campaigns</span></footer></section>
              <section className="creator-review-strip card"><div><span className="eyebrow">PRE-SHOOT REVIEW</span><h3>Get the plan approved before filming.</h3><p>Link a joined campaign if relevant, mark the full plan ready, then send it to your educator.</p></div><label>Linked campaign<select value={creatorDraft.campaignId} onChange={(event) => setCreatorDraft((current) => ({ ...current, campaignId: event.target.value }))}><option value="">Independent creator project</option>{campaignState?.campaigns.filter((campaign) => campaign.joined).map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.brand} · {campaign.title}</option>)}</select></label><aside>{(() => { const project = creatorProjectState?.projects.find((item) => item.id === creatorDraft.id); if (!project) return <><b>Save this project first</b><small>The review record needs a saved content plan.</small></>; return <><b>{project.reviewStatus === "submitted" ? "Waiting for educator" : project.reviewStatus === "changes_requested" ? "Changes requested" : project.reviewStatus === "approved" ? "Approved to shoot ✓" : project.status === "ready" ? "Ready to request review" : "Complete the plan first"}</b><small>{project.reviewNotes || (project.campaign ? `Linked to ${project.campaign.brand} · ${project.campaign.title}` : "Independent creator project")}</small>{project.reviewStatus !== "submitted" && project.reviewStatus !== "approved" && <button disabled={project.status !== "ready" || creatorProjectBusy} onClick={() => void creatorProjectReviewAction("submit_review", { id: project.id })}>Send for pre-shoot review →</button>}</>; })()}</aside></section>
              <div className="creator-school-head"><div><span className="eyebrow">CREATOR SCHOOL</span><h3>Learn the skill before taking the brief.</h3></div><span>Phone-first · Beginner-friendly</span></div>
              <div className="creator-tool-grid">{creatorTools.map((tool) => <article className="creator-tool card" key={tool.number}><span>{tool.number}</span><h3>{tool.title}</h3><p>{tool.copy}</p><button onClick={() => tool.number === "03" ? setActive("mask") : notify(`${tool.title} opened in guided mode`)}>{tool.action} →</button></article>)}</div>
              <section className="editing-handoff">
                <article className="card"><span>IN CAMPUS OS</span><h3>Prepare before you shoot.</h3><p>Understand the brief, choose a format, draft the hook and build a five-shot plan with Mask.</p></article>
                <article className="card"><span>IN INSTAGRAM EDITS</span><h3>Finish on your phone.</h3><p>Trim the strongest takes, add readable captions, set the pacing and export the final vertical video.</p></article>
              </section>
              <section className="tools-next card"><div><span className="eyebrow">READY TO USE THE SKILL?</span><h3>Pick a real brief in Campaigns.</h3></div><button onClick={() => setActive("campaigns")}>Browse campaigns →</button></section>
            </div>
          )}

          {active === "campaigns" && (
            <div className="page-stack">
              <section className="campaign-hero">
                <div><span className="eyebrow">CAMPAIGNS</span><h2>Choose a brief.<br />Create. Get paid.</h2><p>Join creator, faceless, clipping or user-acquisition missions. Every brief stays clear, every submission is reviewed and approved work is paid manually.</p><div className="campaign-hero-actions"><button className="primary" onClick={() => notify("Mask matched you with two beginner-friendly missions")}>Find my campaign →</button><button className="secondary-light" onClick={() => setActive("tools")}>Learn creator skills</button></div></div>
                <div className="campaign-steps"><span><b>1</b> Claim a campaign</span><span><b>2</b> Create and submit</span><span><b>3</b> Get approved and paid</span></div>
              </section>
              <section className="partner-lab card">
                <header className="partner-lab-head"><div><span className="eyebrow">FIRST-DAY LIVESTREAM · ROBINHOOD CHAIN TESTNET</span><h2>Launch your<br />first token.</h2><p>Five students become one live launch team: choose a Faceless personality, create its token on Vibevibe, trade with the testing community and race to complete the bonding curve.</p></div><aside><small>LIVE PARTNER REWARD</small><b>Participation is rewarded</b><span>Campus records each student’s role and on-chain proof. The educator submits one consolidated feedback form to the founder.</span><a href="https://testnet.vibevibe.fun" target="_blank" rel="noreferrer">Enter Vibevibe testnet ↗</a></aside></header>
                <div className="partner-chain-strip"><span><small>SUPPLY</small><b>1B fixed tokens</b></span><span><small>LAUNCH</small><b>0.0005 test ETH + gas</b></span><span><small>BONDING TARGET</small><b>0.005 test ETH</b></span><span><small>TRADING FEE</small><b>1% total</b></span><button onClick={() => setActive("wallet")}>Campus faucet →</button></div>
                <div className="partner-lab-flow"><span><b>01</b> Form team</span><span><b>02</b> Install Rabby</span><span><b>03</b> Claim + transfer</span><span><b>04</b> Launch live</span><span><b>05</b> Bond + graduate</span></div>
                <section className="rabby-handoff">
                  <div className="rabby-guide"><span className="eyebrow">CAMPUS → RABBY → VIBEVIBE</span><h3>Move only test ETH into your launch wallet.</h3><ol><li><b>Get Rabby</b><span>Install from <a href="https://rabby.io" target="_blank" rel="noreferrer">rabby.io ↗</a>, create a wallet and copy its 0x address.</span></li><li><b>Claim in Campus</b><span>Open Wallets and claim Robinhood Chain test ETH. Your Campus Ethereum address works on this EVM testnet.</span></li><li><b>Send to Rabby</b><span>Paste the Rabby address here. Your Campus wallet shows the final approval.</span></li><li><b>Launch in Rabby</b><span>Open <a href="https://testnet.vibevibe.fun" target="_blank" rel="noreferrer">testnet.vibevibe.fun ↗</a> inside Rabby, select Robinhood Chain Testnet and connect.</span></li></ol></div>
                  <form onSubmit={sendRobinhoodFundsToRabby}><div><small>ROBINHOOD CHAIN TESTNET · CHAIN ID 46630</small><b>Send test ETH to Rabby</b><span>Check the first and last characters twice. Blockchain transfers cannot be undone.</span></div><label>Rabby wallet address<input value={rabbyTransfer.address} onChange={(event) => setRabbyTransfer((current) => ({ ...current, address: event.target.value, status: "idle", error: "" }))} placeholder="0x… from Rabby" autoComplete="off" /></label><label>Amount in test ETH<input inputMode="decimal" value={rabbyTransfer.amount} onChange={(event) => setRabbyTransfer((current) => ({ ...current, amount: event.target.value, status: "idle", error: "" }))} /></label><button disabled={rabbyTransfer.status === "sending" || !authenticated}>{!authenticated ? "Sign in to transfer" : rabbyTransfer.status === "sending" ? "Check your Campus wallet…" : "Review & send to Rabby →"}</button>{rabbyTransfer.error && <p className="rabby-error">{rabbyTransfer.error}</p>}{rabbyTransfer.hash && <a className="rabby-receipt" href={`https://explorer.testnet.chain.robinhood.com/tx/${rabbyTransfer.hash}`} target="_blank" rel="noreferrer">Test ETH sent ✓ View receipt ↗</a>}<small className="rabby-safety">Never use real ETH, import a Campus private key, or share a recovery phrase.</small></form>
                </section>
                <div className="partner-mechanics"><span><b>BUY</b> moves the token up its curve</span><span><b>SELL</b> pressure-tests the return path</span><span><b>100%</b> exhausts curve inventory</span><span><b>GRADUATE</b> is a separate permissionless transaction</span></div>
                {!partnerLabState?.teams.length && partnerLabState?.role !== "owner" && <form className="partner-team-form" onSubmit={(event) => { event.preventDefault(); void partnerLabAction("create_team", { name: partnerTeamDraft.name, inviteUsernames: partnerTeamDraft.inviteUsernames.split(",") }); }}><div><span className="eyebrow">CREATE YOUR GROUP</span><h3>Invite exactly four classmates.</h3><p>You become the nominated launcher. Every username must already belong to your Campus cohort.</p></div><label>Team name<input required value={partnerTeamDraft.name} onChange={(event) => setPartnerTeamDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Team Genesis" /></label><label>Four usernames, separated by commas<input required value={partnerTeamDraft.inviteUsernames} onChange={(event) => setPartnerTeamDraft((current) => ({ ...current, inviteUsernames: event.target.value }))} placeholder="aanya, kabir, diya, arjun" /></label><button disabled={partnerLabBusy}>Create team →</button></form>}
                {partnerLabState?.teams.map((team) => {
                  const ownMember = team.members.find((member) => member.userId === partnerLabState.ownUserId);
                  const isLauncher = team.launcherUserId === partnerLabState.ownUserId;
                  const character = facelessPartnerCharacters.find((item) => item.key === team.characterKey);
                  return <article className="partner-team" key={team.id}>
                    <div className="partner-team-title">{character && <img src={character.image} alt={`${character.name} Faceless character`} />}<span><small>{team.status.toUpperCase()} · LIVESTREAM TEAM</small><h3>{team.name}</h3><p>{team.tokenName ? `${team.characterName} · ${team.tokenName} (${team.tokenSymbol})` : "Character and token identity waiting for the team."}</p></span><em>{team.progress.accepted}/5 joined</em></div>
                    {ownMember?.status === "invited" && <div className="partner-invite"><div><b>You have been invited as a market tester.</b><span>Accept to use your own Campus EVM wallet for the group’s testnet trades.</span></div><button disabled={partnerLabBusy} onClick={() => void partnerLabAction("accept_invite", { teamId: team.id })}>Join team →</button></div>}
                    <div className="partner-roster">{team.members.map((member) => <span className={member.status} key={member.id}><i>{member.username.slice(0, 2).toUpperCase()}</i><b>@{member.username}</b><small>{member.role === "launcher" ? "LAUNCHER" : "MARKET TESTER"} · {member.status}</small></span>)}</div>
                    {isLauncher && ownMember?.status === "accepted" && !team.tokenName && <form className="partner-setup partner-character-setup" onSubmit={(event) => { event.preventDefault(); void partnerLabAction("save_setup", { teamId: team.id, ...partnerSetupDraft }); }}><div className="partner-character-heading"><b>Choose the personality your group relates to.</b><small>The head is the identity. Music, microphone, coffee and speaker personalities can join this library when their official files are added.</small></div><div className="partner-character-grid">{facelessPartnerCharacters.map((item) => <button type="button" className={partnerSetupDraft.characterKey === item.key ? "selected" : ""} key={item.key} onClick={() => setPartnerSetupDraft((current) => ({ ...current, characterKey: item.key }))}><img src={item.image} alt="" /><span><b>{item.name}</b><small>{item.personality}</small></span></button>)}</div><label>Token name<input required value={partnerSetupDraft.tokenName} onChange={(event) => setPartnerSetupDraft((current) => ({ ...current, tokenName: event.target.value }))} /></label><label>Symbol<input required maxLength={16} value={partnerSetupDraft.tokenSymbol} onChange={(event) => setPartnerSetupDraft((current) => ({ ...current, tokenSymbol: event.target.value.toUpperCase() }))} /></label><label>Pitch<input required value={partnerSetupDraft.tokenPitch} onChange={(event) => setPartnerSetupDraft((current) => ({ ...current, tokenPitch: event.target.value }))} placeholder="Why should the community bond this personality?" /></label><label>Initial buy<select value={partnerSetupDraft.initialBuyEth} onChange={(event) => setPartnerSetupDraft((current) => ({ ...current, initialBuyEth: event.target.value }))}><option value="0">None</option><option value="0.00001">0.00001 test ETH</option><option value="0.00002">0.00002 test ETH</option><option value="0.00003">0.00003 test ETH</option></select></label><button disabled={partnerLabBusy}>Lock launch setup →</button></form>}
                    {isLauncher && team.tokenName && !team.launchTxHash && <form className="partner-proof-form" onSubmit={(event) => { event.preventDefault(); void partnerLabAction("submit_launch", { teamId: team.id, tokenAddress: partnerProofDraft.tokenAddress, transactionHash: partnerProofDraft.transactionHash }); }}><div><b>Launcher proof</b><small>After the wallet confirms on Vibevibe, paste the token address and launch receipt.</small></div><label>Token address<input required value={partnerProofDraft.tokenAddress} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, tokenAddress: event.target.value }))} placeholder="0x… token address" /></label><label>Launch transaction<input required value={partnerProofDraft.transactionHash} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, transactionHash: event.target.value }))} placeholder="0x… transaction hash" /></label><button disabled={partnerLabBusy}>Save launch proof →</button></form>}
                    {team.tokenName && <div className="partner-token-brief"><span><small>CHARACTER PITCH</small><b>{team.tokenPitch}</b></span><span><small>INITIAL BUY</small><b>{team.initialBuyEth === "0" ? "None" : `${team.initialBuyEth} test ETH`}</b></span><span><small>AFTER BONDING</small><b>Permissionless graduation → Uniswap V4</b></span></div>}
                    {ownMember?.status === "accepted" && team.launchTxHash && <div className="partner-test-grid">{ownMember.role === "market_tester" && <form onSubmit={(event) => { event.preventDefault(); void partnerLabAction("submit_proof", { teamId: team.id, proofType: "buy", transactionHash: partnerProofDraft.transactionHash }); }}><b>Record your test buy</b><p>Buy once with a small testnet amount while the livestream community adds genuine volume.</p><input required value={partnerProofDraft.transactionHash} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, transactionHash: event.target.value }))} placeholder="0x… buy transaction" /><button disabled={partnerLabBusy}>Save buy proof</button></form>}<form onSubmit={(event) => { event.preventDefault(); void partnerLabAction("submit_proof", { teamId: team.id, proofType: "sell", transactionHash: partnerProofDraft.transactionHash }); }}><b>Test the sell path</b><p>One teammate records a small sell so the group tests both sides of the curve.</p><input required value={partnerProofDraft.transactionHash} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, transactionHash: event.target.value }))} placeholder="0x… sell transaction" /><button disabled={partnerLabBusy}>Save sell proof</button></form>{(isLauncher || partnerLabState.role === "owner") && !team.progress.graduated && <form onSubmit={(event) => { event.preventDefault(); void partnerLabAction("submit_graduation", { teamId: team.id, transactionHash: partnerProofDraft.transactionHash }); }}><b>Record graduation</b><p>100% bonded is not enough. Paste the separate permissionless graduation receipt.</p><input required value={partnerProofDraft.transactionHash} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, transactionHash: event.target.value }))} placeholder="0x… graduation transaction" /><button disabled={partnerLabBusy}>Save graduation</button></form>}</div>}
                    {team.launchTxHash && <div className="partner-bonding"><div><span><small>LIVE BONDING RACE</small><b>{(team.progress.curveProgressBps / 100).toFixed(1)}%</b></span><em>Target: 0.005 test ETH</em></div><progress max="10000" value={team.progress.curveProgressBps} /><p>Group buys + genuine testing-community volume move the curve. Avoid repetitive circular trades; the goal is useful product pressure, not artificial activity.</p>{partnerLabState.role === "owner" && <form onSubmit={(event) => { event.preventDefault(); void partnerLabAction("update_curve", { teamId: team.id, curveProgressPercent: partnerProofDraft.curveProgressPercent }); }}><input type="number" min="0" max="100" step="0.1" value={partnerProofDraft.curveProgressPercent} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, curveProgressPercent: event.target.value }))} /><button disabled={partnerLabBusy}>Update live %</button></form>}</div>}
                    {partnerLabState.role === "owner" && team.launchTxHash && !team.progress.feedbackSubmitted && <form className="partner-owner-feedback" onSubmit={(event) => { event.preventDefault(); void partnerLabAction("submit_feedback", { teamId: team.id, feedbackReference: partnerProofDraft.feedbackReference }); }}><div><b>Educator-only founder feedback</b><small>Collect student observations during the livestream, then submit the partner form yourself and save its link or confirmation here.</small></div><input required value={partnerProofDraft.feedbackReference} onChange={(event) => setPartnerProofDraft((current) => ({ ...current, feedbackReference: event.target.value }))} placeholder="Feedback form link or submission confirmation" /><button disabled={partnerLabBusy}>Mark feedback submitted →</button></form>}
                    <footer><div><span className={team.progress.launchProof ? "done" : ""}>Launch {team.progress.launchProof ? "✓" : "—"}</span><span className={team.progress.buyerProofs >= 4 ? "done" : ""}>Buyers {team.progress.buyerProofs}/4</span><span className={team.progress.sellProof ? "done" : ""}>Sell {team.progress.sellProof ? "✓" : "—"}</span><span className={team.progress.curveProgressBps >= 10000 ? "done" : ""}>Bonded {team.progress.curveProgressBps >= 10000 ? "✓" : `${(team.progress.curveProgressBps / 100).toFixed(0)}%`}</span><span className={team.progress.graduated ? "done" : ""}>Graduated {team.progress.graduated ? "✓" : "—"}</span><span className={team.progress.feedbackSubmitted ? "done" : ""}>Educator feedback {team.progress.feedbackSubmitted ? "✓" : "—"}</span></div><div>{team.tokenAddress && <a href={`https://explorer.testnet.chain.robinhood.com/address/${team.tokenAddress}`} target="_blank" rel="noreferrer">View token ↗</a>}{partnerLabState.role === "owner" && team.progress.readyForReview && team.status !== "verified" && <button disabled={partnerLabBusy} onClick={() => void partnerLabAction("verify_team", { teamId: team.id })}>Verify reward proof →</button>}</div></footer>
                  </article>;
                })}
                <footer className="partner-disclaimer"><b>TESTNET SAFETY</b><span>Third-party product · test assets have no monetary value · wallet approval stays with the student · only the educator submits the founder feedback form.</span><em>{partnerLabState?.campaign.mechanicsStatus ?? "Complete the curve, then graduate the token."}</em></footer>
              </section>
              {campaignState && campaignState.role !== "owner" && <section className="creator-earnings card"><div><span className="eyebrow">YOUR CREATOR EARNINGS</span><h3>{campaignState.payouts.length} paid campaign{campaignState.payouts.length === 1 ? "" : "s"}</h3><p>Only payments recorded by the educator appear here. Campus OS does not move money automatically.</p></div><div><span><small>AWAITING PAYMENT</small><b>{campaignState.campaigns.filter((campaign) => campaign.ownSubmission?.status === "approved_for_payment").length}</b></span><span><small>PAID</small><b>{campaignState.payouts.length}</b></span><span><small>LATEST</small><b>{campaignState.payouts[0] ? `${campaignState.payouts[0].currency} ${campaignState.payouts[0].amount}` : "—"}</b></span></div></section>}
              <div className="campaign-toolbar"><div><button className="active">All missions</button><button>Creator</button><button>Faceless</button><button>Clipper</button><button>User acquisition</button></div><label>⌕<input placeholder="Search campaigns or brands…" aria-label="Search campaigns" /></label></div>
              <div className="campaign-grid">
                {campaignState?.campaigns.length ? campaignState.campaigns.map((campaign) => <article className={`campaign-card ${campaign.campaignType === "creator" ? "coral" : campaign.campaignType === "user_acquisition" ? "green" : "blue"}`} key={campaign.id}>
                  <div className="campaign-brand"><span>{campaign.brand.slice(0, 2).toUpperCase()}</span><div><small>{campaign.campaignType.replaceAll("_", " ")} · {campaign.platform}</small><b>{campaign.brand}</b></div><em>{campaign.status.toUpperCase()}</em></div>
                  <h3>{campaign.title}</h3><p>{campaign.brief}</p>
                  <div className="campaign-tags"><span>{campaign.campaignType.replaceAll("_", " ")}</span><span>{Math.max(0, campaign.spots - campaign.joinedCount)} spots left</span></div>
                  <div className="campaign-reward"><span><small>REWARD</small><strong>{campaign.rewardCurrency === "INR" ? "₹" : `${campaign.rewardCurrency} `}{campaign.rewardAmount}</strong></span><button disabled={campaignBusy === campaign.id || Boolean(campaign.ownSubmission)} onClick={() => campaign.joined ? setCampaignSubmitId(campaign.id) : campaignAction("join", { campaignId: campaign.id })}>{campaign.ownSubmission ? campaign.ownSubmission.status.replaceAll("_", " ") : campaign.joined ? "Submit work →" : "Join campaign →"}</button></div>
                  {campaignSubmitId === campaign.id && !campaign.ownSubmission && <form className="campaign-submit" onSubmit={(event) => { event.preventDefault(); void campaignAction("submit", { campaignId: campaign.id, contentUrl: campaignContentUrl }); }}><label>Public link to your post or work<input type="url" value={campaignContentUrl} onChange={(event) => setCampaignContentUrl(event.target.value)} placeholder="https://instagram.com/reel/..." required /></label><button disabled={campaignBusy === campaign.id}>Send for review</button></form>}
                  {campaign.ownSubmission?.reviewNotes && <div className="campaign-feedback"><b>Reviewer note</b>{campaign.ownSubmission.reviewNotes}</div>}
                </article>) : campaigns.map((campaign) => <article className={`campaign-card ${campaign.tone}`} key={campaign.id}><div className="campaign-brand"><span>{campaign.brand.slice(0, 2).toUpperCase()}</span><div><small>{campaign.category} · {campaign.platform}</small><b>{campaign.brand}</b></div><em>PREVIEW</em></div><h3>{campaign.title}</h3><p>{campaign.brief}</p><div className="campaign-tags"><span>{campaign.type}</span><span>Publish from Educator View</span></div><div className="campaign-reward"><span><small>EXAMPLE REWARD</small><strong>{campaign.reward}</strong></span><button disabled>Preview brief</button></div></article>)}
              </div>
              <section className="campaign-mask card"><MaskOrb compact /><div><span className="eyebrow">MASK CAMPAIGN ASSIST</span><h3>Never face a confusing brief alone.</h3><p>Mask can explain the rules, suggest a hook, build a shot list and check your submission before it reaches the reviewer.</p></div><button onClick={() => setActive("mask")}>Plan with Mask →</button></section>
            </div>
          )}

          {active === "launchpad" && (
            <div className="page-stack">
              <section className="launch-hero"><div><span className="eyebrow">STUDENT LAUNCHPAD · ETHEREUM + SOLANA</span><h2>Practise safely.<br />Launch when ready.</h2><p>Original student work begins on testnet. Mainnet publishing unlocks only after a successful practice launch and educator review.</p></div><img src="/faceless-cast.png" alt="Faceless character cast" /></section>
              {launchDraft && launchMode === "testnet" && <section className="mask-launch-studio card">
                <div className="launch-studio-head"><div><span className="eyebrow">PREPARED WITH MASK</span><h3>Review your {launchDraft.assetType === "nft_collection" ? "NFT collection" : "token"}</h3><p>Mask filled this from your conversation. You can change anything before the wallet review.</p></div><span className="launch-network">{launchDraft.chain === "ethereum" ? "Ξ SEPOLIA" : "S SOLANA DEVNET"}</span></div>
                {launchDraft.assetType === "nft_collection" && artPreview && <div className="launch-artwork-preview"><img src={artPreview} alt="Collection artwork uploaded through Mask" /><div><span className="eyebrow">COLLECTION ARTWORK</span><b>{launchArtwork?.name ?? "Uploaded artwork"}</b><p>Carried securely from your Mask conversation. Permanent storage is added before the real mint transaction is prepared.</p></div><button onClick={() => setActive("mask")}>Change in Mask →</button></div>}
                <form className="launch-review-form" onSubmit={prepareLaunchApproval}>
                  <div className="form-row"><label>Name<input required value={launchDraft.name} onChange={(event) => updateLaunchDraft("name", event.target.value)} /></label><label>Symbol<input required value={launchDraft.symbol} maxLength={10} onChange={(event) => updateLaunchDraft("symbol", event.target.value.toUpperCase())} /></label></div>
                  <label>Description<textarea required value={launchDraft.description} onChange={(event) => updateLaunchDraft("description", event.target.value)} /></label>
                  <div className="form-row"><label>Total supply<input required type="number" min="1" value={launchDraft.supply} onChange={(event) => updateLaunchDraft("supply", Number(event.target.value))} /></label>{launchDraft.assetType === "nft_collection" ? <label>Mint price ({launchDraft.chain === "ethereum" ? "ETH" : "SOL"})<input required value={launchDraft.mintPrice ?? "0"} onChange={(event) => updateLaunchDraft("mintPrice", event.target.value)} /></label> : <label>Decimals<input required type="number" min="0" max={launchDraft.chain === "ethereum" ? 18 : 9} value={launchDraft.decimals ?? 9} onChange={(event) => updateLaunchDraft("decimals", Number(event.target.value))} /></label>}</div>
                  <div className="launch-facts"><span><small>CREATOR WALLET</small><b>{launchDraft.chain === "ethereum" ? ethWallet : solWallet}</b></span><span><small>NETWORK</small><b>Testnet · no real value</b></span><span><small>{launchDraft.assetType === "nft_collection" ? "ROYALTY" : "MINT AUTHORITY"}</small><b>{launchDraft.assetType === "nft_collection" ? `${launchDraft.royaltyPercent ?? 0}%` : launchDraft.authorityMode === "revoke" ? "Revoke after mint" : "Keep for learning"}</b></span></div>
                  <button className="primary full" type="submit">Prepare wallet review →</button>
                </form>
                {launchReviewReady && <div className="wallet-approval-panel">
                  <div><span>{launchDeployment ? "✓" : "1"}</span><section><b>{launchDeployment ? launchDraft.assetType === "token" ? "Token deployed" : launchDeployment.chain === "ethereum" ? "Collection contract deployed" : "Core collection created" : `Step 1 · Deploy the ${launchDraft.assetType === "token" ? "token" : "collection"}`}</b><p>{launchDeployment ? launchDraft.assetType === "token" ? `${launchDraft.supply.toLocaleString()} ${launchDraft.symbol} is in your Campus wallet on ${launchDeployment.chain === "ethereum" ? "Sepolia" : "Solana Devnet"}.` : launchDeployment.chain === "ethereum" ? `ERC-1155 edition contract ${shortenAddress(launchDeployment.contractAddress)} is live on Sepolia.` : `Metaplex Core collection ${shortenAddress(launchDeployment.contractAddress)} is live on Solana Devnet.` : launchDraft.assetType === "token" ? `Your wallet will approve the token creation and receive the full starting supply. ${launchDraft.authorityMode === "revoke" ? "Mint authority will be removed for a fixed supply." : "Mint authority stays with your wallet for learning."}` : launchDraft.chain === "ethereum" ? "Your wallet will show the exact Sepolia contract deployment and estimated test gas before anything is sent." : "Your wallet will show the Metaplex Core collection transaction and Devnet fee before anything is sent."}</p></section></div>
                  {!launchDeployment && <button disabled={["uploading", "awaiting_signature", "confirming"].includes(launchTransactionStatus)} onClick={deployLaunchCollection}>{launchTransactionStatus === "uploading" ? launchDraft.assetType === "token" ? "Preparing token…" : "Securing artwork…" : launchTransactionStatus === "awaiting_signature" ? "Check your wallet…" : launchTransactionStatus === "confirming" ? `Waiting for ${launchDraft.chain === "ethereum" ? "Sepolia" : "Solana Devnet"}…` : launchDraft.chain === "ethereum" ? "Approve Sepolia deployment →" : launchDraft.assetType === "token" ? "Approve Solana token →" : "Approve Solana collection →"}</button>}
                  {launchDeployment && <div className="launch-receipt-links"><a href={launchDeployment.chain === "ethereum" ? `https://sepolia.etherscan.io/address/${launchDeployment.contractAddress}` : launchDraft.assetType === "token" ? `https://explorer.solana.com/address/${launchDeployment.contractAddress}?cluster=devnet` : `https://core.metaplex.com/explorer/${launchDeployment.contractAddress}?env=devnet`} target="_blank" rel="noreferrer">View {launchDraft.assetType === "token" ? "token" : launchDeployment.chain === "ethereum" ? "contract" : "collection"} ↗</a><a href={launchDeployment.chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${launchDeployment.deployHash}` : `https://explorer.solana.com/tx/${launchDeployment.deployHash}?cluster=devnet`} target="_blank" rel="noreferrer">Deployment receipt ↗</a>{launchDeployment.metadataUrl && <a href={launchDeployment.metadataUrl} target="_blank" rel="noreferrer">NFT metadata ↗</a>}</div>}
                  {launchDeployment && launchDraft.assetType === "nft_collection" && <div className="launch-mint-step"><div><span>{launchTransactionStatus === "minted" ? "✓" : "2"}</span><section><b>Step 2 · Mint the first NFT</b><p>{launchTransactionStatus === "minted" ? `1 of ${launchDraft.supply} editions is now minted to your Campus wallet.` : `${launchDeployment.chain === "ethereum" ? "The contract" : "The collection"} exists, but no NFT has been minted yet. Mint edition #1 of ${launchDraft.supply}.`}</p></section></div>{launchTransactionStatus !== "minted" && <button disabled={launchTransactionStatus === "minting"} onClick={mintFirstLaunchEdition}>{launchTransactionStatus === "minting" ? "Confirming first mint…" : "Mint first edition →"}</button>}{launchDeployment.assetAddress && <a href={`https://core.metaplex.com/explorer/${launchDeployment.assetAddress}?env=devnet`} target="_blank" rel="noreferrer">View NFT ↗</a>}{launchDeployment.mintHash && <a href={launchDeployment.chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${launchDeployment.mintHash}` : `https://explorer.solana.com/tx/${launchDeployment.mintHash}?cluster=devnet`} target="_blank" rel="noreferrer">View mint receipt ↗</a>}</div>}
                  {launchDeployment && launchDraft.assetType === "token" && <button onClick={() => { setMarketArea("tokens"); setActive("market"); void loadMarket(); }}>Open token market →</button>}
                  {launchTransactionError && <p className="launch-transaction-error">{launchTransactionError} {!/wallet|session/i.test(launchTransactionError) && <>Check that the Campus wallet has enough {launchDraft.chain === "ethereum" ? "Sepolia ETH" : "Devnet SOL"} for the network fee, then try again.</>}</p>}
                  <small>Your wallet—not Mask—always gives the final approval. Testnet assets have no monetary value.</small>
                </div>}
              </section>}
              <div className="launch-mode-switch" role="group" aria-label="Launch network"><button className={launchMode === "testnet" ? "active" : ""} onClick={() => setLaunchMode("testnet")}><b>Testnet studio</b><small>Free practice · classroom wallets</small></button><button className={launchMode === "mainnet" ? "active" : ""} onClick={() => setLaunchMode("mainnet")}><b>Mainnet launch</b><small>Real fees · educator-gated</small></button></div>
              {launchMode === "mainnet" && <section className="mainnet-gate card"><div><span className="gate-mark">✓</span><div><span className="eyebrow">SUPERVISED MAINNET PATH</span><h3>Prove the launch before paying real fees.</h3><p>Complete wallet safety, publish the collection on testnet, verify ownership and request an educator review. A final wallet confirmation is always required.</p></div></div><ol><li><span>1</span>Safety lesson</li><li><span>2</span>Test launch</li><li><span>3</span>Ownership check</li><li><span>4</span>Educator review</li></ol><button onClick={() => notify("Mainnet review request added to the educator queue")}>Request mainnet review →</button><small>No custodial mainnet wallet is created automatically. Students connect an external wallet and approve real fees themselves.</small></section>}
              <section className="launch-to-market card"><div><span className="eyebrow">AFTER THE LAUNCH</span><h3>Every deployed collection enters the Campus Market.</h3><p>Students can discover the work, inspect its on-chain proof and collect available Sepolia editions with their own wallet.</p></div><button onClick={() => setActive("market")}>Open Campus Market →</button></section>
            </div>
          )}

          {active === "market" && (
            <div className="page-stack market-page">
              <section className="market-hero"><div><span className="eyebrow">CAMPUS MARKET · TESTNET + PRACTICE</span><h2>Learn the asset.<br />Trade the idea.</h2><p>Explore student NFTs and tokens, then learn how tokenised real-world assets work through a clearly fictional practice market.</p></div><div className="market-hero-stats"><span><b>{marketCollections.length}</b><small>COLLECTIONS</small></span><span><b>{marketCollections.reduce((total, item) => total + item.minted, 0)}</b><small>NFTS MINTED</small></span><span><b>3</b><small>MARKET LABS</small></span></div></section>
              <nav className="market-area-tabs" aria-label="Campus Market sections">
                <button className={marketArea === "nfts" ? "active" : ""} onClick={() => setMarketArea("nfts")}><span>01</span><b>NFTs</b><small>Art & collections</small></button>
                <button className={marketArea === "tokens" ? "active" : ""} onClick={() => { setMarketArea("tokens"); setSelectedMarketId(null); }}><span>02</span><b>Tokens</b><small>Launch & exchange</small></button>
                <button className={marketArea === "rwas" ? "active" : ""} onClick={() => { setMarketArea("rwas"); setSelectedMarketId(null); }}><span>03</span><b>RWAs</b><small>Tokenised assets</small></button>
              </nav>
              {marketArea === "nfts" && <>
              <div className="market-dashboard-toolbar">
                <div role="group" aria-label="Filter collections by network"><button className={marketFilter === "all" ? "active" : ""} onClick={() => setMarketFilter("all")}>All</button><button className={marketFilter === "ethereum" ? "active" : ""} onClick={() => setMarketFilter("ethereum")}>Ethereum</button><button className={marketFilter === "solana" ? "active" : ""} onClick={() => setMarketFilter("solana")}>Solana</button></div>
                <label>⌕<input value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} placeholder="Search art, symbol or creator…" aria-label="Search Campus Market" /></label>
                <button className="market-refresh" disabled={marketLoading} onClick={() => void loadMarket()}>{marketLoading ? "Refreshing…" : "Refresh ↻"}</button>
              </div>
              {marketError && <div className="market-message error">{marketError}</div>}
              {selectedMarket && <section className="market-detail card"><img src={selectedMarket.image} alt={selectedMarket.name} /><div className="market-detail-copy"><div><span className={`market-chain ${selectedMarket.chain}`}>{selectedMarket.chain === "ethereum" ? "ETHEREUM · SEPOLIA" : "SOLANA · DEVNET"}</span><button onClick={() => setSelectedMarketId(null)} aria-label="Close collection details">×</button></div><h2>{selectedMarket.name}</h2><p>{selectedMarket.description}</p><div className="market-creator"><span className="profile-dot">{selectedMarket.creator.displayName.slice(0, 2).toUpperCase()}</span><span><small>CREATED BY</small><b>@{selectedMarket.creator.username}</b></span></div><div className="market-detail-facts"><span><small>PRICE</small><b>{Number(selectedMarket.mintPrice) === 0 ? "FREE" : `${selectedMarket.mintPrice} ${selectedMarket.chain === "ethereum" ? "ETH" : "SOL"}`}</b></span><span><small>MINTED</small><b>{selectedMarket.minted} / {selectedMarket.maxSupply}</b></span><span><small>ROYALTY</small><b>{selectedMarket.royaltyPercent}%</b></span></div><div className="market-detail-actions">{selectedMarket.primarySaleReady ? <button disabled={marketBuyingId === selectedMarket.id || selectedMarket.minted >= selectedMarket.maxSupply} onClick={() => void buyMarketCollection(selectedMarket)}>{selectedMarket.minted >= selectedMarket.maxSupply ? "Sold out" : marketBuyingId === selectedMarket.id ? "Check your wallet…" : Number(selectedMarket.mintPrice) === 0 ? "Mint free edition →" : `Collect for ${selectedMarket.mintPrice} ${selectedMarket.chain === "ethereum" ? "ETH" : "SOL"} →`}</button> : selectedMarket.chain === "solana" && solanaWallet?.address === selectedMarket.creatorAddress ? <button disabled={marketBuyingId === selectedMarket.id || selectedMarket.minted >= selectedMarket.maxSupply} onClick={() => void preparePublicSolanaMint(selectedMarket)}>{marketBuyingId === selectedMarket.id ? "Check your wallet…" : "Open public Solana mint →"}</button> : <button onClick={() => notify("The creator still needs to open this collection’s public Solana mint.")}>Waiting for creator</button>}<a href={selectedMarket.chain === "ethereum" ? `https://sepolia.etherscan.io/address/${selectedMarket.contractAddress}` : `https://core.metaplex.com/explorer/${selectedMarket.contractAddress}?env=devnet`} target="_blank" rel="noreferrer">View onchain ↗</a></div>{marketPurchaseHash && <a className="market-purchase-receipt" href={selectedMarket.chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${marketPurchaseHash}` : `https://explorer.solana.com/tx/${marketPurchaseHash}?cluster=devnet`} target="_blank" rel="noreferrer">Transaction confirmed · view receipt ↗</a>}<small className="testnet-note">Testnet only · assets have no monetary value · your wallet approves every transaction.</small></div></section>}
              {marketLoading && marketCollections.length === 0 ? <div className="market-message">Loading student collections…</div> : visibleMarketCollections.length ? <div className="market-grid live-market-grid">{visibleMarketCollections.map((collection) => <article className="market-card" key={collection.id}><button className="market-card-open" onClick={() => { setSelectedMarketId(collection.id); setMarketPurchaseHash(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`View ${collection.name}`}><div className="market-image"><img src={collection.image} alt={collection.name} /><span>{collection.chain === "ethereum" ? "SEP" : "SOL"} · {collection.standard}</span></div><div className="market-meta"><div><h3>{collection.name}</h3><p>by @{collection.creator.username}</p></div><span><small>{collection.minted} / {collection.maxSupply} MINTED</small><b>{Number(collection.mintPrice) === 0 ? "FREE" : `${collection.mintPrice} ${collection.chain === "ethereum" ? "ETH" : "SOL"}`}</b></span></div><div className="market-card-action">View collection →</div></button></article>)}</div> : <div className="market-message"><b>No collections match this view.</b><span>Try another network or search.</span></div>}
              <section className="market-secondary card"><div><span className="eyebrow">NEXT MARKET LAYER</span><h3>List, buy and resell safely.</h3><p>Secondary sales need an atomic marketplace contract so payment and ownership move together. We’ll add this after the public discovery and primary mint flow is proven.</p></div><button onClick={() => setActive("wallet")}>View my assets →</button></section>
              </>}
              {marketArea === "tokens" && <div className="token-market-stack">
                <section className="token-market-intro card"><div><span className="eyebrow">LIVE TOKEN LAB · SEPOLIA + SOLANA DEVNET</span><h2>Launch a token.<br />Move its economy.</h2><p>Every token here was wallet-approved by a Campus student. Holders can exchange whole test tokens directly by username and inspect the on-chain receipt.</p></div><button onClick={() => setActive("mask")}>Launch with Mask →</button></section>
                {selectedToken && <section className="token-exchange card">
                  <div className="token-exchange-identity"><span className={`token-symbol-orb ${selectedToken.chain}`}>{selectedToken.symbol.slice(0, 3)}</span><div><small>{selectedToken.standard.toUpperCase()} · {selectedToken.chain === "ethereum" ? "SEPOLIA" : "SOLANA DEVNET"}</small><h3>{selectedToken.name}</h3><p>{selectedToken.description}</p></div><button onClick={() => { setSelectedTokenId(null); setTokenError(""); setAirdropError(""); }} aria-label="Close token exchange">×</button></div>
                  <div className="token-exchange-facts"><span><small>YOUR BALANCE</small><b>{Number(selectedToken.owned).toLocaleString()} {selectedToken.symbol}</b></span><span><small>TOTAL SUPPLY</small><b>{Number(selectedToken.totalSupply).toLocaleString()}</b></span><span><small>HOLDERS</small><b>{selectedToken.holders}</b></span><span><small>AUTHORITY</small><b>{selectedToken.authorityMode === "revoke" ? "Fixed" : "Creator kept"}</b></span></div>
                  <div className="token-action-tabs"><button className={tokenDetailTab === "exchange" ? "active" : ""} onClick={() => setTokenDetailTab("exchange")}>Send tokens</button><button className={tokenDetailTab === "airdrop" ? "active" : ""} onClick={() => setTokenDetailTab("airdrop")}>Classroom airdrop {selectedAirdrop?.status === "open" ? "· LIVE" : ""}</button></div>
                  {tokenDetailTab === "exchange" ? <>
                    {BigInt(selectedToken.owned) > 0n ? <form className="token-send-form" onSubmit={sendCampusToken}><label>Send to Campus username<div><span>@</span><input value={tokenRecipient} onChange={(event) => { setTokenRecipient(event.target.value); setTokenError(""); }} placeholder="classmate" /></div></label><label>Whole tokens<input inputMode="numeric" value={tokenAmount} onChange={(event) => { setTokenAmount(event.target.value.replace(/\D/g, "")); setTokenError(""); }} placeholder="100" /></label><button disabled={tokenBusy || !tokenRecipient || !tokenAmount}>{tokenBusy ? "Waiting for wallet…" : `Send ${selectedToken.symbol} →`}</button></form> : <div className="token-no-balance">Ask @{selectedToken.creator.username} or another holder to send you some {selectedToken.symbol} by Campus username.</div>}
                    {tokenError && <div className="market-message error">{tokenError}</div>}
                  </> : <div className="token-airdrop-panel">
                    {!selectedAirdrop && selectedToken.creator.username === campusUsername && <form onSubmit={createTokenAirdrop}><div><small>ONE CLAIM PER VERIFIED STUDENT</small><h4>Open a cohort-wide airdrop</h4><p>Choose how many whole {selectedToken.symbol} each active student can claim. Campus calculates the cohort total before your wallet approves anything.</p></div><label>Tokens per student<input inputMode="numeric" value={airdropAmount} onChange={(event) => { setAirdropAmount(event.target.value.replace(/\D/g, "")); setAirdropError(""); }} placeholder="100" /></label><button disabled={airdropBusy || !airdropAmount}>{airdropBusy ? "Preparing…" : "Prepare airdrop →"}</button></form>}
                    {!selectedAirdrop && selectedToken.creator.username !== campusUsername && <div className="token-no-balance">@{selectedToken.creator.username} has not opened a classroom airdrop for this token yet.</div>}
                    {selectedAirdrop && <div className="airdrop-campaign"><div className="airdrop-campaign-head"><div><small>{selectedAirdrop.status === "draft" ? "READY TO FUND" : selectedAirdrop.status === "open" ? "CLAIMS OPEN" : "AIRDROP COMPLETE"}</small><h4>{selectedAirdrop.amountPerClaim} {selectedToken.symbol} per student</h4><p>Verified Campus accounts claim once. Shared college Wi-Fi does not decide eligibility.</p></div><b>{selectedAirdrop.claimedCount}/{selectedAirdrop.maxClaims}<small> claimed</small></b></div><div className="airdrop-progress"><i style={{ width: `${Math.round((selectedAirdrop.claimedCount / Math.max(selectedAirdrop.maxClaims, 1)) * 100)}%` }} /></div>
                      {selectedAirdrop.isCreator && selectedAirdrop.status === "draft" && <div className="airdrop-fund"><span><small>TOTAL VAULT FUNDING</small><b>{Number(selectedAirdrop.totalAllocation).toLocaleString()} {selectedToken.symbol}</b><em>One wallet approval opens {selectedAirdrop.maxClaims} student claims.</em></span><button onClick={fundTokenAirdrop} disabled={airdropBusy}>{airdropBusy ? "Waiting for wallet…" : "Fund vault & open claims →"}</button></div>}
                      {!selectedAirdrop.isCreator && selectedAirdrop.status === "open" && !selectedAirdrop.ownClaim && <button className="airdrop-claim" onClick={claimTokenAirdrop} disabled={airdropBusy}>{airdropBusy ? (transactionQueue ? `Campus queue · ${transactionQueue.seconds}s` : "Sending to your wallet…") : `Claim ${selectedAirdrop.amountPerClaim} ${selectedToken.symbol} →`}</button>}
                      {!selectedAirdrop.isCreator && selectedAirdrop.status === "open" && selectedAirdrop.ownClaim?.status === "failed" && <div className="airdrop-retry"><span>{selectedAirdrop.ownClaim.errorMessage || "The network did not complete your claim."}</span><button onClick={claimTokenAirdrop} disabled={airdropBusy}>{airdropBusy ? "Retrying…" : "Retry claim →"}</button></div>}
                      {!selectedAirdrop.isCreator && selectedAirdrop.ownClaim?.status === "sent" && <div className="airdrop-claimed"><b>Claimed ✓</b><span>{selectedAirdrop.amountPerClaim} {selectedToken.symbol} is in your Campus wallet.</span><a href={selectedToken.chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${selectedAirdrop.ownClaim.transactionHash}` : `https://explorer.solana.com/tx/${selectedAirdrop.ownClaim.transactionHash}?cluster=devnet`} target="_blank" rel="noreferrer">View receipt ↗</a></div>}
                      {selectedAirdrop.isCreator && selectedAirdrop.status !== "draft" && <div className="airdrop-creator-stats"><span><small>CLAIMED</small><b>{selectedAirdrop.claimedCount}</b></span><span><small>PENDING</small><b>{selectedAirdrop.pendingCount}</b></span><span><small>REMAINING</small><b>{Math.max(selectedAirdrop.maxClaims - selectedAirdrop.claimedCount, 0)}</b></span></div>}
                    </div>}
                    {airdropError && <div className="market-message error">{airdropError}</div>}
                  </div>}
                  <div className="token-proof"><span>Created by @{selectedToken.creator.username}</span><a href={selectedToken.chain === "ethereum" ? `https://sepolia.etherscan.io/token/${selectedToken.tokenAddress}` : `https://explorer.solana.com/address/${selectedToken.tokenAddress}?cluster=devnet`} target="_blank" rel="noreferrer">View token onchain ↗</a></div>
                </section>}
                {campusTokens.length ? <div className="token-live-grid">{campusTokens.map((token) => <article className="token-live-card card" key={token.id}><button onClick={() => { setSelectedTokenId(token.id); setTokenRecipient(""); setTokenAmount(""); setTokenError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className={`token-symbol-orb ${token.chain}`}>{token.symbol.slice(0, 3)}</span><div><small>{token.chain === "ethereum" ? "ETHEREUM · SEPOLIA" : "SOLANA · DEVNET"}</small><h3>{token.name}</h3><b>{token.symbol}</b><p>{token.purpose}</p></div><div className="token-live-stats"><span><small>SUPPLY</small><b>{Number(token.totalSupply).toLocaleString()}</b></span><span><small>YOU OWN</small><b>{Number(token.owned).toLocaleString()}</b></span><span><small>MOVES</small><b>{token.transferCount}</b></span></div><em>{BigInt(token.owned) > 0n ? "Send or inspect →" : "Inspect token →"}</em></button></article>)}</div> : <div className="market-message"><b>No student tokens are live yet.</b><span>Ask Mask to prepare the first Sepolia or Solana Devnet token.</span></div>}
                <div className="token-flow-grid">
                  {[{ n: "01", title: "Design", copy: "Choose purpose, supply, decimals and mint authority." }, { n: "02", title: "Deploy", copy: "Approve the real testnet creation in your Campus wallet." }, { n: "03", title: "Distribute", copy: "Send test tokens by username with an on-chain receipt." }, { n: "04", title: "Add liquidity", copy: "The next lab will create a pool and explain pricing and slippage." }].map((item) => <article className="card" key={item.n}><span>{item.n}</span><h3>{item.title}</h3><p>{item.copy}</p></article>)}
                </div>
                <section className="token-safety card"><div><span>PEER EXCHANGE IS LIVE</span><b>Liquidity pools come next.</b></div><p>Sending a token and trading through a pool are different actions. This version teaches ownership and distribution first; no real-money trading is enabled.</p></section>
              </div>}
              {marketArea === "rwas" && <div className="rwa-market-stack">
                <section className="rwa-intro card"><div><span className="eyebrow">RWA PRACTICE MARKET · FICTIONAL ASSETS</span><h2>Turn a thing into units.<br />Learn what ownership means.</h2><p>Trade imaginary tokenised assets with practice credits, see how fractional ownership changes a portfolio and question what the token legally represents.</p><div className="rwa-warning">SIMULATION ONLY · NO LEGAL OWNERSHIP · CREDITS ARE NOT REDEEMABLE</div></div><aside><small>PRACTICE BALANCE</small><strong>{(rwaState?.balanceCredits ?? 10000).toLocaleString()}</strong><span>Campus credits</span><i>Next simulated income cycle<br /><b>{rwaDistributionCountdown}</b></i></aside></section>
                <section className="rwa-learning-strip">
                  {["Choose the asset", "Define the rights", "Split into units", "Trade + inspect"].map((step, index) => <span key={step}><b>{String(index + 1).padStart(2, "0")}</b>{step}</span>)}
                </section>
                {rwaError && <div className="market-message error">{rwaError}</div>}
                <div className="rwa-grid">
                  {liveRwaAssets.map((asset, index) => {
                    const holding = rwaState?.holdings.find((item) => item.assetId === asset.id);
                    const owned = holding?.units ?? 0;
                    return <article className="rwa-card card" key={asset.id}><div className={`rwa-art ${index % 3 === 1 ? "green" : index % 3 === 2 ? "amber" : "violet"}`}><span>{asset.symbol}</span><b>{asset.category.toUpperCase()}</b><small>{asset.unitsHeld}/{asset.totalUnits} units held · {asset.holders} holders</small></div><div className="rwa-card-copy"><div className="rwa-card-head"><span><small>{asset.creator ? `BY @${asset.creator.username}` : "CAMPUS CASE STUDY"}</small><h3>{asset.name}</h3></span><em>FICTIONAL</em></div><p>{asset.description}</p><div className="rwa-facts"><span><small>UNIT PRICE</small><b>{asset.priceCredits} credits</b></span><span><small>YOUR UNITS</small><b>{owned}</b></span><span><small>NET MODELLED YIELD</small><b>{(asset.annualYieldBps / 100).toFixed(1)}% annual</b></span></div><div className="rwa-rights"><small>WHAT THE PRACTICE TOKEN REPRESENTS</small><p>{asset.rights}</p></div><div className="rwa-risk"><small>RISK TO QUESTION</small><p>{asset.risk}</p></div><details className="rwa-waterfall"><summary><span>MONTHLY CASH-FLOW WATERFALL</span><b>{asset.cashflow.netDistributableCredits} net →</b></summary><div><p><span>Gross {asset.incomeModel.toLowerCase()}</span><b>+{asset.cashflow.grossMonthlyCredits}</b></p><p><span>Vacancy / non-payment · {(asset.cashflow.vacancyBps / 100).toFixed(1)}%</span><b>−{asset.cashflow.vacancyCredits}</b></p><p><span>Operating expenses · {(asset.cashflow.operatingExpenseBps / 100).toFixed(1)}%</span><b>−{asset.cashflow.operatingExpenseCredits}</b></p><p><span>Reserve + manager costs · {(asset.cashflow.reserveBps / 100).toFixed(1)}%</span><b>−{asset.cashflow.reserveCredits}</b></p><p className="net"><span>Net distributable income</span><b>{asset.cashflow.netDistributableCredits} credits</b></p>{owned > 0 && <p className="share"><span>Your {owned}/{asset.totalUnits} token share</span><b>≈ {asset.monthlyEstimateCredits} credits</b></p>}</div></details>{owned > 0 && <div className="rwa-income"><span><small>ESTIMATED MONTHLY RETURN</small><b>{asset.monthlyEstimateCredits} credits</b><em>Next cycle in {rwaDistributionCountdown}</em></span><button className={rwaBusy === `${asset.id}:income` ? "busy" : ""} disabled={Boolean(rwaBusy) || asset.incomeClaimedThisPeriod || asset.monthlyEstimateCredits < 1} onClick={() => void claimRwaIncome(asset)}>{rwaBusy === `${asset.id}:income` ? "Adding…" : asset.incomeClaimedThisPeriod ? "This month paid ✓" : "Claim simulated rent →"}</button></div>}<div className="rwa-trade-actions"><button className={rwaBusy === `${asset.id}:buy` ? "busy" : asset.unitsHeld >= asset.totalUnits ? "unavailable" : ""} disabled={Boolean(rwaBusy) || asset.unitsHeld >= asset.totalUnits} onClick={() => void tradeRwa(asset.id, "buy")}>{rwaBusy === `${asset.id}:buy` ? "Buying…" : "Buy 1 unit"}</button><button className={rwaBusy === `${asset.id}:sell` ? "busy" : owned < 1 ? "unavailable" : ""} disabled={Boolean(rwaBusy) || owned < 1} onClick={() => void tradeRwa(asset.id, "sell")}>{rwaBusy === `${asset.id}:sell` ? "Selling…" : "Sell 1 unit"}</button></div></div></article>;
                  })}
                </div>
                <div className="rwa-lower-grid">
                  <section className="rwa-portfolio card"><span className="eyebrow">YOUR PRACTICE PORTFOLIO</span><h3>{rwaState?.holdings.reduce((total, holding) => total + holding.units, 0) ?? 0} tokenised units</h3>{rwaState?.holdings.filter((holding) => holding.units > 0).length ? rwaState.holdings.filter((holding) => holding.units > 0).map((holding) => { const asset = liveRwaAssets.find((item) => item.id === holding.assetId); return <div key={holding.assetId}><span>{asset?.name ?? holding.assetId}</span><b>{holding.units} × {asset?.priceCredits ?? 0} credits</b></div>; }) : <p>Buy a practice unit to see how fractional assets appear in a portfolio.</p>}</section>
                  <section className="rwa-activity card"><span className="eyebrow">RECENT PRACTICE TRADES</span>{rwaState?.trades.length ? rwaState.trades.slice(0, 5).map((trade) => <div key={trade.id}><span><b>{trade.side.toUpperCase()}</b>{liveRwaAssets.find((item) => item.id === trade.assetId)?.symbol ?? trade.assetId}</span><strong>{trade.totalCredits} credits</strong></div>) : <p>No trades yet. Every buy and sell will appear here.</p>}</section>
                </div>
                <section className="rwa-mainnet-model card"><div><span className="eyebrow">HOW THE REAL MAINNET VERSION WOULD WORK</span><h3>Tokens record entitlement. Verified cash flow funds returns.</h3><p>Campus credits stay educational and non-redeemable. A real product would need a legally enforceable asset structure, verified accounts and direct fiat or compliant digital-money payouts.</p></div><ol><li><b>01</b><span><strong>Rent arrives offchain</strong><small>Tenants pay the legal property owner or manager.</small></span></li><li><b>02</b><span><strong>Net income is verified</strong><small>Vacancy, tax, repairs, fees and reserves are deducted.</small></span></li><li><b>03</b><span><strong>Entitlements are calculated</strong><small>A holder snapshot and governing documents decide each investor’s share.</small></span></li><li><b>04</b><span><strong>Money is distributed</strong><small>Eligible holders receive fiat or a compliant settlement asset—not converted Campus credits.</small></span></li></ol><footer>Real deployment requires jurisdiction-specific securities, property, custody, KYC/AML and tax advice.</footer></section>
                <section className="rwa-create card"><div><span className="eyebrow">BUILD THE NEXT CASE STUDY</span><h3>Tokenise an imaginary cinema, farm or creator studio.</h3><p>Define the asset, token rights, supply, income story and risks. It becomes a shared Campus simulation—not a legal investment or real-world claim.</p></div><button onClick={() => { setRwaStudioOpen((open) => !open); setRwaError(""); }}>{rwaStudioOpen ? "Close studio ×" : "Open tokenisation studio →"}</button></section>
                {rwaStudioOpen && <form className="rwa-studio card" onSubmit={createRwaCaseStudy}><div className="rwa-studio-head"><span><small>STUDENT RWA LAB</small><h3>Build the asset before you build the token.</h3><p>A useful RWA model clearly separates the real thing, the digital units, the rights those units promise and the risks that still exist offchain.</p></span><b>SIMULATION</b></div><div className="rwa-studio-grid"><label>Asset name<input required value={rwaDraft.name} onChange={(event) => setRwaDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Campus Cinema A" /></label><label>Symbol<input required maxLength={8} value={rwaDraft.symbol} onChange={(event) => setRwaDraft((draft) => ({ ...draft, symbol: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} placeholder="CINEMA" /></label><label>Asset type<select value={rwaDraft.category} onChange={(event) => setRwaDraft((draft) => ({ ...draft, category: event.target.value }))}><option>Imaginary property</option><option>Imaginary energy asset</option><option>Imaginary business asset</option><option>Imaginary collectible</option><option>Imaginary revenue stream</option></select></label><label>Total units<input required inputMode="numeric" value={rwaDraft.totalUnits} onChange={(event) => setRwaDraft((draft) => ({ ...draft, totalUnits: event.target.value.replace(/\D/g, "") }))} /></label><label>Price per unit · credits<input required inputMode="numeric" value={rwaDraft.priceCredits} onChange={(event) => setRwaDraft((draft) => ({ ...draft, priceCredits: event.target.value.replace(/\D/g, "") }))} /></label><label>Gross monthly income · credits<input required inputMode="numeric" value={rwaDraft.grossMonthlyCredits} onChange={(event) => setRwaDraft((draft) => ({ ...draft, grossMonthlyCredits: event.target.value.replace(/\D/g, "") }))} /></label><label>Vacancy / non-payment %<input required inputMode="decimal" value={rwaDraft.vacancyPercent} onChange={(event) => setRwaDraft((draft) => ({ ...draft, vacancyPercent: event.target.value.replace(/[^\d.]/g, "") }))} /></label><label>Operating costs %<input required inputMode="decimal" value={rwaDraft.operatingExpensePercent} onChange={(event) => setRwaDraft((draft) => ({ ...draft, operatingExpensePercent: event.target.value.replace(/[^\d.]/g, "") }))} /></label><label>Reserve + manager costs %<input required inputMode="decimal" value={rwaDraft.reservePercent} onChange={(event) => setRwaDraft((draft) => ({ ...draft, reservePercent: event.target.value.replace(/[^\d.]/g, "") }))} /></label><label className="wide">Asset story<textarea required value={rwaDraft.description} onChange={(event) => setRwaDraft((draft) => ({ ...draft, description: event.target.value }))} placeholder="What is being tokenised, and why split it into smaller units?" /></label><label className="wide">What does one token represent?<textarea required value={rwaDraft.rights} onChange={(event) => setRwaDraft((draft) => ({ ...draft, rights: event.target.value }))} placeholder="Example: a simulated share of modelled booking revenue—not ownership of the building." /></label><label>Income model<input required value={rwaDraft.incomeModel} onChange={(event) => setRwaDraft((draft) => ({ ...draft, incomeModel: event.target.value }))} placeholder="Ticket or rental revenue" /></label><label>Key risk<input required value={rwaDraft.risk} onChange={(event) => setRwaDraft((draft) => ({ ...draft, risk: event.target.value }))} placeholder="Demand, maintenance, operator and legal risk" /></label></div><div className="rwa-studio-review"><span><b>Return is calculated—not typed in</b><small>Gross income minus vacancy, operating expenses and reserves determines the simulated yield.</small></span><button disabled={rwaBusy === "create"}>{rwaBusy === "create" ? "Publishing…" : "Publish to RWA market →"}</button></div></form>}
              </div>}
            </div>
          )}

          {active === "passport" && (
            <div className="page-stack">
              <section className="passport-hero">
                <div className="passport-identity"><span className="profile-dot large">{initials}</span><div><span className="eyebrow">FACELESS STUDENT PASSPORT</span><h2>{displayName}</h2><p>Creator · Builder · {cohortState?.membership?.title ?? "Campus member"}</p></div></div>
                <div className="passport-wallet"><small>MULTICHAIN CLASSROOM IDENTITY</small>{campusUsername && <strong>@{campusUsername}</strong>}<strong>{ethWallet}</strong><strong>{solWallet}</strong><span><i /> Sepolia + Solana Devnet ready</span></div>
              </section>
              <section className="passport-publish card">
                <div><span className="eyebrow">PUBLISH YOUR PROOF PASSPORT</span><h3>Turn Campus progress into a portfolio link.</h3><p>Share verified lessons, live attendance, onchain builds, partner credentials and approved creator work. Your Passport stays private until you publish it.</p><form onSubmit={(event) => { event.preventDefault(); void passportAction("save", { ...passportDraft, isPublic: passportState?.settings.isPublic ?? false }); }}><label>One-line introduction<input maxLength={100} value={passportDraft.headline} onChange={(event) => setPassportDraft((current) => ({ ...current, headline: event.target.value }))} /></label><label>Short bio · optional<textarea maxLength={400} value={passportDraft.bio} onChange={(event) => setPassportDraft((current) => ({ ...current, bio: event.target.value }))} placeholder="What are you learning, building or creating?" /></label><div className="passport-publish-actions"><button disabled={passportBusy}>Save profile</button>{passportState?.settings.isPublic ? <><button className="primary" type="button" onClick={copyPassportLink}>Copy public link</button><button type="button" onClick={() => window.open(passportState.settings.sharePath ?? "", "_blank")}>Open public view ↗</button><button type="button" onClick={() => void passportAction("rotate")}>Regenerate link</button><button className="danger" type="button" onClick={() => void passportAction("unpublish")}>Make private</button></> : <button className="primary" type="button" disabled={passportBusy} onClick={() => void passportAction("save", { ...passportDraft, isPublic: true })}>Publish Passport →</button>}</div>{passportError && <span className="passport-publish-error">{passportError}</span>}</form></div>
                <aside className="passport-share-status"><span className={passportState?.settings.isPublic ? "public" : ""}>{passportState?.settings.isPublic ? "● PUBLIC" : "● PRIVATE BY DEFAULT"}</span><strong>{passportState?.settings.isPublic ? "Ready to share with clubs, projects and collaborators." : "Only you can see this page right now."}</strong>{passportState?.settings.sharePath && <code>{passportState.settings.sharePath}</code>}<p>No email, private keys or payment details are included. Only public wallet addresses and earned Campus proofs appear.</p><small>Regenerating the link immediately invalidates the previous one.</small></aside>
              </section>
              {classroomProofs.length > 0 && <section className="classroom-proof-strip card"><div className="section-head"><span><b>VERIFIED CLASSROOM PROOFS</b><small>Permanent records earned through live Campus quests</small></span><em>{classroomProofs.length}</em></div><div>{classroomProofs.slice(0, 4).map((proof) => <article key={proof.id}><span>✓</span><div><small>{new Date(proof.completedAt).toLocaleDateString()}</small><b>{proof.title}</b><p>{proof.proofLabel}</p></div></article>)}</div></section>}
              {Boolean(dropState?.credentials.length) && <section className="partner-credential-strip card"><div className="section-head"><span><b>PARTNER CREDENTIALS</b><small>Guest sessions, ecosystem activations and completed challenges</small></span></div><div>{dropState?.credentials.slice(0, 4).map((credential) => <article key={credential.id}><MaskOrb compact /><span><small>{new Date(credential.claimedAt).toLocaleDateString()} · {credential.drop?.host}</small><b>{credential.drop?.title}</b><p>{credential.evidence}</p></span></article>)}</div></section>}
              <div className="passport-metrics"><article><strong>{(passportState?.metrics.classroomProofs ?? classroomProofs.length).toString().padStart(2, "0")}</strong><span>Verified quests</span></article><article><strong>{(passportState?.metrics.lessonsCompleted ?? completed).toString().padStart(2, "0")}</strong><span>Lessons completed</span></article><article><strong>{(passportState?.metrics.approvedCampaigns ?? 0).toString().padStart(2, "0")}</strong><span>Approved campaigns</span></article><article><strong>{(passportState?.metrics.credentials ?? dropState?.credentials.length ?? 0).toString().padStart(2, "0")}</strong><span>Partner proofs</span></article></div>
              <div className="passport-layout">
                <section className="card passport-timeline"><div className="section-head"><span><b>PROOF OF PROGRESS</b><small>Learning, building and creating in one record</small></span></div>{[
                  ["Ethereum foundations", "Completed the introductory lesson and knowledge check", "LEARN"],
                  ["Multichain classroom wallets", "Created Ethereum and Solana identities for supervised practice", "BUILD"],
                  ["Ethereum Lab Pass", "Minted a testnet participation credential", "ONCHAIN"],
                  ["Campus creator profile", "Ready for creator, clipping and acquisition missions", "CREATE"],
                ].map((entry) => <div className="passport-event" key={entry[0]}><span>{entry[2].slice(0, 1)}</span><div><small>{entry[2]}</small><b>{entry[0]}</b><p>{entry[1]}</p></div><em>VERIFIED</em></div>)}</section>
                <aside className="passport-side"><section className="card"><span className="eyebrow">SKILL BADGES</span><div className="badge-cloud"><span>Bitcoin basics</span><span>Ethereum basics</span><span>Solana starter</span><span>Wallet safety</span><span>Content starter</span><span>Testnet explorer</span></div></section><section className="card passport-next"><span className="eyebrow">NEXT MILESTONE</span><h3>Publish your first proof of work.</h3><p>Complete one campaign, deploy one demo or launch original artwork.</p><button onClick={() => setActive("campaigns")}>Find a campaign →</button></section><button className="wallet-link" onClick={() => setActive("wallet")}>Open both wallets <span>→</span></button></aside>
              </div>
            </div>
          )}

          {active === "drops" && (
            <div className="page-stack">
              <section className="page-intro"><div><span className="eyebrow">GUESTS × STUDENTS × VERIFIED PROOF</span><h2>Partner drops</h2><p>Earn a credential after a guest session, lesson, live quest or approved creator campaign. Selected drops can later be connected to testnet collectibles and token airdrops.</p></div></section>
              <div className="drop-grid">{dropState?.drops.length ? dropState.drops.map((drop, index) => <article className={`drop-card ${["violet", "green", "amber"][index % 3]}`} key={drop.id}><div className="drop-art"><span className="drop-glow" /><MaskOrb compact /><b>{(index + 1).toString().padStart(2, "0")}</b></div><div><span className="eyebrow">{drop.eligibility.replaceAll("_", " ")} · VERIFIED</span><h3>{drop.title}</h3><p>{drop.host} · {drop.rewardLabel}</p><span className={`drop-reward ${drop.rewardKind}`}>{drop.rewardKind === "token_airdrop" ? `TOKEN · ${drop.reward?.label ?? "Unavailable"}` : drop.rewardKind === "nft_mint" ? `COLLECTIBLE · ${drop.reward?.label ?? "Unavailable"}` : "PASSPORT CREDENTIAL"}</span><small className="drop-description">{drop.description}</small><div className="drop-supply"><span><i style={{ width: `${(drop.claimedCount / drop.maxClaims) * 100}%` }} /></span><small>{drop.claimedCount} / {drop.maxClaims} claimed</small></div>{drop.ownClaim && drop.rewardKind !== "credential" ? <button disabled={!drop.reward || ["exhausted", "closed", "not_open"].includes(drop.reward.status)} onClick={() => openPartnerReward(drop)}>{drop.rewardKind === "token_airdrop" ? "Open token reward →" : "Mint collectible →"}</button> : <button disabled={Boolean(drop.ownClaim) || dropBusy === drop.id} onClick={() => partnerDropAction("claim", { dropId: drop.id })}>{drop.ownClaim ? "Claimed to Passport ✓" : dropBusy === drop.id ? "Verifying…" : drop.rewardKind === "credential" ? "Verify & claim" : "Verify & unlock"}</button>}</div></article>) : drops.map((drop) => <article className={`drop-card ${drop.tone}`} key={drop.id}><div className="drop-art"><span className="drop-glow" /><MaskOrb compact /><b>{drop.id.toString().padStart(2, "0")}</b></div><div><span className="eyebrow">PARTNER DROP PREVIEW</span><h3>{drop.title}</h3><p>{drop.host}</p><div className="drop-supply"><span><i style={{ width: `${(drop.claimed / drop.supply) * 100}%` }} /></span><small>Publish from Educator View</small></div><button disabled>Preview credential</button></div></article>)}</div>
            </div>
          )}

          {active === "admin" && (
            <div className="page-stack">
              <section className="admin-banner educator-hero"><div><span className="eyebrow">EDUCATOR COMMAND CENTRE</span><h2>{educatorDashboard?.currentSession ? "Your classroom is live." : "Ready for the next session."}</h2><p>See who is ready, spot students who are stuck, and send one guided onchain quest to the whole class.</p></div><div className="admin-hero-actions"><button onClick={downloadClassReport}>Download class CSV</button><button onClick={loadEducatorDashboard} disabled={educatorBusy}>{educatorBusy ? "Refreshing…" : "Refresh classroom"}</button></div></section>
              {Boolean(firstDayState?.cohortProgress.length) && <section className="first-day-admin card"><div className="section-head"><span><b>FIRST-DAY READINESS</b><small>See exactly where each batch is getting stuck before the session begins</small></span><button onClick={() => void loadFirstDay()}>Refresh readiness ↻</button></div><div>{firstDayState?.cohortProgress.map((cohort) => <article key={cohort.id}><header><span><small>{cohort.college}</small><b>{cohort.title}</b></span><em>{cohort.ready}/{cohort.students} runway complete</em></header><div className="first-day-admin-bars">{firstDayState.steps.map((step) => <span key={step.id}><b>{step.number} · {step.title}</b><i><u style={{ width: `${cohort.students ? (cohort.counts[step.id] / cohort.students) * 100 : 0}%` }} /></i><small>{cohort.counts[step.id]} / {cohort.students}</small></span>)}</div>{cohort.stuck.length ? <footer><b>Needs attention</b>{cohort.stuck.slice(0, 3).map((row) => <span key={row.id}>{row.count} missing · {row.title}</span>)}</footer> : <footer className="ready"><b>Batch ready ✓</b><span>Every joined student has completed the first onchain runway.</span></footer>}</article>)}</div></section>}
              <section className="cohort-manager card">
                <div className="section-head"><span><b>COHORT MANAGER</b><small>Create private batches, control enrollment and export the complete roster</small></span><em>{cohortState?.cohorts.filter((cohort) => cohort.status === "active").length ?? 0} active</em></div>
                <form onSubmit={(event) => { event.preventDefault(); void cohortAction("create", cohortDraft); }}><label>Cohort name<input value={cohortDraft.title} onChange={(event) => setCohortDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Blockchain Club · Batch 01" required /></label><label>College<input value={cohortDraft.college} onChange={(event) => setCohortDraft((current) => ({ ...current, college: event.target.value }))} placeholder="College name" required /></label><label>Seat limit<input type="number" min="1" max="500" value={cohortDraft.expectedStudents} onChange={(event) => setCohortDraft((current) => ({ ...current, expectedStudents: event.target.value }))} /></label><button disabled={cohortBusy}>{cohortBusy ? "Creating…" : "Create private cohort →"}</button></form>
                {Boolean(cohortState?.cohorts.some((cohort) => cohort.status === "active")) && <form className="cohort-assignment-form" onSubmit={(event) => { event.preventDefault(); const course = cohortAssignmentDraft.course; const lessonId = Number(cohortAssignmentDraft.lessonId); const lesson = lessonTracks[course].find((item) => item.id === lessonId); if (lesson) void cohortAction("assign_lesson", { ...cohortAssignmentDraft, lessonId, title: lesson.title }); }}><div><span className="eyebrow">ASSIGN THE NEXT LESSON</span><b>Push one clear learning priority to a batch</b></div><label>Cohort<select required value={cohortAssignmentDraft.cohortId} onChange={(event) => setCohortAssignmentDraft((current) => ({ ...current, cohortId: event.target.value }))}><option value="">Choose batch</option>{cohortState?.cohorts.filter((cohort) => cohort.status === "active").map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}</select></label><label>Course<select value={cohortAssignmentDraft.course} onChange={(event) => setCohortAssignmentDraft((current) => ({ ...current, course: event.target.value as Course, lessonId: "1" }))}>{(["blockchain", "bitcoin", "ethereum"] as Course[]).map((course) => <option key={course} value={course}>{course}</option>)}</select></label><label>Lesson<select value={cohortAssignmentDraft.lessonId} onChange={(event) => setCohortAssignmentDraft((current) => ({ ...current, lessonId: event.target.value }))}>{lessonTracks[cohortAssignmentDraft.course].map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.id}. {lesson.title}</option>)}</select></label><label>Due date<input type="datetime-local" value={cohortAssignmentDraft.dueAt} onChange={(event) => setCohortAssignmentDraft((current) => ({ ...current, dueAt: event.target.value }))} /></label><label className="wide">Note for students<input value={cohortAssignmentDraft.instructions} onChange={(event) => setCohortAssignmentDraft((current) => ({ ...current, instructions: event.target.value }))} placeholder="Watch before Thursday's live session" /></label><button disabled={cohortBusy || !cohortAssignmentDraft.cohortId}>Assign lesson →</button></form>}
                {cohortError && <div className="cohort-admin-error">{cohortError}</div>}
                <div className="cohort-list">{cohortState?.cohorts.length ? cohortState.cohorts.map((cohort) => <article key={cohort.id} className={cohort.status === "complete" ? "complete" : ""}><header><div><small>{cohort.college}</small><h3>{cohort.title}</h3><p>{cohort.memberCount} of {cohort.expectedStudents} seats · {cohort.status === "complete" ? "Completed" : cohort.enrollmentOpen ? "Enrollment open" : "Enrollment closed"}</p></div><span>{cohort.status}</span></header><div className="cohort-code"><span><small>PRIVATE JOIN CODE</small><b>{cohort.joinCode}</b></span><button onClick={() => navigator.clipboard.writeText(cohort.joinCode ?? "").then(() => notify("Cohort code copied"))}>Copy code</button></div>{Boolean(cohort.assignments.filter((assignment) => assignment.status === "active").length) && <div className="cohort-assignment-list"><small>ASSIGNED LEARNING</small>{cohort.assignments.filter((assignment) => assignment.status === "active").map((assignment) => <div key={assignment.id}><span><b>{assignment.title}</b><small>{assignment.course} · {assignment.dueAt ? `due ${new Date(assignment.dueAt).toLocaleDateString()}` : "no deadline"}</small></span><em>{assignment.completedCount} / {assignment.totalStudents} complete</em><button aria-label={`Archive ${assignment.title}`} onClick={() => void cohortAction("archive_assignment", { cohortId: cohort.id, assignmentId: assignment.id })}>×</button></div>)}</div>}<div className="cohort-actions"><button disabled={cohort.status === "complete" || cohortBusy} onClick={() => void cohortAction("set_enrollment", { cohortId: cohort.id, enrollmentOpen: !cohort.enrollmentOpen })}>{cohort.enrollmentOpen ? "Close enrollment" : "Open enrollment"}</button><button onClick={() => exportCohortRoster(cohort)}>Export roster CSV</button><button disabled={cohort.status === "complete" || cohortBusy} onClick={() => void cohortAction("complete", { cohortId: cohort.id })}>Complete batch</button></div><details><summary>View student roster <span>{cohort.memberCount}</span></summary>{cohort.roster.length ? <div className="cohort-roster"><div><b>Student</b><b>Wallets</b><b>Lessons</b></div>{cohort.roster.map((student) => <div key={student.id}><span><b>{student.displayName}</b><small>@{student.username} · {student.email}</small></span><span>{student.ethereumAddress ? "ETH ✓" : "ETH —"} · {student.solanaAddress ? "SOL ✓" : "SOL —"}</span><span>{student.lessonsCompleted} / 25</span></div>)}</div> : <p className="cohort-empty">Share the private code when you are ready to admit students.</p>}</details></article>) : <div className="cohort-empty-state"><b>No cohort created yet.</b><span>Create your first private batch above. Existing Campus access remains open until then.</span></div>}</div>
              </section>
              <section className="attendance-admin card"><div className="section-head"><span><b>LIVE SESSION ATTENDANCE</b><small>Open a timed check-in and verify who is physically in the room</small></span><em>{attendanceState?.sessions.filter((session) => session.status === "open" && Date.parse(session.expiresAt) > Date.now()).length ?? 0} live</em></div><form onSubmit={(event) => { event.preventDefault(); void attendanceAction("open", attendanceDraft); }}><label>Cohort<select required value={attendanceDraft.cohortId} onChange={(event) => setAttendanceDraft((current) => ({ ...current, cohortId: event.target.value }))}><option value="">Choose batch</option>{cohortState?.cohorts.filter((cohort) => cohort.status === "active").map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}</select></label><label>Session title<input required value={attendanceDraft.title} onChange={(event) => setAttendanceDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ethereum + blockchain use cases" /></label><label>Guest / host<input value={attendanceDraft.host} onChange={(event) => setAttendanceDraft((current) => ({ ...current, host: event.target.value }))} placeholder="Faceless × Partner" /></label><label>Check-in window<select value={attendanceDraft.durationMinutes} onChange={(event) => setAttendanceDraft((current) => ({ ...current, durationMinutes: event.target.value }))}><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label><button disabled={attendanceBusy || !attendanceDraft.cohortId}>{attendanceBusy ? "Opening…" : "Open live check-in →"}</button></form>{attendanceError && <div className="cohort-admin-error">{attendanceError}</div>}<div className="attendance-session-list">{attendanceState?.sessions.length ? attendanceState.sessions.slice(0, 8).map((session) => { const live = session.status === "open" && Date.parse(session.expiresAt) > Date.now(); return <article key={session.id} className={live ? "live" : ""}><header><span><small>{session.cohortTitle} · {session.host}</small><b>{session.title}</b><em>{new Date(session.openedAt).toLocaleString()}</em></span>{live ? <div><small>CLASSROOM CODE</small><strong>{session.checkInCode}</strong></div> : <i>CLOSED</i>}</header><div className="attendance-session-stats"><span><strong>{session.attendanceCount}</strong><small>verified students</small></span><button onClick={() => exportAttendance(session)} disabled={!session.records.length}>Export CSV</button>{live && <button onClick={() => void attendanceAction("close", { sessionId: session.id })} disabled={attendanceBusy}>Close check-in</button>}</div><details><summary>View attendance roster <b>{session.attendanceCount}</b></summary>{session.records.length ? <div>{session.records.map((record) => <p key={record.id}><span><b>{record.displayName}</b><small>@{record.username} · {record.email}</small></span><time>{new Date(record.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p>)}</div> : <small>No students have checked in yet.</small>}</details></article>; }) : <div className="attendance-empty"><b>No attendance sessions yet.</b><span>Open one when students are in the room. The code expires automatically.</span></div>}</div></section>
              <div className="command-metrics">
                <article><small>ACTIVE STUDENTS</small><strong>{educatorDashboard?.metrics.activeStudents ?? 0}</strong><span>verified profiles</span></article>
                <article><small>BOTH WALLETS READY</small><strong>{educatorDashboard?.metrics.bothWallets ?? 0}</strong><span>Ethereum + Solana</span></article>
                <article><small>LESSONS COMPLETED</small><strong>{educatorDashboard?.metrics.lessonsCompleted ?? 0}</strong><span>across the cohort</span></article>
                <article><small>ONCHAIN ACTIONS</small><strong>{educatorDashboard?.metrics.onchainActions ?? 0}</strong><span>real testnet proofs</span></article>
              </div>
              <section className="session-control card">
                <div className="session-control-head"><div><span className="eyebrow">SESSION MODE</span><h3>{educatorDashboard?.currentSession ? educatorDashboard.currentSession.title : "Push one quest to every student"}</h3><p>{educatorDashboard?.currentSession ? educatorDashboard.currentSession.instructions : "Students see the quest at the top of Campus OS within 15 seconds."}</p></div>{educatorDashboard?.currentSession && <div className="session-score"><strong>{educatorDashboard.sessionProgress}</strong><span>of {educatorDashboard.metrics.activeStudents} verified</span></div>}</div>
                {!educatorDashboard?.currentSession ? <>
                  <div className="quest-picker">{(["fund_wallets", "send_token", "mint_nft", "buy_rwa", "launch_token"] as ClassroomQuest[]).map((quest) => <button key={quest} className={sessionDraft.quest === quest ? "active" : ""} onClick={() => chooseSessionQuest(quest)}>{({ fund_wallets: "Fund wallets", send_token: "Send tokens", mint_nft: "Mint NFT", buy_rwa: "Buy RWA", launch_token: "Launch token" } as Record<ClassroomQuest, string>)[quest]}</button>)}</div>
                  <div className="session-form"><label>Quest title<input value={sessionDraft.title} onChange={(event) => setSessionDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Instructions<textarea value={sessionDraft.instructions} onChange={(event) => setSessionDraft((current) => ({ ...current, instructions: event.target.value }))} /></label><button onClick={() => updateClassroomSession("start_session")} disabled={educatorBusy}>Go live for the class →</button></div>
                </> : <><div className="live-session-breakdown"><span><b>{educatorDashboard.sessionProgress}</b> Completed</span><span><b>{educatorDashboard.sessionWorking}</b> Working</span><span><b>{educatorDashboard.sessionNeedsHelp}</b> Need help</span><span><b>{Math.max(0, educatorDashboard.metrics.activeStudents - educatorDashboard.sessionProgress - educatorDashboard.sessionWorking - educatorDashboard.sessionNeedsHelp)}</b> Not started</span></div><div className="session-live-actions"><span><i /> LIVE NOW · updates every 15 seconds</span><button onClick={() => updateClassroomSession("end_session")} disabled={educatorBusy}>End session</button></div></>}
              </section>
              <div className="educator-ops-grid">
                <section className="card network-health"><div className="section-head"><span><b>NETWORK + ASSET HEALTH</b><small>What is ready for today’s class</small></span></div><div>{[
                  ["Sepolia", `${faucetState?.chains.find((item) => item.chain === "ethereum")?.enabled ? "Claims open" : "Claims closed"}`],
                  ["Solana Devnet", `${faucetState?.chains.find((item) => item.chain === "solana")?.enabled ? "Claims open" : "Claims closed"}`],
                  ["NFT collections", String(educatorDashboard?.metrics.nftCollections ?? 0)], ["Classroom tokens", String(educatorDashboard?.metrics.tokens ?? 0)], ["RWA labs", String(educatorDashboard?.metrics.rwas ?? 0)], ["Open airdrops", String(educatorDashboard?.metrics.openAirdrops ?? 0)],
                ].map(([label, value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}</div></section>
                <section className="card classroom-alerts"><div className="section-head"><span><b>NEEDS HELP</b><small>Start here when you walk around the room</small></span><em>{educatorDashboard?.alerts.length ?? 0}</em></div>{educatorDashboard?.alerts.length ? educatorDashboard.alerts.slice(0, 8).map((alert) => <p key={`${alert.userId}:${alert.message}`}><b>@{alert.username}</b><span>{alert.message}</span></p>) : <div className="all-clear">✓ No student blockers detected</div>}</section>
              </div>
              <section className="admin-table card roster-table"><div className="section-head"><span><b>LIVE STUDENT ROSTER</b><small>Wallet, learning and live-quest readiness</small></span><button onClick={loadEducatorDashboard}>Refresh</button></div><div className="table-row table-head"><span>Student</span><span>Wallets</span><span>Lessons</span><span>Built</span><span>{educatorDashboard?.currentSession ? "Live quest" : "Status"}</span></div>{educatorDashboard?.roster.map((student) => { const statusLabel = student.sessionStatus === "completed" ? "Completed ✓" : student.sessionStatus === "working" ? "Working" : student.sessionStatus === "needs_help" ? "Needs help" : educatorDashboard.currentSession ? "Not started" : student.issues.length ? "Needs help" : "Ready"; return <div className="table-row" key={student.id}><span data-label="Student"><b>{student.displayName}</b><small>@{student.username}</small></span><span data-label="Wallets">{student.ethereumReady ? "ETH ✓" : "ETH —"} · {student.solanaReady ? "SOL ✓" : "SOL —"}</span><span data-label="Lessons">{student.lessonsCompleted} / 25</span><span data-label="Built">{student.assetsCreated} assets</span><span data-label="Status" title={student.proofLabel ?? undefined} className={`status ${student.sessionStatus === "needs_help" || (!student.sessionStatus && student.issues.length) ? "review" : student.sessionStatus === "working" ? "working" : student.sessionStatus === "completed" ? "complete" : ""}`}>{statusLabel}</span></div>; })}</section>
              {Boolean(educatorDashboard?.recentSessions.length) && <section className="session-history card"><div className="section-head"><span><b>SESSION REPORTS</b><small>Saved automatically when you end a class quest</small></span></div><div>{educatorDashboard?.recentSessions.map((session) => <article key={session.id}><span>{({ fund_wallets: "Ξ", send_token: "↗", mint_nft: "◆", buy_rwa: "▦", launch_token: "+" } as Record<ClassroomQuest, string>)[session.quest]}</span><div><small>{new Date(session.startedAt).toLocaleString()}</small><b>{session.title}</b><p>{session.participated} participated · {session.completed} verified · {session.needsHelp} needed help</p></div><em>{session.participated ? Math.round((session.completed / session.participated) * 100) : 0}%</em></article>)}</div></section>}
              {Boolean(builderProjectState?.reviewQueue.length) && <section className="builder-review-admin card"><div className="section-head"><span><b>ONCHAIN PROJECT VERIFICATION</b><small>Inspect completed builds before adding them to student Passports</small></span><em>{builderProjectState?.reviewQueue.filter((project) => project.status === "submitted").length ?? 0} waiting</em></div><div>{builderProjectState?.reviewQueue.slice(0, 12).map((project) => <article key={project.id}><header><span><small>{project.student ? `@${project.student.username}` : "Student"} · {project.chain} · {project.useCase}</small><b>{project.title}</b><p>{project.members.filter((member) => member.status === "accepted").map((member) => `@${member.username} · ${member.role}`).join("  ·  ")}</p></span><em className={project.status}>{project.status.replaceAll("_", " ")}</em></header><div className="builder-review-story"><span><b>Problem</b><p>{project.problem}</p></span><span><b>Audience</b><p>{project.audience}</p></span><span><b>Solution</b><p>{project.solution}</p></span></div><div className="builder-review-proof">{project.demoUrl && <a href={project.demoUrl} target="_blank" rel="noreferrer">Open working demo ↗</a>}{project.contractReference && <code>{project.contractReference}</code>}<span>{project.milestones.filter((item) => item.done).length}/4 milestones complete</span></div>{project.status === "submitted" && <footer><input value={builderReviewNotes[project.id] ?? ""} onChange={(event) => setBuilderReviewNotes((current) => ({ ...current, [project.id]: event.target.value }))} placeholder="Verification note or requested change" /><button onClick={() => void builderProjectAction("review", { projectId: project.id, status: "changes_requested", reviewNotes: builderReviewNotes[project.id] ?? "Add clearer proof that the demo works." })}>Request changes</button><button onClick={() => void builderProjectAction("review", { projectId: project.id, status: "verified", reviewNotes: builderReviewNotes[project.id] ?? "Verified working Campus project." })}>Verify team to Passports ✓</button></footer>}{project.reviewNotes && project.status !== "submitted" && <p className="review-saved-note">{project.reviewNotes}</p>}</article>)}</div></section>}
              {Boolean(creatorProjectState?.reviewQueue.length) && <section className="creator-review-admin card"><div className="section-head"><span><b>CREATOR PLAN REVIEW</b><small>Approve the direction before students start filming</small></span><em>{creatorProjectState?.reviewQueue.filter((project) => project.reviewStatus === "submitted").length ?? 0} waiting</em></div><div>{creatorProjectState?.reviewQueue.slice(0, 12).map((project) => <article key={project.id}><header><span><small>{project.student ? `@${project.student.username}` : "Student"} · {project.platform} · {project.format.replaceAll("_", " ")}</small><b>{project.title}</b><p>{project.campaign ? `${project.campaign.brand} · ${project.campaign.title}` : "Independent creator project"}</p></span><em className={project.reviewStatus}>{project.reviewStatus.replaceAll("_", " ")}</em></header><details><summary>Inspect content plan</summary><div><b>Objective</b><p>{project.objective}</p><b>Hook</b><p>{project.hook}</p><b>Five shots</b><ol>{project.shots.map((shot, index) => <li key={`${project.id}:${index}`}>{shot}</li>)}</ol><b>Caption + disclosure</b><p>{project.caption}</p></div></details>{project.reviewStatus === "submitted" && <footer><input value={creatorReviewNotes[project.id] ?? ""} onChange={(event) => setCreatorReviewNotes((current) => ({ ...current, [project.id]: event.target.value }))} placeholder="Feedback or approval note" /><button onClick={() => void creatorProjectReviewAction("review", { projectId: project.id, reviewStatus: "changes_requested", reviewNotes: creatorReviewNotes[project.id] ?? "" })}>Request changes</button><button onClick={() => void creatorProjectReviewAction("review", { projectId: project.id, reviewStatus: "approved", reviewNotes: creatorReviewNotes[project.id] ?? "Approved to shoot." })}>Approve to shoot ✓</button></footer>}{project.reviewNotes && project.reviewStatus !== "submitted" && <p className="review-saved-note">{project.reviewNotes}</p>}</article>)}</div></section>}
              <section className="partner-drop-admin card"><div className="section-head"><span><b>PARTNER DROP STUDIO</b><small>Create a verified credential and optionally unlock a real testnet reward</small></span><em>{dropState?.drops.filter((item) => item.status === "live").length ?? 0} live</em></div><form onSubmit={(event) => { event.preventDefault(); void partnerDropAction("create", dropDraft); }}><label>Drop title<input value={dropDraft.title} onChange={(event) => setDropDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Solana Builder Session" required /></label><label>Partner / host<input value={dropDraft.host} onChange={(event) => setDropDraft((current) => ({ ...current, host: event.target.value }))} placeholder="Faceless × Partner" required /></label><label>Who qualifies?<select value={dropDraft.eligibility} onChange={(event) => setDropDraft((current) => ({ ...current, eligibility: event.target.value as PartnerDrop["eligibility"], eligibilityRef: "" }))}><option value="open">Every verified student</option><option value="attendance">Verified session attendees</option><option value="live_quest">Completed live quest</option><option value="lesson">Completed lesson</option><option value="campaign">Approved campaign</option></select></label>{dropDraft.eligibility === "attendance" && <label>Attendance session<select required value={dropDraft.eligibilityRef} onChange={(event) => { const session = attendanceState?.sessions.find((item) => item.id === event.target.value); setDropDraft((current) => ({ ...current, eligibilityRef: event.target.value, title: current.title || session?.title || "", host: current.host || session?.host || "" })); }}><option value="">Choose verified session</option>{attendanceState?.sessions.map((session) => <option value={session.id} key={session.id}>{session.title} · {session.cohortTitle} · {session.attendanceCount} attended</option>)}</select></label>}<label>Reward type<select value={dropDraft.rewardKind} onChange={(event) => setDropDraft((current) => ({ ...current, rewardKind: event.target.value as PartnerReward["kind"], rewardAssetId: "" }))}><option value="credential">Passport credential</option><option value="token_airdrop">Token airdrop</option><option value="nft_mint">NFT collectible</option></select></label>{dropDraft.rewardKind !== "credential" && <label>Onchain reward<select required value={dropDraft.rewardAssetId} onChange={(event) => setDropDraft((current) => ({ ...current, rewardAssetId: event.target.value }))}><option value="">Choose a ready asset</option>{(dropDraft.rewardKind === "token_airdrop" ? dropState?.rewardOptions.tokenAirdrops : dropState?.rewardOptions.collections)?.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>}<label>Claim limit<input type="number" min="1" max="1000" value={dropDraft.maxClaims} onChange={(event) => setDropDraft((current) => ({ ...current, maxClaims: event.target.value }))} /></label><label>Reward label<input value={dropDraft.rewardLabel} onChange={(event) => setDropDraft((current) => ({ ...current, rewardLabel: event.target.value }))} placeholder="Attendance badge" /></label><label className="wide">What does this credential prove?<textarea value={dropDraft.description} onChange={(event) => setDropDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Attended the partner session and verified participation in the classroom." required /></label><button disabled={dropBusy === "create"}>Open partner drop →</button></form><footer><b>Attendance → credential → onchain reward</b><span>Campus verifies the student was in the room first. Their wallet still handles any separate testnet claim or mint.</span></footer></section>
              <section className="campaign-admin card"><div className="section-head"><span><b>CAMPAIGN CONTROL</b><small>Publish paid creator missions to verified students</small></span><em>{campaignState?.reviewQueue.filter((item) => item.status === "submitted").length ?? 0} to review</em></div><form onSubmit={(event) => { event.preventDefault(); void campaignAction("create", campaignDraft); }}><label>Brand<input value={campaignDraft.brand} onChange={(event) => setCampaignDraft((current) => ({ ...current, brand: event.target.value }))} placeholder="Partner or project" required /></label><label>Campaign title<input value={campaignDraft.title} onChange={(event) => setCampaignDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Create three launch clips" required /></label><label>Mission type<select value={campaignDraft.campaignType} onChange={(event) => setCampaignDraft((current) => ({ ...current, campaignType: event.target.value as CampusCampaign["campaignType"] }))}><option value="creator">Creator</option><option value="faceless">Faceless creator</option><option value="clipper">Clipper</option><option value="user_acquisition">User acquisition</option></select></label><label>Platform<input value={campaignDraft.platform} onChange={(event) => setCampaignDraft((current) => ({ ...current, platform: event.target.value }))} /></label><label>Spots<input type="number" min="1" max="500" value={campaignDraft.spots} onChange={(event) => setCampaignDraft((current) => ({ ...current, spots: event.target.value }))} /></label><label>Reward<div><select value={campaignDraft.rewardCurrency} onChange={(event) => setCampaignDraft((current) => ({ ...current, rewardCurrency: event.target.value }))}><option>INR</option><option>USD</option><option>USDC</option></select><input value={campaignDraft.rewardAmount} onChange={(event) => setCampaignDraft((current) => ({ ...current, rewardAmount: event.target.value }))} /></div></label><label className="campaign-brief-field">Brief<textarea value={campaignDraft.brief} onChange={(event) => setCampaignDraft((current) => ({ ...current, brief: event.target.value }))} placeholder="Explain exactly what students should create, post or acquire." required /></label><button disabled={campaignBusy === "create"}>Publish campaign →</button></form>
                {Boolean(campaignState?.reviewQueue.length) && <div className="campaign-review-list"><h4>STUDENT SUBMISSIONS</h4>{campaignState?.reviewQueue.map((submission) => <article key={submission.id}><div><small>{submission.student ? `@${submission.student.username}` : "Student"} · {submission.campaign?.title}</small><b>{submission.status.replaceAll("_", " ")}</b><a href={submission.contentUrl} target="_blank" rel="noreferrer">Open submitted work ↗</a></div>{submission.status === "submitted" && <span><button onClick={() => campaignAction("review", { campaignId: submission.campaignId, submissionId: submission.id, status: "changes_requested", reviewNotes: "Please revise the work against the brief and submit again." })}>Request changes</button><button onClick={() => campaignAction("review", { campaignId: submission.campaignId, submissionId: submission.id, status: "approved_for_payment", reviewNotes: "Approved for manual payment." })}>Approve payment</button></span>}</article>)}</div>}
                {Boolean(campaignState?.paymentQueue.length) && <div className="payment-desk"><h4>APPROVED PAYMENT QUEUE</h4>{campaignState?.paymentQueue.map((submission) => <article key={submission.id}><div><small>{submission.student ? `@${submission.student.username}` : "Student"}</small><b>{submission.campaign?.title}</b><strong>{submission.campaign?.rewardCurrency} {submission.campaign?.rewardAmount}</strong></div>{campaignPayout.submissionId === submission.id ? <form onSubmit={(event) => { event.preventDefault(); void campaignAction("record_payment", { campaignId: submission.campaignId, submissionId: submission.id, destinationReference: campaignPayout.destinationReference, transactionReference: campaignPayout.transactionReference }); }}><input value={campaignPayout.destinationReference} onChange={(event) => setCampaignPayout((current) => ({ ...current, destinationReference: event.target.value }))} placeholder="UPI ID or account note" required /><input value={campaignPayout.transactionReference} onChange={(event) => setCampaignPayout((current) => ({ ...current, transactionReference: event.target.value }))} placeholder="Payment reference" required /><button>Confirm paid</button></form> : <button onClick={() => setCampaignPayout({ submissionId: submission.id, destinationReference: "", transactionReference: "" })}>Record manual payment →</button>}</article>)}</div>}
                {Boolean(campaignState?.payouts.length) && <div className="payout-ledger"><h4>PAYMENT LEDGER</h4>{campaignState?.payouts.slice(0, 8).map((payout) => <p key={payout.id}><span><b>{payout.campaign?.title ?? "Campaign payment"}</b><small>{payout.transactionReference || "Reference pending"}</small></span><strong>{payout.currency} {payout.amount} · PAID</strong></p>)}</div>}
              </section>
              <section className="faucet-admin card">
                <div className="faucet-admin-head"><div><span className="eyebrow">CAMPUS FAUCET CONTROL</span><h3>Fund once. Let verified students claim.</h3><p>The distributor wallets are testnet-only and managed by Privy. Campus OS stores no wallet private keys.</p></div><button onClick={prepareFaucetWallets} disabled={faucetBusy === "prepare" || faucetState?.chains.every((item) => item.configured)}>{faucetBusy === "prepare" ? "Preparing…" : faucetState?.chains.every((item) => item.configured) ? "Wallets prepared ✓" : "Prepare all wallets"}</button></div>
                <div className="faucet-admin-grid">
                  {(["ethereum", "solana", "robinhood"] as const).map((chain) => {
                    const config = faucetState?.chains.find((item) => item.chain === chain);
                    const draft = faucetDraft[chain];
                    const meta = faucetNetworkMeta[chain];
                    return <article key={chain}>
                      <div className="faucet-chain"><span className={`chain-coin ${meta.className}`}>{meta.icon}</span><span><small>{meta.label} DISTRIBUTOR</small><b>{config?.distributorAddress ? shortenAddress(config.distributorAddress) : "Not prepared"}</b></span>{config?.distributorAddress && <button className="mini-copy" onClick={() => navigator.clipboard.writeText(config.distributorAddress || "").then(() => notify("Distributor address copied"))}>Copy</button>}</div>
                      <label>Amount per claim<input inputMode="decimal" value={draft.amount} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], amount: event.target.value } }))} /></label>
                      <label>Claims per student<select value={draft.maxClaims} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], maxClaims: Number(event.target.value) } }))}><option value={1}>1 claim</option><option value={2}>2 claims</option><option value={3}>3 claims</option></select></label>
                      <label className="faucet-toggle"><input aria-label={`Open ${meta.label} student claims`} type="checkbox" checked={draft.enabled} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], enabled: event.target.checked } }))} /><span><b>Open student claims</b><small>Only enable after loading test funds.</small></span></label>
                      <button className="save-faucet" disabled={!config?.configured || faucetBusy === chain} onClick={() => saveFaucetConfig(chain)}>{faucetBusy === chain ? "Saving…" : "Save settings"}</button>
                    </article>;
                  })}
                </div>
                {faucetError && <div className="faucet-message admin">{faucetError}</div>}
                {!faucetState?.signerReady && <small className="activation-note">One secure activation step remains before distributor wallets can be prepared.</small>}
              </section>
            </div>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.filter((item) => ["home", "learn", "mask", "market", "campaigns"].includes(item.id)).map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.mark}</span>{item.label.split(" ")[0]}</button>)}</nav>
      </section>

      {!onboarded && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <div className="onboarding-art"><div className="portal-ring one" /><div className="portal-ring two" /><MaskOrb /><span>ETHEREUM<br />+ SOLANA<br />CLASSROOM</span></div>
            <div className="onboarding-copy"><span className="eyebrow">FACELESS CAMPUS OS</span><h2>Learn. Build. Play.<br />Create. Earn.</h2><p>One profile for 25 lessons, the real live-session Mask, Ethereum and Solana practice, project demos, games and creator campaigns.</p><label className="username-field"><span>CHOOSE YOUR CAMPUS USERNAME</span><div><b>@</b><input value={username} onChange={(event) => { setUsername(event.target.value); setProfileError(""); }} maxLength={24} autoComplete="username" aria-label="Campus username" disabled={profileStatus === "saving"} /></div><small>Friends will use this name to send you classroom assets.</small></label>{profileError && <div className="profile-error">{profileError}</div>}<button className="google-button" onClick={enterLab} disabled={!privyReady || loading || profileStatus === "saving"}><span>{authenticated ? "✓" : "G"}</span>{!privyReady ? "Loading secure sign-in…" : loading ? "Opening Google…" : profileStatus === "saving" ? "Securing both wallets…" : authenticated ? "Save campus username" : "Continue with Google"}</button><button className="demo-link" onClick={() => setDemoMode(true)}>Explore the student demo</button><small>Google sign-in creates user-controlled Ethereum and Solana wallets through Privy. Faceless never stores private keys.</small></div>
          </div>
        </div>
      )}

      {cohortLocked && <div className="cohort-gate-overlay"><section><MaskOrb compact /><span className="eyebrow">PRIVATE CAMPUS COHORT</span><h2>Enter your classroom.</h2><p>Your profile and wallets are ready. Use the private code shared by your educator to unlock lessons, quests, markets and campaigns.</p><label>Cohort join code<input autoFocus value={cohortJoinCode} onChange={(event) => { setCohortJoinCode(event.target.value.toUpperCase()); setCohortError(""); }} placeholder="FACELESS-XXXXXX" maxLength={20} /></label>{cohortError && <div>{cohortError}</div>}<button disabled={cohortBusy || cohortJoinCode.length < 8} onClick={() => void cohortAction("join", { joinCode: cohortJoinCode })}>{cohortBusy ? "Checking code…" : "Join Campus cohort →"}</button><small>Codes are seat-limited and can be closed by the educator. Never share yours publicly.</small></section></div>}

      {transactionQueue && <div className="transaction-queue" role="status" aria-live="polite"><span>{transactionQueue.seconds > 0 ? transactionQueue.seconds : "✓"}</span><div><b>{transactionQueue.seconds > 0 ? "Campus queue" : "Your turn"}</b><small>{transactionQueue.seconds > 0 ? `Position ${transactionQueue.position} · wallet opens in about ${transactionQueue.seconds}s` : "Opening your wallet for approval…"}</small></div></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
