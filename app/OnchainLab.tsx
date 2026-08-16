"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useIdentityToken, usePrivy, useSendTransaction as useSendEthereumTransaction, useWallets as useEthereumWallets } from "@privy-io/react-auth";
import { useExportWallet as useExportSolanaWallet, useSignAndSendTransaction, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Decoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import LiveMask from "./LiveMask";

type Tab = "home" | "learn" | "mask" | "wallet" | "create" | "games" | "tools" | "campaigns" | "launchpad" | "passport" | "drops" | "admin";
type Course = "blockchain" | "bitcoin" | "ethereum";
type Chain = "ethereum" | "solana";
type LaunchMode = "testnet" | "mainnet";
type Lesson = { id: number; title: string; copy: string; time: string; unit: string; state: string; action: string; video?: string; course: Course };
type Recipient = { username: string; displayName: string; wallets: Array<{ chain: Chain; address: string }> };
type TransferReceipt = { chain: Chain; hash: string; username: string; amount: string; explorer: string };
type FaucetChainState = { chain: Chain; amount: string; maxClaims: number; claimsUsed: number; enabled: boolean; configured: boolean; distributorAddress?: string };
type FaucetState = {
  role: "student" | "educator" | "owner";
  signerReady: boolean;
  chains: FaucetChainState[];
  recent: Array<{ id: string; chain: Chain; amount: string; status: "queued" | "processing" | "sent" | "failed"; transactionHash?: string | null; claimedAt: string; errorMessage?: string | null }>;
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
type MaskMessage = { role: "user" | "assistant"; text: string; citations?: MaskCitation[] };

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

const solanaDevnetRpc = createSolanaRpc("https://api.devnet.solana.com");

export default function OnchainLab() {
  const { ready: privyReady, authenticated, user, login, logout, linkWallet, exportWallet: exportEthereumWallet } = usePrivy();
  const { identityToken } = useIdentityToken();
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
  const [created, setCreated] = useState(false);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course>("ethereum");
  const [selectedLesson, setSelectedLesson] = useState<Lesson>(ethereumLessons[1]);
  const [maskQuestion, setMaskQuestion] = useState("");
  const [maskMessages, setMaskMessages] = useState<MaskMessage[]>([{ role: "assistant", text: "Ask me anything. If it connects to a Faceless lesson, I’ll use the approved material. If it doesn’t, I’ll answer it normally." }]);
  const [maskBusy, setMaskBusy] = useState(false);
  const [claimedCampaigns, setClaimedCampaigns] = useState<number[]>([]);
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
  const [faucetBusy, setFaucetBusy] = useState<Chain | "prepare" | "">("");
  const [faucetError, setFaucetError] = useState("");
  const [faucetDraft, setFaucetDraft] = useState<Record<Chain, { amount: string; maxClaims: number; enabled: boolean }>>({
    ethereum: { amount: "0.002", maxClaims: 1, enabled: false },
    solana: { amount: "0.05", maxClaims: 1, enabled: false },
  });
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [learningBusy, setLearningBusy] = useState(false);
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
  const completed = learningState?.completedCount ?? 0;
  const progress = Math.round((completed / 25) * 100);
  const selectedProgress = learningState?.records.find((record) => record.course === selectedLesson.course && record.lessonId === selectedLesson.id);
  const selectedComplete = selectedProgress?.status === "completed";

  const title = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Home", [active]);

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
  }, [authenticated, ethereumWallet?.address, solanaWallet?.address]);

  useEffect(() => {
    if (!authenticated || !identityToken || profileStatus !== "ready") return;
    void loadFaucetState();
    void loadLearningState();
  }, [authenticated, identityToken, profileStatus]);

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
      }])) as Record<Chain, { amount: string; maxClaims: number; enabled: boolean }>);
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

  async function claimCampusFaucet(chain: Chain = activeChain) {
    if (!identityToken) return notify("Sign in to claim classroom test funds");
    setActiveChain(chain);
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
      notify(`${result.amount} ${chain === "ethereum" ? "Sepolia ETH" : "Devnet SOL"} sent to your wallet`);
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
      notify("Both Campus Faucet wallets are ready to fund");
      await loadFaucetState();
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Distributor wallets could not be prepared");
    } finally {
      setFaucetBusy("");
    }
  }

  async function saveFaucetConfig(chain: Chain) {
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
      notify(`${chain === "ethereum" ? "Sepolia" : "Solana Devnet"} faucet settings saved`);
      await loadFaucetState();
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Faucet settings could not be saved");
    } finally {
      setFaucetBusy("");
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
        const { signature } = await sendSolanaTransaction({ transaction, wallet: solanaWallet, chain: "solana:devnet" });
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
    setArtPreview(URL.createObjectURL(file));
  }

  function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(true);
    notify("Draft collection created in the Sepolia sandbox");
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

  async function askMask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = maskQuestion.trim();
    if (!question || maskBusy) return;
    if (!identityToken) return notify("Sign in to ask the live Mask");
    const previous = maskMessages.slice(-8);
    setMaskMessages((current) => [...current, { role: "user", text: question }]);
    setMaskQuestion("");
    setMaskBusy(true);
    try {
      const response = await fetch("/api/mask", {
        method: "POST",
        headers: { "content-type": "application/json", "privy-id-token": identityToken },
        body: JSON.stringify({
          question,
          history: previous,
          lesson: { course: selectedLesson.course, title: selectedLesson.title, summary: selectedLesson.copy },
        }),
      });
      const result = await response.json() as { answer?: string; citations?: MaskCitation[]; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "Mask could not answer right now");
      setMaskMessages((current) => [...current, { role: "assistant", text: result.answer!, citations: result.citations }]);
    } catch (error) {
      setMaskMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "I couldn’t answer that right now. Please try again." }]);
    } finally {
      setMaskBusy(false);
    }
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
            <button className="wallet-pill" onClick={() => setActive("wallet")}><span>◇</span> {wallet}</button>
          </div>
        </header>

        <div className="content-area">
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

              <section className="wallet-card card">
                <div className="section-head"><span><b>CLASSROOM WALLET</b><small>{wallet}</small></span><button onClick={() => copyWalletAddress(activeChain)}>Copy</button></div>
                <div className="balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? balance.toFixed(3) : solBalance.toFixed(2)} <span>{activeChain === "ethereum" ? "ETH" : "SOL"}</span></strong><em>Testnet only · no real value</em></div>
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
                  <div><small>{message.role === "assistant" ? "MASK" : "YOU"}</small><p>{message.text}</p>{message.citations?.length ? <div className="mask-citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title} ↗</a>)}</div> : null}</div>
                </div>)}{maskBusy && <div className="chat-answer assistant thinking"><MaskOrb compact /><div><small>MASK</small><p>Thinking…</p></div></div>}</div>
                <div className="prompt-chips">{["Explain gas simply", "Help me plan a Reel", "What happened in the news today?"].map((prompt) => <button key={prompt} onClick={() => setMaskQuestion(prompt)}>{prompt}</button>)}</div>
                <form className="mask-form" onSubmit={askMask}><input value={maskQuestion} onChange={(event) => setMaskQuestion(event.target.value)} placeholder="Ask Mask anything…" aria-label="Question for Mask" maxLength={1500} /><button type="submit" disabled={maskBusy}>{maskBusy ? "Thinking…" : "Ask Mask →"}</button></form>
                <small className="prototype-note">Mask can explain and guide, but never signs wallet transactions or guarantees financial outcomes.</small>
              </section>
              <section className="mask-tools"><article><span>01</span><b>Understand</b><p>Explain the concept using the lesson you are watching.</p></article><article><span>02</span><b>Create</b><p>Turn the concept into a safe testnet activity.</p></article><article><span>03</span><b>Campaign</b><p>Convert a partner brief into a checklist, hook and script.</p></article></section>
            </div>
          )}

          {active === "wallet" && (
            <div className="page-stack">
              <section className="wallet-hero">
                <div><span className="eyebrow">YOUR MULTICHAIN CLASSROOM IDENTITY</span><h2>{wallet}</h2><p>{authenticated ? "Your Privy wallets are ready for supervised Ethereum and Solana practice." : "Demo identity · sign in with Google to create your real classroom wallets."}</p></div>
                <div className="wallet-balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? `${balance.toFixed(4)} ETH` : `${solBalance.toFixed(3)} SOL`}</strong><button onClick={() => claimCampusFaucet(activeChain)}>Claim from Campus Faucet ↓</button></div>
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
                  {(["ethereum", "solana"] as const).map((chain) => {
                    const config = faucetState?.chains.find((item) => item.chain === chain);
                    const remaining = Math.max(0, (config?.maxClaims ?? 1) - (config?.claimsUsed ?? 0));
                    const ready = Boolean(config?.enabled && config.configured && faucetState?.signerReady);
                    return <article key={chain}>
                      <div className="faucet-chain"><span className={`chain-coin ${chain === "ethereum" ? "eth" : "sol"}`}>{chain === "ethereum" ? "Ξ" : "S"}</span><span><small>{chain === "ethereum" ? "ETHEREUM · SEPOLIA" : "SOLANA · DEVNET"}</small><b>{config?.amount ?? (chain === "ethereum" ? "0.002" : "0.05")} {chain === "ethereum" ? "ETH" : "SOL"}</b></span></div>
                      <div className="faucet-availability"><span>{remaining} of {config?.maxClaims ?? 1} claims left</span><i><b style={{ width: `${((config?.claimsUsed ?? 0) / Math.max(1, config?.maxClaims ?? 1)) * 100}%` }} /></i></div>
                      <button disabled={!ready || remaining === 0 || Boolean(faucetBusy)} onClick={() => claimCampusFaucet(chain)}>{faucetBusy === chain ? "Sending…" : remaining === 0 ? "Claim limit reached ✓" : ready ? `Claim test ${chain === "ethereum" ? "ETH" : "SOL"}` : "Opening soon"}</button>
                    </article>;
                  })}
                  {faucetError && <div className="faucet-message">{faucetError}</div>}
                  {faucetState?.recent[0] && <div className={`faucet-recent ${faucetState.recent[0].status}`}><span>{faucetState.recent[0].status === "sent" ? "✓" : faucetState.recent[0].status === "failed" ? "!" : "…"}</span><div><small>LATEST CLAIM</small><b>{faucetState.recent[0].amount} {faucetState.recent[0].chain === "ethereum" ? "Sepolia ETH" : "Devnet SOL"} · {faucetState.recent[0].status}</b></div>{faucetState.recent[0].transactionHash && <a href={faucetState.recent[0].chain === "ethereum" ? `https://sepolia.etherscan.io/tx/${faucetState.recent[0].transactionHash}` : `https://explorer.solana.com/tx/${faucetState.recent[0].transactionHash}?cluster=devnet`} target="_blank" rel="noreferrer">View receipt ↗</a>}</div>}
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
              <div className="asset-layout">
                <section className="card asset-section"><div className="section-head"><span><b>COLLECTIBLES</b><small>2 classroom assets</small></span></div><div className="asset-grid"><div className="asset-tile"><img src="/faceless-purple.png" alt="Purple Faceless classroom head" /><span><b>Ethereum Lab Pass</b><small>ERC-1155 · Testnet</small></span></div>{headClaimed ? <div className="asset-tile"><img src="/faceless-blue.png" alt="Blue Faceless classroom head" /><span><b>Faceless Head #084</b><small>Claimed today</small></span></div> : <button className="asset-empty" onClick={claimHead}>+ Claim your Faceless head</button>}</div></section>
                <section className="card tx-section"><div className="section-head"><span><b>MULTICHAIN ACTIVITY</b><small>Sepolia + Solana Devnet</small></span></div>{["Minted Ethereum Lab Pass", "Created Solana Devnet wallet", "Created Ethereum wallet"].map((label, index) => <div className="tx-row" key={label}><span className={index === 0 ? "tx-dot violet" : "tx-dot"} /><span><b>{label}</b><small>{index + 7} minutes ago</small></span><code>{index === 1 ? "8maZ...xQ7P" : `0x${index + 3}a...${index}f9`}</code></div>)}</section>
              </div>
            </div>
          )}

          {active === "create" && (
            <div className="page-stack">
              <section className="build-hero"><div><span className="eyebrow">IDEA → DEMO → TESTNET PROJECT</span><h2>See what is possible.<br />Then deploy your version.</h2><p>Every demo explains the idea, shows how it works and opens a guided build for Ethereum or Solana.</p></div><div className="build-chain"><button className={activeChain === "ethereum" ? "active" : ""} onClick={() => setActiveChain("ethereum")}>Ξ Ethereum<br /><small>Sepolia</small></button><button className={activeChain === "solana" ? "active sol" : "sol"} onClick={() => setActiveChain("solana")}>S Solana<br /><small>Devnet</small></button></div></section>
              <div className="build-demo-grid">{buildDemos.map((demo) => <article className="build-demo card" key={demo.title}><span>{demo.icon}</span><div><small>{demo.level} · {demo.chain}</small><h3>{demo.title}</h3><p>{demo.copy}</p></div><button onClick={() => notify(`${demo.title} demo opened with Mask guidance`)}>View demo →</button></article>)}</div>
              <section className="guided-builder"><div className="creator-copy"><span className="eyebrow">GUIDED BUILD · ORIGINAL ART</span><h2>Turn an idea into an onchain object.</h2><p>Create a testnet collection, mint original work and decide how many editions should exist.</p><div className="creator-note"><b>Sandbox rules</b><span>Only upload work you created.</span><span>Everything is marked testnet.</span><span>An educator reviews it before listing.</span></div></div>
              <form className="creator-form card" onSubmit={createCollection}>
                <div className="form-head"><span><b>NEW COLLECTION</b><small>Step 1 of 3 · The idea</small></span><em>{activeChain === "ethereum" ? "SEPOLIA" : "SOLANA DEVNET"}</em></div>
                <label>Collection name<input required placeholder="e.g. Campus Signals" /></label>
                <label>Creator story<textarea required placeholder="What inspired the work? What should a collector understand?" /></label>
                <div className="form-row"><label>Symbol<input required placeholder="SIGNAL" maxLength={8} /></label><label>Edition size<input required type="number" min="1" max="25" defaultValue="3" /></label></div>
                <label className="upload-box"><input type="file" accept="image/*" onChange={handleArt} /><span>{artPreview ? <img src={artPreview} alt="Artwork preview" /> : <><b>＋</b><strong>Upload first artwork</strong><small>PNG, JPG or WebP · original work only</small></>}</span></label>
                <button className="primary full" type="submit">Create draft collection →</button>
                {created && <div className="success-box"><b>Draft ready</b><span>Your collection is waiting for educator review.</span></div>}
              </form>
              </section>
            </div>
          )}

          {active === "games" && (
            <div className="page-stack">
              <section className="games-hero"><div><span className="eyebrow">FACELESS TESTNET PLAYGROUND</span><h2>Play the concept.<br />Build the next game.</h2><p>Small games make wallets, transactions and smart contracts feel real. Students can play first, then remix the mechanics into their own projects.</p></div><MaskOrb /></section>
              <div className="game-grid">{games.map((game) => <article className={`game-card ${game.color}`} key={game.id}><div className="game-art"><span>{String(game.id).padStart(2, "0")}</span><div className="pixel-track"><i /><i /><i /><b /></div><em>{game.status}</em></div><div className="game-copy"><small>{game.chain}</small><h3>{game.title}</h3><p>{game.copy}</p><div><span>WIN: {game.reward}</span><button onClick={() => notify(game.status === "PLAYABLE" ? `${game.title} started in demo mode` : `${game.title} added to your watchlist`)}>{game.status === "PLAYABLE" ? "Play demo →" : "Notify me"}</button></div></div></article>)}</div>
              <section className="game-builder card"><div><span className="eyebrow">STUDENT GAME LAB</span><h3>Have a game idea?</h3><p>Start from a wallet login, collectible, score or reward mechanic. Mask turns the idea into a build map and suggests whether Ethereum or Solana fits better.</p></div><button onClick={() => setActive("mask")}>Design it with Mask →</button></section>
            </div>
          )}

          {active === "tools" && (
            <div className="page-stack">
              <section className="tools-hero">
                <div><span className="eyebrow">CREATOR TOOLS</span><h2>Learn the craft.<br />Make better content.</h2><p>Simple, phone-first guidance for turning an idea or brief into content you can confidently publish.</p><button className="primary" onClick={() => setActive("mask")}>Plan with Mask →</button></div>
                <div className="tools-flow" aria-label="Creator workflow"><span><b>01</b>Understand</span><span><b>02</b>Script</span><span><b>03</b>Shoot</span><span><b>04</b>Edit</span></div>
              </section>
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
              <div className="campaign-toolbar"><div><button className="active">All missions</button><button>Creator</button><button>Faceless</button><button>Clipper</button><button>User acquisition</button></div><label>⌕<input placeholder="Search campaigns or brands…" aria-label="Search campaigns" /></label></div>
              <div className="campaign-grid">
                {campaigns.map((campaign) => <article className={`campaign-card ${campaign.tone}`} key={campaign.id}>
                  <div className="campaign-brand"><span>{campaign.brand.slice(0, 2).toUpperCase()}</span><div><small>{campaign.category} · {campaign.platform}</small><b>{campaign.brand}</b></div><em>LIVE</em></div>
                  <h3>{campaign.title}</h3><p>{campaign.brief}</p>
                  <div className="campaign-tags"><span>{campaign.type}</span><span>{campaign.places}</span></div>
                  <div className="campaign-reward"><span><small>REWARD</small><strong>{campaign.reward}</strong></span><button onClick={() => claimCampaign(campaign.id)}>{claimedCampaigns.includes(campaign.id) ? "In workspace ✓" : "View mission →"}</button></div>
                </article>)}
              </div>
              <section className="campaign-mask card"><MaskOrb compact /><div><span className="eyebrow">MASK CAMPAIGN ASSIST</span><h3>Never face a confusing brief alone.</h3><p>Mask can explain the rules, suggest a hook, build a shot list and check your submission before it reaches the reviewer.</p></div><button onClick={() => setActive("mask")}>Plan with Mask →</button></section>
            </div>
          )}

          {active === "launchpad" && (
            <div className="page-stack">
              <section className="launch-hero"><div><span className="eyebrow">STUDENT LAUNCHPAD · ETHEREUM + SOLANA</span><h2>Practise safely.<br />Launch when ready.</h2><p>Original student work begins on testnet. Mainnet publishing unlocks only after a successful practice launch and educator review.</p></div><img src="/faceless-cast.png" alt="Faceless character cast" /></section>
              <div className="launch-mode-switch" role="group" aria-label="Launch network"><button className={launchMode === "testnet" ? "active" : ""} onClick={() => setLaunchMode("testnet")}><b>Testnet studio</b><small>Free practice · classroom wallets</small></button><button className={launchMode === "mainnet" ? "active" : ""} onClick={() => setLaunchMode("mainnet")}><b>Mainnet launch</b><small>Real fees · educator-gated</small></button></div>
              {launchMode === "mainnet" && <section className="mainnet-gate card"><div><span className="gate-mark">✓</span><div><span className="eyebrow">SUPERVISED MAINNET PATH</span><h3>Prove the launch before paying real fees.</h3><p>Complete wallet safety, publish the collection on testnet, verify ownership and request an educator review. A final wallet confirmation is always required.</p></div></div><ol><li><span>1</span>Safety lesson</li><li><span>2</span>Test launch</li><li><span>3</span>Ownership check</li><li><span>4</span>Educator review</li></ol><button onClick={() => notify("Mainnet review request added to the educator queue")}>Request mainnet review →</button><small>No custodial mainnet wallet is created automatically. Students connect an external wallet and approve real fees themselves.</small></section>}
              <div className="market-toolbar"><div><button className="active">All work</button><button>1 of 1</button><button>Open editions</button><button>New collections</button></div><button className="sort">Newest first⌄</button></div>
              <div className="market-grid">
                {marketItems.map((item, index) => <article className="market-card" key={item.id}><div className="market-image"><img src={item.image} alt={item.title} /><span>{item.tag} · {index === 1 ? "SOL" : "ETH"}</span></div><div className="market-meta"><div><h3>{item.title}</h3><p>by {item.creator}</p></div><span><small>{launchMode === "testnet" ? "TEST PRICE" : "DISPLAY PRICE"}</small><b>{index === 1 ? "0.12 SOL" : `${item.price} Ξ`}</b></span></div><button onClick={() => notify(launchMode === "testnet" ? `${item.title} added to your testnet collection` : `${item.title} requires wallet confirmation and a real network fee`)}>{launchMode === "testnet" ? `Collect on ${index === 1 ? "Solana" : "Sepolia"}` : "Review mainnet checkout"}</button></article>)}
                <article className="market-card upcoming"><div><span>＋</span><h3>Your work could be here.</h3><p>Complete the Creator Studio quest to launch.</p><button onClick={() => setActive("create")}>Start creating</button></div></article>
              </div>
            </div>
          )}

          {active === "passport" && (
            <div className="page-stack">
              <section className="passport-hero">
                <div className="passport-identity"><span className="profile-dot large">{initials}</span><div><span className="eyebrow">FACELESS STUDENT PASSPORT</span><h2>{displayName}</h2><p>Creator · Builder · Cohort 04</p></div></div>
                <div className="passport-wallet"><small>MULTICHAIN CLASSROOM IDENTITY</small>{campusUsername && <strong>@{campusUsername}</strong>}<strong>{ethWallet}</strong><strong>{solWallet}</strong><span><i /> Sepolia + Solana Devnet ready</span></div>
              </section>
              <div className="passport-metrics"><article><strong>02</strong><span>Lessons completed</span></article><article><strong>03</strong><span>Onchain actions</span></article><article><strong>{claimedCampaigns.length.toString().padStart(2, "0")}</strong><span>Campaigns joined</span></article><article><strong>{headClaimed ? "03" : "02"}</strong><span>Assets collected</span></article></div>
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
              <section className="page-intro"><div><span className="eyebrow">GUESTS × STUDENTS × ONCHAIN PROOF</span><h2>Partner drops</h2><p>Claim a badge after completing an approved session or classroom activity.</p></div><button className="secondary" onClick={() => notify("Partner campaign preview opened")}>Preview partner mode</button></section>
              <div className="drop-grid">{drops.map((drop) => <article className={`drop-card ${drop.tone}`} key={drop.id}><div className="drop-art"><span className="drop-glow" /><MaskOrb compact /><b>{drop.id.toString().padStart(2, "0")}</b></div><div><span className="eyebrow">VERIFIED SESSION DROP</span><h3>{drop.title}</h3><p>{drop.host}</p><div className="drop-supply"><span><i style={{ width: `${(drop.claimed / drop.supply) * 100}%` }} /></span><small>{drop.claimed} / {drop.supply} claimed</small></div><button onClick={() => claimDrop(drop.id)}>{claimedDrops.includes(drop.id) ? "Claimed ✓" : "Claim badge"}</button></div></article>)}</div>
            </div>
          )}

          {active === "admin" && (
            <div className="page-stack">
              <section className="admin-banner"><div><span className="eyebrow">EDUCATOR CONTROL ROOM</span><h2>Faceless Campus Cohort 04</h2><p>Lessons, Ethereum and Solana activity, games, projects and creator campaigns in one private view.</p></div><button onClick={() => notify("Class report prepared for review")}>Generate class report</button></section>
              <section className="faucet-admin card">
                <div className="faucet-admin-head"><div><span className="eyebrow">CAMPUS FAUCET CONTROL</span><h3>Fund once. Let verified students claim.</h3><p>The distributor wallets are testnet-only and managed by Privy. Campus OS stores no wallet private keys.</p></div><button onClick={prepareFaucetWallets} disabled={faucetBusy === "prepare" || faucetState?.chains.every((item) => item.configured)}>{faucetBusy === "prepare" ? "Preparing…" : faucetState?.chains.every((item) => item.configured) ? "Wallets prepared ✓" : "Prepare both wallets"}</button></div>
                <div className="faucet-admin-grid">
                  {(["ethereum", "solana"] as const).map((chain) => {
                    const config = faucetState?.chains.find((item) => item.chain === chain);
                    const draft = faucetDraft[chain];
                    return <article key={chain}>
                      <div className="faucet-chain"><span className={`chain-coin ${chain === "ethereum" ? "eth" : "sol"}`}>{chain === "ethereum" ? "Ξ" : "S"}</span><span><small>{chain === "ethereum" ? "SEPOLIA DISTRIBUTOR" : "SOLANA DEVNET DISTRIBUTOR"}</small><b>{config?.distributorAddress ? shortenAddress(config.distributorAddress) : "Not prepared"}</b></span>{config?.distributorAddress && <button className="mini-copy" onClick={() => navigator.clipboard.writeText(config.distributorAddress || "").then(() => notify("Distributor address copied"))}>Copy</button>}</div>
                      <label>Amount per claim<input inputMode="decimal" value={draft.amount} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], amount: event.target.value } }))} /></label>
                      <label>Claims per student<select value={draft.maxClaims} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], maxClaims: Number(event.target.value) } }))}><option value={1}>1 claim</option><option value={2}>2 claims</option><option value={3}>3 claims</option></select></label>
                      <label className="faucet-toggle"><input aria-label={`Open ${chain === "ethereum" ? "Sepolia" : "Solana Devnet"} student claims`} type="checkbox" checked={draft.enabled} onChange={(event) => setFaucetDraft((current) => ({ ...current, [chain]: { ...current[chain], enabled: event.target.checked } }))} /><span><b>Open student claims</b><small>Only enable after loading test funds.</small></span></label>
                      <button className="save-faucet" disabled={!config?.configured || faucetBusy === chain} onClick={() => saveFaucetConfig(chain)}>{faucetBusy === chain ? "Saving…" : "Save settings"}</button>
                    </article>;
                  })}
                </div>
                {faucetError && <div className="faucet-message admin">{faucetError}</div>}
                {!faucetState?.signerReady && <small className="activation-note">One secure activation step remains before distributor wallets can be prepared.</small>}
              </section>
              <div className="metric-grid"><div className="metric"><small>ACTIVE STUDENTS</small><strong>{learningState?.cohort?.activeStudents ?? 0}</strong><span>Verified Campus profiles</span></div><div className="metric"><small>LESSONS COMPLETED</small><strong>{learningState?.cohort?.lessonsCompleted ?? 0}</strong><span>Across all three courses</span></div><div className="metric"><small>IN PROGRESS</small><strong>{learningState?.cohort?.lessonsInProgress ?? 0}</strong><span>Lessons students can resume</span></div><div className="metric"><small>COURSE COMPLETION</small><strong>{learningState?.cohort?.completionRate ?? 0}%</strong><span>Of all assigned lessons</span></div></div>
              <section className="admin-table card"><div className="section-head"><span><b>STUDENT ACTIVITY</b><small>Private educator record · addresses are public</small></span><div><button>Filter</button><button onClick={() => notify("Wallet list prepared as a private export")}>Export</button></div></div><div className="table-row table-head"><span>Student</span><span>Wallet</span><span>Progress</span><span>Last action</span><span>Status</span></div>{[["Aanya K.", "0x71F4...9A2C", "3 / 7", "NFT claimed", "Active"],["Rohan M.", "0x44B1...18F0", "2 / 7", "ETH received", "Active"],["Meera S.", "0x9DA2...F781", "5 / 7", "Collection draft", "Review"],["Team Orbit", "0xA621...3C09", "6 / 7", "Asset listed", "Active"]].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={["Student","Wallet","Progress","Last action","Status"][i]} className={i === 4 ? `status ${cell.toLowerCase()}` : ""}>{cell}</span>)}</div>)}</section>
            </div>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.filter((item) => ["home", "learn", "mask", "tools", "campaigns"].includes(item.id)).map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.mark}</span>{item.id === "tools" ? "Tools" : item.label.split(" ")[0]}</button>)}</nav>
      </section>

      {!onboarded && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <div className="onboarding-art"><div className="portal-ring one" /><div className="portal-ring two" /><MaskOrb /><span>ETHEREUM<br />+ SOLANA<br />CLASSROOM</span></div>
            <div className="onboarding-copy"><span className="eyebrow">FACELESS CAMPUS OS</span><h2>Learn. Build. Play.<br />Create. Earn.</h2><p>One profile for 25 lessons, the real live-session Mask, Ethereum and Solana practice, project demos, games and creator campaigns.</p><label className="username-field"><span>CHOOSE YOUR CAMPUS USERNAME</span><div><b>@</b><input value={username} onChange={(event) => { setUsername(event.target.value); setProfileError(""); }} maxLength={24} autoComplete="username" aria-label="Campus username" disabled={profileStatus === "saving"} /></div><small>Friends will use this name to send you classroom assets.</small></label>{profileError && <div className="profile-error">{profileError}</div>}<button className="google-button" onClick={enterLab} disabled={!privyReady || loading || profileStatus === "saving"}><span>{authenticated ? "✓" : "G"}</span>{!privyReady ? "Loading secure sign-in…" : loading ? "Opening Google…" : profileStatus === "saving" ? "Securing both wallets…" : authenticated ? "Save campus username" : "Continue with Google"}</button><button className="demo-link" onClick={() => setDemoMode(true)}>Explore the student demo</button><small>Google sign-in creates user-controlled Ethereum and Solana wallets through Privy. Faceless never stores private keys.</small></div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
