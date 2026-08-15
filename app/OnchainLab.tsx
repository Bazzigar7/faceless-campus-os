"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Tab = "home" | "learn" | "mask" | "wallet" | "create" | "campaigns" | "launchpad" | "passport" | "drops" | "admin";

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
  { id: "create", label: "Build", mark: "+" },
  { id: "campaigns", label: "Campaigns", mark: "◎" },
  { id: "launchpad", label: "Launchpad", mark: "↗" },
  { id: "passport", label: "My passport", mark: "◇" },
  { id: "admin", label: "Educator view", mark: "▦" },
];

const lessons = [
  { id: 1, title: "Meet Ethereum", copy: "A shared computer for money, ownership and applications.", time: "0:58", unit: "FOUNDATIONS", state: "complete", action: "Explore the network", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/bc1b33b9-875b-4fb0-9c83-9664a979f699-meet-ethereum-v2-faceless-approved.mp4" },
  { id: 2, title: "Smart contracts", copy: "Rules that execute when their conditions are met.", time: "0:58", unit: "FOUNDATIONS", state: "active", action: "Read a contract", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3df30db4-89ad-4dd7-b34e-6ee44b79e923-ethereum-smart-contracts-v5-faceless-approved.mp4" },
  { id: 3, title: "Tokenising a watch", copy: "How rules and ownership shares can move onchain.", time: "1:01", unit: "TOKENISATION", state: "open", action: "Create asset shares", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/8cc08734-a79f-4930-b5d3-cb83c38125a1-ethereum-rwa-watch-v6-faceless-approved.mp4" },
  { id: 4, title: "Tokenising a building", copy: "A hypothetical look at rights, rent and smaller shares.", time: "1:20", unit: "TOKENISATION", state: "open", action: "Model a building", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/e37d1f22-ddaa-460f-910e-e87193a6b4b7-ethereum-rwa-building-v2-faceless-approved.mp4" },
  { id: 5, title: "Transaction confirmation", copy: "Follow an Ethereum payment from wallet to confirmation.", time: "1:04", unit: "NETWORK", state: "open", action: "Send test ETH", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/5554e138-d284-4fa4-8330-4a1aef84533a-ethereum-tx-confirmation-v1-faceless-approved.mp4" },
  { id: 6, title: "Validators and Proof of Stake", copy: "Who builds blocks, who checks them and why honesty matters.", time: "0:43", unit: "NETWORK", state: "open", action: "Inspect a validator", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/2cb946d3-37b0-4d7b-a6fa-4e0d292a629c-ethereum-validators-pos-v1-faceless-approved.mp4" },
  { id: 7, title: "Ethereum gas", copy: "Why network work has a fee and why that fee changes.", time: "0:45", unit: "NETWORK", state: "open", action: "Compare gas", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/eb6e5f6a-24b4-41d7-8eec-35a357810e96-ethereum-gas-v3-faceless-approved.mp4" },
  { id: 8, title: "Ethereum supply", copy: "Validator rewards add ETH while base-fee burning removes it.", time: "0:49", unit: "NETWORK", state: "open", action: "View supply", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/0edb1abc-9984-4d8e-8c51-bb9be3f11281-ethereum-supply-v2-faceless-approved.mp4" },
  { id: 9, title: "What is an NFT?", copy: "A unique token that can act as a digital certificate.", time: "0:54", unit: "NFTS", state: "open", action: "Claim your head", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/314cb8a5-e80f-483c-88df-b539da820885-ethereum-nft-basics-v3-faceless-approved.mp4" },
  { id: 10, title: "Art and provenance", copy: "See the issuer, current owner and transfer history.", time: "0:52", unit: "NFTS", state: "open", action: "Mint original art", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/caf33a70-a613-44ec-b0c1-c2e8ef8b7e9f-ethereum-nft-art-provenance-v2-faceless-approved.mp4" },
  { id: 11, title: "A car's digital certificate", copy: "Link official records to a vehicle's ownership history.", time: "0:54", unit: "NFTS", state: "open", action: "View certificate", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/8ab52189-adbe-4a34-9373-6a81de53169a-ethereum-nft-car-certificate-v4-faceless-approved.mp4" },
  { id: 12, title: "Product authenticity", copy: "How official issuers and secure tags can help prove origin.", time: "0:58", unit: "NFTS", state: "open", action: "Verify a product", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/48ed2355-cce5-4836-a3d0-471f5551361d-ethereum-nft-product-authenticity-v1-faceless-approved.mp4" },
  { id: 13, title: "Borrow without selling ETH", copy: "Understand collateral, interest and liquidation risk.", time: "0:59", unit: "DEFI", state: "open", action: "Simulate a loan", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/3ff1e0a9-a6d2-4699-80d3-c7005c265227-ethereum-defi-borrow-without-selling-v1-faceless-approved.mp4" },
  { id: 14, title: "Bank vs smart contract", copy: "Compare traditional finance routes with published DeFi rules.", time: "1:00", unit: "DEFI", state: "open", action: "Compare the routes", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/6cc53850-b5d3-4950-83a7-c0801475df67-ethereum-defi-bank-vs-contract-v1-faceless-approved.mp4" },
  { id: 15, title: "Token swaps and liquidity pools", copy: "How shared pools let a wallet exchange one token for another.", time: "1:06", unit: "DEFI", state: "open", action: "Try a test swap", video: "https://zwmraqkjvpqnafdfgkiz.supabase.co/storage/v1/object/public/assets/9913f480-3109-4b59-a1c1-e777308856f9-ethereum-defi-token-swap-v1-faceless-approved.mp4" },
];

const campaigns = [
  { id: 1, brand: "Sticksy", title: "Campus café experience", type: "Creator", category: "Food & Drink", platform: "Instagram", reward: "₹500", places: "18 spots", tone: "coral", brief: "Visit, film the experience and publish an original Reel." },
  { id: 2, brand: "RKS Builders", title: "Property walkthrough", type: "Faceless Creator", category: "Real Estate", platform: "Instagram", reward: "₹750", places: "8 spots", tone: "blue", brief: "Create a voiceover walkthrough using approved property footage." },
  { id: 3, brand: "Web3 Partner", title: "Explain one wallet feature", type: "Clipper", category: "Crypto", platform: "YouTube", reward: "$12", places: "24 spots", tone: "violet", brief: "Turn the supplied session into one accurate vertical explainer." },
  { id: 4, brand: "Campus App", title: "Bring your first five users", type: "User Acquisition", category: "Technology", platform: "Referral", reward: "₹300", places: "40 spots", tone: "green", brief: "Share your tracked link and help five genuine students onboard." },
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
    <div className={compact ? "mask-orb compact" : "mask-orb"} aria-label="Mask AI co-host">
      <div className="mask-eye left" />
      <div className="mask-eye right" />
      <div className="mask-mouth" />
    </div>
  );
}

export default function OnchainLab() {
  const [active, setActive] = useState<Tab>("home");
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [headClaimed, setHeadClaimed] = useState(false);
  const [toast, setToast] = useState("");
  const [drops, setDrops] = useState(initialDrops);
  const [claimedDrops, setClaimedDrops] = useState<number[]>([]);
  const [created, setCreated] = useState(false);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState(lessons[1]);
  const [maskQuestion, setMaskQuestion] = useState("");
  const [maskAnswer, setMaskAnswer] = useState("Ask me anything about the lesson. I’ll use the approved Faceless material and point you to the next activity.");
  const [claimedCampaigns, setClaimedCampaigns] = useState<number[]>([]);

  const wallet = "0x71F4...9A2C";
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
      notify("Classroom wallet created on Sepolia");
    }, 900);
  }

  function claimFaucet() {
    if (balance > 0) return notify("This classroom faucet has already been claimed");
    setBalance(0.05);
    notify("0.05 Sepolia ETH added to your classroom wallet");
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

  function openLesson(lesson: typeof lessons[number]) {
    setSelectedLesson(lesson);
    setActive("learn");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function askMask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = maskQuestion.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    let answer = `In “${selectedLesson.title}”, the key idea is: ${selectedLesson.copy} Your safest next step is the ${selectedLesson.action.toLowerCase()} classroom activity on Sepolia.`;
    if (lower.includes("gas")) answer = "Gas is the network fee paid for Ethereum to process work. Simple transfers generally use less gas than complex smart-contract actions, and the price rises when demand for block space is high. Open Lesson 7 to see the approved explainer.";
    if (lower.includes("nft")) answer = "An NFT is a unique token that can act as a public digital certificate. It can show the issuer, current owner and transfer history—but it does not stop an image from being copied. Open Lesson 9, then claim your testnet Faceless Head.";
    if (lower.includes("real") || lower.includes("money") || lower.includes("risk")) answer = "Everything in this classroom flow is marked Sepolia testnet and has no real monetary value. Mask can explain and guide, but you approve every wallet action yourself.";
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
          <strong>Ethereum · 15 lessons</strong>
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
            <span className="network-pill"><i /> SEPOLIA TESTNET</span>
            <button className="wallet-pill" onClick={() => setActive("wallet")}><span>◇</span> {wallet}</button>
          </div>
        </header>

        <div className="content-area">
          {active === "home" && (
            <div className="dashboard-grid">
              <section className="hero-panel">
                <div className="hero-copy">
                  <span className="eyebrow">ETHEREUM LAB · LIVE PATH</span>
                  <h2>Learn it. Do it.<br /><em>See it onchain.</em></h2>
                  <p>Mask turns every concept into a real Sepolia action—without risking real money.</p>
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
                <div className="section-head"><span><b>YOUR PROGRESS</b><small>Ethereum foundations</small></span><strong>{progress}%</strong></div>
                <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
                <div className="progress-stats">
                  <span><b>{completed}</b><small>Quests done</small></span>
                  <span><b>03</b><small>Assets owned</small></span>
                  <span><b>02</b><small>Transactions</small></span>
                </div>
              </section>

              <section className="wallet-card card">
                <div className="section-head"><span><b>CLASSROOM WALLET</b><small>{wallet}</small></span><button onClick={() => notify("Wallet address copied")}>Copy</button></div>
                <div className="balance"><small>TEST BALANCE</small><strong>{balance.toFixed(3)} <span>ETH</span></strong><em>Sepolia only · no real value</em></div>
                <button className={balance ? "secondary claimed" : "secondary"} onClick={claimFaucet}>{balance ? "Faucet claimed ✓" : "Claim classroom ETH"}</button>
              </section>

              <section className="quest-card card">
                <div className="quest-index">02</div>
                <div><span className="eyebrow">ACTIVE QUEST</span><h3>Your first transaction</h3><p>Send test ETH to a classmate, then let Mask explain the receipt.</p></div>
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
                <div><span className="eyebrow">15 APPROVED VIDEO EXPLAINERS</span><h2>Ethereum foundations</h2><p>Watch a concept, ask Mask about it, then complete the matching activity.</p></div>
                <button className="lesson-orb" onClick={() => setActive("mask")}><MaskOrb compact /><span>Ask Mask<small>Grounded in this course</small></span></button>
              </section>
              <section className="lesson-player card">
                <div className="video-frame"><video key={selectedLesson.video} controls preload="metadata" src={selectedLesson.video}>Your browser does not support video playback.</video><span>APPROVED FACELESS LESSON</span></div>
                <div className="lesson-focus">
                  <span className="eyebrow">LESSON {String(selectedLesson.id).padStart(2, "0")} · {selectedLesson.unit}</span>
                  <h3>{selectedLesson.title}</h3>
                  <p>{selectedLesson.copy}</p>
                  <div className="lesson-actions"><button className="primary" onClick={() => notify(`${selectedLesson.action} opened in guided mode`)}>{selectedLesson.action} →</button><button className="secondary" onClick={() => setActive("mask")}>Ask Mask</button></div>
                  <small>Mask answers from the approved course and can bring you back to the exact lesson.</small>
                </div>
              </section>
              <div className="course-head"><div><span className="eyebrow">FULL COURSE</span><h3>15 lessons · 4 modules</h3></div><span>2 complete</span></div>
              <div className="lesson-library">
                {lessons.map((lesson) => (
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
                <div className="mask-context"><span><b>COURSE CONTEXT</b><small>Ethereum · Lesson {selectedLesson.id}</small></span><button onClick={() => setActive("learn")}>{selectedLesson.title} ↗</button></div>
                <div className="chat-answer"><MaskOrb compact /><div><small>MASK</small><p>{maskAnswer}</p></div></div>
                <div className="prompt-chips">{["Why does gas change?", "What makes an NFT unique?", "Is this real money?"].map((prompt) => <button key={prompt} onClick={() => setMaskQuestion(prompt)}>{prompt}</button>)}</div>
                <form className="mask-form" onSubmit={askMask}><input value={maskQuestion} onChange={(event) => setMaskQuestion(event.target.value)} placeholder="Ask about Ethereum, this lesson or your next activity…" aria-label="Question for Mask" /><button type="submit">Ask Mask →</button></form>
                <small className="prototype-note">Prototype response mode · Mask does not sign wallet transactions.</small>
              </section>
              <section className="mask-tools"><article><span>01</span><b>Understand</b><p>Explain the concept using the lesson you are watching.</p></article><article><span>02</span><b>Create</b><p>Turn the concept into a safe testnet activity.</p></article><article><span>03</span><b>Campaign</b><p>Convert a partner brief into a checklist, hook and script.</p></article></section>
            </div>
          )}

          {active === "wallet" && (
            <div className="page-stack">
              <section className="wallet-hero">
                <div><span className="eyebrow">YOUR CLASSROOM WALLET</span><h2>{wallet}</h2><p>Created for learning. Export or connect an external wallet when you are ready.</p></div>
                <div className="wallet-balance"><small>SEPOLIA BALANCE</small><strong>{balance.toFixed(3)} ETH</strong><button onClick={claimFaucet}>{balance ? "Claimed" : "Claim faucet"}</button></div>
              </section>
              <div className="asset-layout">
                <section className="card asset-section"><div className="section-head"><span><b>COLLECTIBLES</b><small>2 classroom assets</small></span></div><div className="asset-grid"><div className="asset-tile"><img src="/faceless-purple.png" alt="Purple Faceless classroom head" /><span><b>Ethereum Lab Pass</b><small>ERC-1155 · Testnet</small></span></div>{headClaimed ? <div className="asset-tile"><img src="/faceless-blue.png" alt="Blue Faceless classroom head" /><span><b>Faceless Head #084</b><small>Claimed today</small></span></div> : <button className="asset-empty" onClick={claimHead}>+ Claim your Faceless head</button>}</div></section>
                <section className="card tx-section"><div className="section-head"><span><b>TRANSACTIONS</b><small>Sepolia explorer</small></span></div>{["Minted Ethereum Lab Pass", "Received classroom ETH", "Created embedded wallet"].map((label, index) => <div className="tx-row" key={label}><span className={index === 0 ? "tx-dot violet" : "tx-dot"} /><span><b>{label}</b><small>{index + 7} minutes ago</small></span><code>0x{index + 3}a...{index}f9</code></div>)}</section>
              </div>
            </div>
          )}

          {active === "create" && (
            <div className="creator-layout">
              <section className="creator-copy"><span className="eyebrow">STUDENT CREATOR STUDIO</span><h2>Turn an idea into an onchain object.</h2><p>Create a testnet collection, mint original work and decide how many editions should exist.</p><div className="creator-note"><b>Sandbox rules</b><span>Only upload work you created.</span><span>Every asset is marked testnet.</span><span>An educator reviews it before listing.</span></div></section>
              <form className="creator-form card" onSubmit={createCollection}>
                <div className="form-head"><span><b>NEW COLLECTION</b><small>Step 1 of 3 · The idea</small></span><em>SEPOLIA</em></div>
                <label>Collection name<input required placeholder="e.g. Campus Signals" /></label>
                <label>Creator story<textarea required placeholder="What inspired the work? What should a collector understand?" /></label>
                <div className="form-row"><label>Symbol<input required placeholder="SIGNAL" maxLength={8} /></label><label>Edition size<input required type="number" min="1" max="25" defaultValue="3" /></label></div>
                <label className="upload-box"><input type="file" accept="image/*" onChange={handleArt} /><span>{artPreview ? <img src={artPreview} alt="Artwork preview" /> : <><b>＋</b><strong>Upload first artwork</strong><small>PNG, JPG or WebP · original work only</small></>}</span></label>
                <button className="primary full" type="submit">Create draft collection →</button>
                {created && <div className="success-box"><b>Draft ready</b><span>Your collection is waiting for educator review.</span></div>}
              </form>
            </div>
          )}

          {active === "campaigns" && (
            <div className="page-stack">
              <section className="campaign-hero">
                <div><span className="eyebrow">FACELESSHUB · NOW INSIDE THE LAB</span><h2>Learn a skill.<br />Use it on a real mission.</h2><p>Choose how you want to participate: appear on camera, create without showing your face, clip supplied content or help acquire genuine users.</p><button className="primary" onClick={() => notify("Mask matched you with two beginner-friendly missions")}>Let Mask match me →</button></div>
                <div className="campaign-steps"><span><b>1</b> Claim a campaign</span><span><b>2</b> Create and post</span><span><b>3</b> Get verified and paid</span></div>
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
              <section className="launch-hero"><div><span className="eyebrow">STUDENT LAUNCHPAD · SEPOLIA</span><h2>Collected in class.<br />Discovered everywhere.</h2><p>Original student work, launched through supervised onchain labs.</p></div><img src="/faceless-cast.png" alt="Faceless character cast" /></section>
              <div className="market-toolbar"><div><button className="active">All work</button><button>1 of 1</button><button>Open editions</button><button>New collections</button></div><button className="sort">Newest first⌄</button></div>
              <div className="market-grid">
                {marketItems.map((item) => <article className="market-card" key={item.id}><div className="market-image"><img src={item.image} alt={item.title} /><span>{item.tag}</span></div><div className="market-meta"><div><h3>{item.title}</h3><p>by {item.creator}</p></div><span><small>TEST PRICE</small><b>{item.price} Ξ</b></span></div><button onClick={() => notify(`${item.title} added to your testnet collection`)}>Collect on Sepolia</button></article>)}
                <article className="market-card upcoming"><div><span>＋</span><h3>Your work could be here.</h3><p>Complete the Creator Studio quest to launch.</p><button onClick={() => setActive("create")}>Start creating</button></div></article>
              </div>
            </div>
          )}

          {active === "passport" && (
            <div className="page-stack">
              <section className="passport-hero">
                <div className="passport-identity"><span className="profile-dot large">AK</span><div><span className="eyebrow">FACELESS STUDENT PASSPORT</span><h2>Aanya K.</h2><p>Creator · Builder · Cohort 04</p></div></div>
                <div className="passport-wallet"><small>CLASSROOM IDENTITY</small><strong>{wallet}</strong><span><i /> Sepolia verified</span></div>
              </section>
              <div className="passport-metrics"><article><strong>02</strong><span>Lessons completed</span></article><article><strong>03</strong><span>Onchain actions</span></article><article><strong>{claimedCampaigns.length.toString().padStart(2, "0")}</strong><span>Campaigns joined</span></article><article><strong>{headClaimed ? "03" : "02"}</strong><span>Assets collected</span></article></div>
              <div className="passport-layout">
                <section className="card passport-timeline"><div className="section-head"><span><b>PROOF OF PROGRESS</b><small>Learning, building and creating in one record</small></span></div>{[
                  ["Ethereum foundations", "Completed the introductory lesson and knowledge check", "LEARN"],
                  ["First classroom wallet", "Created a Sepolia identity for supervised practice", "BUILD"],
                  ["Ethereum Lab Pass", "Minted a testnet participation credential", "ONCHAIN"],
                  ["Campus creator profile", "Ready for creator, clipping and acquisition missions", "CREATE"],
                ].map((entry) => <div className="passport-event" key={entry[0]}><span>{entry[2].slice(0, 1)}</span><div><small>{entry[2]}</small><b>{entry[0]}</b><p>{entry[1]}</p></div><em>VERIFIED</em></div>)}</section>
                <aside className="passport-side"><section className="card"><span className="eyebrow">SKILL BADGES</span><div className="badge-cloud"><span>Ethereum basics</span><span>Wallet safety</span><span>Content starter</span><span>Testnet explorer</span></div></section><section className="card passport-next"><span className="eyebrow">NEXT MILESTONE</span><h3>Publish your first proof of work.</h3><p>Complete one campaign or launch one original artwork.</p><button onClick={() => setActive("campaigns")}>Find a campaign →</button></section><button className="wallet-link" onClick={() => setActive("wallet")}>Open classroom wallet <span>→</span></button></aside>
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
              <section className="admin-banner"><div><span className="eyebrow">EDUCATOR CONTROL ROOM</span><h2>Ethereum Session 01</h2><p>Live cohort visibility without exposing student identity onchain.</p></div><button onClick={() => notify("Class report prepared for review")}>Generate class report</button></section>
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
            <div className="onboarding-art"><div className="portal-ring one" /><div className="portal-ring two" /><MaskOrb /><span>SEPOLIA<br />CLASSROOM<br />ACCESS</span></div>
            <div className="onboarding-copy"><span className="eyebrow">FACELESS CAMPUS OS</span><h2>Learn. Build.<br />Create. Earn.</h2><p>One student profile for lessons, Mask guidance, safe testnet practice, creator campaigns and your proof-of-work passport.</p><button className="google-button" onClick={enterLab} disabled={loading}><span>G</span>{loading ? "Preparing your student profile…" : "Continue with Google"}</button><button className="demo-link" onClick={() => setOnboarded(true)}>Explore the student demo</button><small>Prototype only · Google sign-in, wallets, campaign rewards and onchain actions are simulated.</small></div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
