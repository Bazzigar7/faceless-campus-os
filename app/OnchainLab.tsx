"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Tab = "home" | "learn" | "wallet" | "create" | "launchpad" | "drops" | "admin";

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
  { id: "learn", label: "Learn with Mask", mark: "M" },
  { id: "wallet", label: "My wallet", mark: "◇" },
  { id: "create", label: "Creator studio", mark: "+" },
  { id: "launchpad", label: "Launchpad", mark: "↗" },
  { id: "drops", label: "Partner drops", mark: "✦" },
  { id: "admin", label: "Educator view", mark: "▦" },
];

const quests = [
  { title: "Meet Ethereum", copy: "Understand the network before touching a wallet.", time: "06 min", state: "complete" },
  { title: "Your first transaction", copy: "Send test ETH and read every part of the receipt.", time: "12 min", state: "active" },
  { title: "Claim a Faceless head", copy: "Mint your first classroom collectible on Sepolia.", time: "08 min", state: "open" },
  { title: "Create a team token", copy: "Choose a name, supply and purpose for a test token.", time: "15 min", state: "locked" },
  { title: "Launch a mini collection", copy: "Turn original student art into a three-piece collection.", time: "18 min", state: "locked" },
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActive("home")} aria-label="Faceless Onchain Lab home">
          <span className="brand-glyph"><MaskOrb compact /></span>
          <span><strong>FACELESS</strong><small>ONCHAIN LAB</small></span>
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
          <strong>Ethereum · Session 01</strong>
          <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
          <span>{completed} of 7 quests complete</span>
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
                <div><span className="eyebrow">GUIDED BY MASK</span><h2>Ethereum foundations</h2><p>Watch one short lesson, perform one action and inspect the proof.</p></div>
                <div className="lesson-orb"><MaskOrb compact /><span>Mask online<small>Classroom mode</small></span></div>
              </section>
              <div className="quest-list">
                {quests.map((quest, index) => (
                  <article key={quest.title} className={`lesson-row ${quest.state}`}>
                    <span className="lesson-number">{quest.state === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>
                    <div><small>{quest.state === "active" ? "UP NEXT" : quest.state.toUpperCase()}</small><h3>{quest.title}</h3><p>{quest.copy}</p></div>
                    <span className="lesson-time">{quest.time}</span>
                    {index === 1 && <button onClick={() => notify("Mask lesson opened in classroom mode")}>Begin</button>}
                    {index === 2 && <button onClick={claimHead}>{headClaimed ? "Claimed ✓" : "Claim head"}</button>}
                    {quest.state === "locked" && <span className="lock">LOCKED</span>}
                  </article>
                ))}
              </div>
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
            <div className="onboarding-copy"><span className="eyebrow">FACELESS ONCHAIN LAB</span><h2>Your first wallet.<br />Your first onchain action.</h2><p>Enter the student demo to see how Google onboarding will create a private classroom profile and a user-controlled testnet wallet.</p><button className="google-button" onClick={enterLab} disabled={loading}><span>G</span>{loading ? "Creating your classroom wallet…" : "Continue with Google"}</button><button className="demo-link" onClick={() => setOnboarded(true)}>Explore without signing in</button><small>Prototype only · No real Google account or blockchain wallet is created yet.</small></div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
