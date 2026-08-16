"use client";

import { ChangeEvent, useMemo, useState } from "react";
import LiveMask from "./LiveMask";

type Tab = "home" | "learn" | "mask" | "wallet" | "create" | "games" | "campaigns" | "launchpad" | "passport" | "drops" | "admin";
type Course = "blockchain" | "bitcoin" | "ethereum";
type Chain = "ethereum" | "solana";
type Lesson = { id: number; title: string; copy: string; time: string; unit: string; state: string; action: string; video?: string; course: Course };

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
  { id: "learn", label: "Learn", mark: "▶" },
  { id: "mask", label: "Ask Mask", mark: "M" },
  { id: "create", label: "Build lab", mark: "+" },
  { id: "games", label: "Playground", mark: "◆" },
  { id: "campaigns", label: "Create & earn", mark: "◎" },
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
  { id: 1, title: "What is USDT?", copy: "Why a digital dollar token is useful for moving value online.", time: "1 min", unit: "MONEY", state: "complete", action: "Compare digital money", course: "blockchain" },
  { id: 2, title: "How P2P works", copy: "Understand peer-to-peer exchange, escrow and safety checks.", time: "1 min", unit: "MONEY", state: "open", action: "Walk through P2P", course: "blockchain" },
  { id: 3, title: "What is blockchain?", copy: "A shared record that many computers can verify together.", time: "1 min", unit: "FOUNDATIONS", state: "open", action: "Build a class ledger", course: "blockchain" },
];

