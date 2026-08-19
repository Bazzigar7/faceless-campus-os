import type { Metadata } from "next";
import Link from "next/link";
import { getPublicPassport } from "../../../lib/passport-profile";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function compactAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const passport = await getPublicPassport(slug);
  const title = passport ? `${passport.profile.displayName} (@${passport.profile.username}) · Faceless Proof Passport` : "Private Proof Passport · Faceless Campus OS";
  const description = passport ? `${passport.profile.headline}. ${passport.metrics.lessonsCompleted} lessons, ${passport.metrics.classroomProofs} live quests and ${passport.metrics.assetsBuilt} onchain builds verified by Faceless Campus OS.` : "This Proof Passport is private or its share link has changed.";
  return {
    title,
    description,
    robots: passport ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: "website", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function PublicPassportPage({ params }: PageProps) {
  const { slug } = await params;
  const passport = await getPublicPassport(slug);
  if (!passport) return <main className="public-passport unavailable"><section><span className="public-mask">◐</span><small>FACELESS CAMPUS OS</small><h1>This Proof Passport is private.</h1><p>The student may have turned sharing off or regenerated the link.</p><Link href="/">Open Campus OS →</Link></section></main>;

  const initials = passport.profile.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const proofFeed = [
    ...passport.proofs.quests.map((proof) => ({ type: "LIVE QUEST", title: proof.title, detail: proof.detail, date: proof.earnedAt })),
    ...passport.proofs.builds.map((proof) => ({ type: proof.kind.toUpperCase(), title: proof.title, detail: `${proof.chain} testnet · verifiable onchain`, date: proof.earnedAt })),
    ...passport.proofs.credentials.map((proof) => ({ type: "PARTNER PROOF", title: proof.title, detail: `${proof.host} · ${proof.detail}`, date: proof.earnedAt })),
    ...passport.proofs.campaigns.map((proof) => ({ type: "CREATOR WORK", title: proof.title, detail: `${proof.brand} · ${proof.status.replaceAll("_", " ")}`, date: proof.earnedAt })),
    ...passport.proofs.attendance.map((proof) => ({ type: "ATTENDANCE", title: proof.title, detail: `Hosted by ${proof.host}`, date: proof.earnedAt })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);

  return <main className="public-passport">
    <header className="public-passport-nav"><Link href="/"><span className="public-mask">◐</span><b>FACELESS</b><small>CAMPUS OS</small></Link><span>VERIFIED PROOF PASSPORT</span></header>
    <div className="public-passport-shell">
      <section className="public-passport-hero">
        <div className="public-passport-person"><span>{initials}</span><div><small>FACELESS VERIFIED STUDENT</small><h1>{passport.profile.displayName}</h1><b>@{passport.profile.username}</b><p>{passport.profile.headline}</p></div></div>
        <div className="public-passport-seal"><span>✓</span><b>VERIFIED</b><small>Campus record</small></div>
      </section>
      {(passport.profile.bio || passport.profile.cohortTitle) && <section className="public-passport-intro"><div><small>ABOUT</small><p>{passport.profile.bio || "Learning, building and creating through verified Faceless Campus experiences."}</p></div><div><small>COHORT</small><b>{passport.profile.cohortTitle}</b>{passport.profile.college && <span>{passport.profile.college}</span>}</div></section>}
      <section className="public-passport-metrics">
        <article><strong>{passport.metrics.lessonsCompleted}</strong><span>Lessons</span></article>
        <article><strong>{passport.metrics.attendanceCount}</strong><span>Sessions attended</span></article>
        <article><strong>{passport.metrics.classroomProofs}</strong><span>Live quests</span></article>
        <article><strong>{passport.metrics.assetsBuilt}</strong><span>Onchain builds</span></article>
        <article><strong>{passport.metrics.credentials}</strong><span>Partner proofs</span></article>
        <article><strong>{passport.metrics.approvedCampaigns}</strong><span>Approved campaigns</span></article>
      </section>
      <div className="public-passport-grid">
        <section className="public-proof-feed"><header><small>PROOF OF WORK</small><h2>Earned, not self-declared.</h2></header>{proofFeed.length ? proofFeed.map((proof, index) => <article key={`${proof.type}:${proof.title}:${index}`}><span>{proof.type.slice(0, 1)}</span><div><small>{proof.type} · {new Date(proof.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small><b>{proof.title}</b><p>{proof.detail}</p></div><em>VERIFIED</em></article>) : <p className="public-empty">The first verified proof will appear here after a Campus lesson, quest, build or campaign.</p>}</section>
        <aside>
          <section className="public-badges"><small>SKILL SIGNALS</small><div>{passport.badges.length ? passport.badges.map((badge) => <span key={String(badge)}>✓ {badge}</span>) : <span>Campus member</span>}</div></section>
          <section className="public-wallets"><small>ONCHAIN IDENTITIES</small>{passport.wallets.map((wallet) => <a key={`${wallet.chain}:${wallet.address}`} href={wallet.chain === "ethereum" ? `https://sepolia.etherscan.io/address/${wallet.address}` : `https://explorer.solana.com/address/${wallet.address}?cluster=devnet`} target="_blank" rel="noreferrer"><span>{wallet.chain === "ethereum" ? "Ξ" : "S"}</span><b>{wallet.chain === "ethereum" ? "Ethereum Sepolia" : "Solana Devnet"}</b><code>{compactAddress(wallet.address)}</code></a>)}<p>Public addresses only. No wallet controls, private keys, email or payment details are shared.</p></section>
        </aside>
      </div>
      <footer className="public-passport-footer"><span>Verified from Campus OS records</span><b>FACELESS · LEARN → BUILD → CREATE</b></footer>
    </div>
  </main>;
}