const bitcoinLessons: Lesson[] = [
  { id: 1, title: "Bitcoin recap", copy: "Review money, ledgers, mining, supply and transactions.", time: "1 min", unit: "RECAP", state: "complete", action: "Take the recap", course: "bitcoin", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3ce71d95-f2ac-46b0-9dee-0507d6b7aebc-bitcoin-recap-v1-faceless-approved.mp4" },
  { id: 2, title: "Bitcoin money transfer", copy: "How value moves directly between Bitcoin wallets.", time: "1 min", unit: "TRANSACTIONS", state: "open", action: "Trace a transfer", course: "bitcoin" },
  { id: 3, title: "Satoshi and the beginning", copy: "Why Bitcoin was created and how the network began.", time: "1 min", unit: "ORIGINS", state: "open", action: "Open the first block", course: "bitcoin" },
  { id: 4, title: "Bitcoin mining", copy: "How miners compete to add valid blocks and protect the ledger.", time: "1 min", unit: "NETWORK", state: "open", action: "Simulate mining", course: "bitcoin" },
  { id: 5, title: "Bitcoin's fixed supply", copy: "Why the protocol limits supply to 21 million bitcoin.", time: "1 min", unit: "SUPPLY", state: "open", action: "Explore issuance", course: "bitcoin" },
  { id: 6, title: "Bitcoin Pizza Day", copy: "The famous early purchase that showed bitcoin could be spent.", time: "1 min", unit: "HISTORY", state: "open", action: "Follow the timeline", course: "bitcoin" },
  { id: 7, title: "Bitcoin transaction speed", copy: "Blocks, confirmations and why settlement takes time.", time: "1 min", unit: "TRANSACTIONS", state: "open", action: "Watch confirmations", course: "bitcoin" },
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
  { number: "01", title: "Shoot a strong Reel", copy: "Framing, light, B-roll, clean audio and the five-shot minimum.", action: "Open shooting guide" },
  { number: "02", title: "Clip long content", copy: "Find the hook, remove dead space, add context and format for vertical video.", action: "Start clipping lab" },
  { number: "03", title: "Hook and script lab", copy: "Turn a campaign brief into a first line, structure and call to action.", action: "Draft with Mask" },
  { number: "04", title: "Edit and subtitle", copy: "Pacing, captions, music, safe zones and a final quality checklist.", action: "View edit checklist" },
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

export default function OnchainLab() {
  const [active, setActive] = useState<Tab>("home");
  const [onboarded, setOnboarded] = useState(false);
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
  const [maskAnswer, setMaskAnswer] = useState("Ask me anything about the lesson. I’ll use the approved Faceless material and point you to the next activity.");
  const [claimedCampaigns, setClaimedCampaigns] = useState<number[]>([]);

  const ethWallet = "0x71F4...9A2C";
  const solWallet = "8maZ...xQ7P";
  const wallet = activeChain === "ethereum" ? ethWallet : solWallet;
  const completed = 2 + (headClaimed ? 1 : 0);
  const progress = Math.round((completed / 7) * 100);

  const title = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Home", [active]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function enterLab() {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setOnboarded(true);
      notify("Ethereum and Solana classroom wallets created");
    }, 900);
  }

  function claimFaucet() {
    if (activeChain === "ethereum") {
      if (balance > 0) return notify("Sepolia faucet already claimed");
      setBalance(0.05);
      return notify("0.05 Sepolia ETH added to your Ethereum wallet");
    }
    if (solBalance > 0) return notify("Solana Devnet faucet already claimed");
    setSolBalance(2);
    notify("2 Devnet SOL added to your Solana wallet");
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
    setActive("learn");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseCourse(course: Course) {
    setSelectedCourse(course);
    setSelectedLesson(lessonTracks[course][0]);
  }

  function askMask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = maskQuestion.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    let answer = `In “${selectedLesson.title}”, the key idea is: ${selectedLesson.copy} Your next step is the ${selectedLesson.action.toLowerCase()} guided activity using test assets only.`;
    if (lower.includes("gas")) answer = "Gas is the network fee paid for Ethereum to process work. Simple transfers generally use less gas than complex smart-contract actions, and the price rises when demand for block space is high. Open Lesson 7 to see the approved explainer.";
    if (lower.includes("nft")) answer = "An NFT is a unique token that can act as a public digital certificate. It can show the issuer, current owner and transfer history—but it does not stop an image from being copied. Open Lesson 9, then claim your testnet Faceless Head.";
    if (lower.includes("solana") || lower.includes("sol")) answer = "Use Solana Devnet for fast wallet, token, collectible, loyalty and game experiments. It uses test SOL with no real value. Phantom can be connected later, while the classroom wallet keeps onboarding simple.";
    if (lower.includes("bitcoin")) answer = "Bitcoin is the first course in the ownership and public-ledger journey. Start with money transfer, Satoshi, mining and fixed supply; then compare Bitcoin’s specialised network with Ethereum and Solana applications.";
    if (lower.includes("clip") || lower.includes("shoot") || lower.includes("content")) answer = "Start with the campaign goal, find one clear hook, capture at least five useful shots, keep the edit vertical and fast, add readable subtitles, then check every claim against the brief before posting.";
    if (lower.includes("real") || lower.includes("money") || lower.includes("risk")) answer = "Everything in the classroom wallet and game flows uses Sepolia or Solana Devnet and has no real monetary value. Mask can explain and guide, but you approve every wallet action yourself.";
    setMaskAnswer(answer);
    setMaskQuestion("");
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
          {navItems.map((item) => (
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
          <span className="profile-dot">AK</span>
          <span><strong>Aanya K.</strong><small>Student · Cohort 04</small></span>
          <button aria-label="Profile options">•••</button>
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
                  <button className="primary" onClick={() => setActive("learn")}>Continue your quest <span>→</span></button>
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
                  <span><b>{completed}</b><small>Quests done</small></span>
                  <span><b>03</b><small>Assets owned</small></span>
                  <span><b>02</b><small>Test networks</small></span>
                </div>
              </section>

              <section className="wallet-card card">
                <div className="section-head"><span><b>CLASSROOM WALLET</b><small>{wallet}</small></span><button onClick={() => notify("Wallet address copied")}>Copy</button></div>
                <div className="balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? balance.toFixed(3) : solBalance.toFixed(2)} <span>{activeChain === "ethereum" ? "ETH" : "SOL"}</span></strong><em>Testnet only · no real value</em></div>
                <button className={(activeChain === "ethereum" ? balance : solBalance) ? "secondary claimed" : "secondary"} onClick={claimFaucet}>{(activeChain === "ethereum" ? balance : solBalance) ? "Faucet claimed ✓" : `Claim test ${activeChain === "ethereum" ? "ETH" : "SOL"}`}</button>
              </section>

              <section className="quest-card card">
                <div className="quest-index">02</div>
                <div><span className="eyebrow">ACTIVE QUEST</span><h3>Your first multichain transaction</h3><p>Send a test asset on either chain, then let Mask explain the receipt.</p></div>
                <button onClick={() => setActive("learn")}>Start →</button>
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
                <div><span className="eyebrow">25 APPROVED FACELESS LESSONS</span><h2>Learn the chain.<br />Then use it.</h2><p>Blockchain basics, Bitcoin and Ethereum—connected to Mask and a practical activity.</p></div>
                <button className="lesson-orb" onClick={() => setActive("mask")}><MaskOrb compact /><span>Ask Mask<small>Grounded in this course</small></span></button>
              </section>
              <div className="course-switcher" aria-label="Course tracks">
                {(["blockchain", "bitcoin", "ethereum"] as Course[]).map((course) => <button key={course} className={selectedCourse === course ? "active" : ""} onClick={() => chooseCourse(course)}><span>{course === "blockchain" ? "01" : course === "bitcoin" ? "02" : "03"}</span><b>{course === "blockchain" ? "Blockchain basics" : course === "bitcoin" ? "Bitcoin foundations" : "Ethereum & applications"}</b><small>{lessonTracks[course].length} lessons</small></button>)}
              </div>
              <section className="lesson-player card">
                <div className="video-frame">{selectedLesson.video ? <video key={selectedLesson.video} controls preload="metadata" src={selectedLesson.video}>Your browser does not support video playback.</video> : <div className="mask-video-sync"><MaskOrb /><b>{selectedLesson.title}</b><span>MASK-SYNCED LESSON</span><button onClick={() => notify("Lesson opened from the Mask course library")}>Play lesson ▶</button></div>}<span>APPROVED FACELESS LESSON</span></div>
                <div className="lesson-focus">
                  <span className="eyebrow">LESSON {String(selectedLesson.id).padStart(2, "0")} · {selectedLesson.unit}</span>
                  <h3>{selectedLesson.title}</h3>
                  <p>{selectedLesson.copy}</p>
                  <div className="lesson-actions"><button className="primary" onClick={() => notify(`${selectedLesson.action} opened in guided mode`)}>{selectedLesson.action} →</button><button className="secondary" onClick={() => setActive("mask")}>Ask Mask</button></div>
                  <small>Mask answers from the approved course and can bring you back to the exact lesson.</small>
                </div>
              </section>
              <div className="course-head"><div><span className="eyebrow">CURRENT COURSE</span><h3>{selectedCourse === "blockchain" ? "Blockchain basics" : selectedCourse === "bitcoin" ? "Bitcoin foundations" : "Ethereum & applications"} · {lessonTracks[selectedCourse].length} lessons</h3></div><span>Mask ready</span></div>
              <div className="lesson-library">
                {lessonTracks[selectedCourse].map((lesson) => (
                  <button key={lesson.id} className={selectedLesson.id === lesson.id ? "library-card active" : "library-card"} onClick={() => openLesson(lesson)}>
                    <span className="library-number">{lesson.state === "complete" ? "✓" : String(lesson.id).padStart(2, "0")}</span>
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
                <div className="mask-stage-copy"><span className="eyebrow">YOUR AI CO-HOST</span><h2>Ask Mask.<br /><em>Then do it.</em></h2><p>Questions are answered from the approved Faceless curriculum, with a lesson and safe next action attached.</p></div>
                <div className="mask-stage-orb"><div className="signal-ring ring-one" /><div className="signal-ring ring-two" /><MaskOrb /></div>
              </section>
              <section className="mask-chat card">
                <div className="mask-context"><span><b>COURSE CONTEXT</b><small>{selectedLesson.course.toUpperCase()} · Lesson {selectedLesson.id}</small></span><button onClick={() => setActive("learn")}>{selectedLesson.title} ↗</button></div>
                <div className="chat-answer"><MaskOrb compact /><div><small>MASK</small><p>{maskAnswer}</p></div></div>
                <div className="prompt-chips">{["Why does gas change?", "What makes an NFT unique?", "Is this real money?"].map((prompt) => <button key={prompt} onClick={() => setMaskQuestion(prompt)}>{prompt}</button>)}</div>
                <form className="mask-form" onSubmit={askMask}><input value={maskQuestion} onChange={(event) => setMaskQuestion(event.target.value)} placeholder="Ask about this lesson, either chain or your next activity…" aria-label="Question for Mask" /><button type="submit">Ask Mask →</button></form>
                <small className="prototype-note">Prototype response mode · Mask does not sign wallet transactions.</small>
              </section>
              <section className="mask-tools"><article><span>01</span><b>Understand</b><p>Explain the concept using the lesson you are watching.</p></article><article><span>02</span><b>Create</b><p>Turn the concept into a safe testnet activity.</p></article><article><span>03</span><b>Campaign</b><p>Convert a partner brief into a checklist, hook and script.</p></article></section>
            </div>
          )}

          {active === "wallet" && (
            <div className="page-stack">
              <section className="wallet-hero">
                <div><span className="eyebrow">YOUR MULTICHAIN CLASSROOM IDENTITY</span><h2>{wallet}</h2><p>Practise across Ethereum and Solana. Connect MetaMask or Phantom when you are ready.</p></div>
                <div className="wallet-balance"><small>{activeChain === "ethereum" ? "SEPOLIA BALANCE" : "SOLANA DEVNET BALANCE"}</small><strong>{activeChain === "ethereum" ? `${balance.toFixed(3)} ETH` : `${solBalance.toFixed(2)} SOL`}</strong><button onClick={claimFaucet}>{activeChain === "ethereum" ? (balance ? "Claimed" : "Claim ETH faucet") : (solBalance ? "Claimed" : "Claim SOL faucet")}</button></div>
              </section>
              <div className="dual-wallets"><button className={activeChain === "ethereum" ? "active" : ""} onClick={() => setActiveChain("ethereum")}><span className="chain-coin eth">Ξ</span><span><small>ETHEREUM CLASSROOM WALLET</small><b>{ethWallet}</b><em>{balance.toFixed(3)} test ETH · Sepolia</em></span><strong>Open →</strong></button><button className={activeChain === "solana" ? "active" : ""} onClick={() => setActiveChain("solana")}><span className="chain-coin sol">S</span><span><small>SOLANA CLASSROOM WALLET</small><b>{solWallet}</b><em>{solBalance.toFixed(2)} test SOL · Devnet</em></span><strong>Open →</strong></button></div>
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

          {active === "campaigns" && (
            <div className="page-stack">
              <section className="campaign-hero">
                <div><span className="eyebrow">THE MAIN STUDENT MONETISATION TRACK</span><h2>Learn content.<br />Use it on a real mission.</h2><p>Learn to shoot, clip, script and edit—then choose whether to appear on camera, work faceless or help a partner acquire genuine users.</p><button className="primary" onClick={() => notify("Mask matched you with two beginner-friendly missions")}>Let Mask match me →</button></div>
                <div className="campaign-steps"><span><b>1</b> Claim a campaign</span><span><b>2</b> Create and post</span><span><b>3</b> Get verified and paid</span></div>
              </section>
              <div className="creator-school-head"><div><span className="eyebrow">CREATOR SCHOOL</span><h3>Learn the skill before taking the brief.</h3></div><span>Phone-first · Beginner-friendly</span></div>
              <div className="creator-tool-grid">{creatorTools.map((tool) => <article className="creator-tool card" key={tool.number}><span>{tool.number}</span><h3>{tool.title}</h3><p>{tool.copy}</p><button onClick={() => tool.number === "03" ? setActive("mask") : notify(`${tool.title} opened in guided mode`)}>{tool.action} →</button></article>)}</div>
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
              <section className="launch-hero"><div><span className="eyebrow">STUDENT LAUNCHPAD · ETHEREUM + SOLANA</span><h2>Collected in class.<br />Discovered everywhere.</h2><p>Original student work, launched through supervised multichain labs.</p></div><img src="/faceless-cast.png" alt="Faceless character cast" /></section>
              <div className="market-toolbar"><div><button className="active">All work</button><button>1 of 1</button><button>Open editions</button><button>New collections</button></div><button className="sort">Newest first⌄</button></div>
              <div className="market-grid">
                {marketItems.map((item, index) => <article className="market-card" key={item.id}><div className="market-image"><img src={item.image} alt={item.title} /><span>{item.tag} · {index === 1 ? "SOL" : "ETH"}</span></div><div className="market-meta"><div><h3>{item.title}</h3><p>by {item.creator}</p></div><span><small>TEST PRICE</small><b>{index === 1 ? "0.12 SOL" : `${item.price} Ξ`}</b></span></div><button onClick={() => notify(`${item.title} added to your testnet collection`)}>Collect on {index === 1 ? "Solana" : "Sepolia"}</button></article>)}
                <article className="market-card upcoming"><div><span>＋</span><h3>Your work could be here.</h3><p>Complete the Creator Studio quest to launch.</p><button onClick={() => setActive("create")}>Start creating</button></div></article>
              </div>
            </div>
          )}

          {active === "passport" && (
            <div className="page-stack">
              <section className="passport-hero">
                <div className="passport-identity"><span className="profile-dot large">AK</span><div><span className="eyebrow">FACELESS STUDENT PASSPORT</span><h2>Aanya K.</h2><p>Creator · Builder · Cohort 04</p></div></div>
                <div className="passport-wallet"><small>MULTICHAIN CLASSROOM IDENTITY</small><strong>{ethWallet}</strong><strong>{solWallet}</strong><span><i /> Sepolia + Solana Devnet ready</span></div>
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
              <div className="metric-grid"><div className="metric"><small>ENROLLED</small><strong>128</strong><span>+18 today</span></div><div className="metric"><small>WALLETS CREATED</small><strong>121</strong><span>94.5% ready</span></div><div className="metric"><small>FAUCET CLAIMS</small><strong>109</strong><span>5.45 test ETH</span></div><div className="metric"><small>QUESTS COMPLETED</small><strong>387</strong><span>3.0 per student</span></div></div>
              <section className="admin-table card"><div className="section-head"><span><b>STUDENT ACTIVITY</b><small>Private educator record · addresses are public</small></span><div><button>Filter</button><button onClick={() => notify("Wallet list prepared as a private export")}>Export</button></div></div><div className="table-row table-head"><span>Student</span><span>Wallet</span><span>Progress</span><span>Last action</span><span>Status</span></div>{[["Aanya K.", "0x71F4...9A2C", "3 / 7", "NFT claimed", "Active"],["Rohan M.", "0x44B1...18F0", "2 / 7", "ETH received", "Active"],["Meera S.", "0x9DA2...F781", "5 / 7", "Collection draft", "Review"],["Team Orbit", "0xA621...3C09", "6 / 7", "Asset listed", "Active"]].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={["Student","Wallet","Progress","Last action","Status"][i]} className={i === 4 ? `status ${cell.toLowerCase()}` : ""}>{cell}</span>)}</div>)}</section>
            </div>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 5).map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.mark}</span>{item.label.split(" ")[0]}</button>)}</nav>
      </section>

      {!onboarded && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <div className="onboarding-art"><div className="portal-ring one" /><div className="portal-ring two" /><MaskOrb /><span>ETHEREUM<br />+ SOLANA<br />CLASSROOM</span></div>
            <div className="onboarding-copy"><span className="eyebrow">FACELESS CAMPUS OS</span><h2>Learn. Build. Play.<br />Create. Earn.</h2><p>One profile for 25 lessons, the real live-session Mask, Ethereum and Solana practice, project demos, games and creator campaigns.</p><button className="google-button" onClick={enterLab} disabled={loading}><span>G</span>{loading ? "Preparing both classroom wallets…" : "Continue with Google"}</button><button className="demo-link" onClick={() => setOnboarded(true)}>Explore the student demo</button><small>Prototype only · Google sign-in, wallets, campaign rewards and onchain actions are simulated.</small></div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
