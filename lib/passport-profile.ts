import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  attendanceRecords,
  attendanceSessions,
  campaignSubmissions,
  campaigns,
  classroomSessionActivity,
  classroomSessions,
  cohortMembers,
  cohorts,
  lessonProgress,
  partnerDropClaims,
  partnerDrops,
  passportProfiles,
  payouts,
  testnetLaunches,
  testnetTokens,
  users,
  wallets,
} from "../db/schema";

const DEFAULT_HEADLINE = "Blockchain learner · Onchain builder · Creator";

export async function getPassportByUserId(userId: string) {
  const db = getDb();
  const [[student], [settings], membership, walletRows, lessons, attendance, activities, launches, tokens, claims, submissions, paymentRows] = await Promise.all([
    db.select({ id: users.id, username: users.username, displayName: users.displayName, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(passportProfiles).where(eq(passportProfiles.userId, userId)).limit(1),
    db.select().from(cohortMembers).where(eq(cohortMembers.userId, userId)).limit(1),
    db.select({ chain: wallets.chain, address: wallets.address, isPrimary: wallets.isPrimary }).from(wallets).where(eq(wallets.userId, userId)),
    db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed"))).orderBy(desc(lessonProgress.completedAt)),
    db.select().from(attendanceRecords).where(eq(attendanceRecords.userId, userId)).orderBy(desc(attendanceRecords.checkedInAt)),
    db.select().from(classroomSessionActivity).where(and(eq(classroomSessionActivity.userId, userId), eq(classroomSessionActivity.status, "completed"))).orderBy(desc(classroomSessionActivity.completedAt)),
    db.select().from(testnetLaunches).where(eq(testnetLaunches.userId, userId)).orderBy(desc(testnetLaunches.updatedAt)),
    db.select().from(testnetTokens).where(eq(testnetTokens.userId, userId)).orderBy(desc(testnetTokens.updatedAt)),
    db.select().from(partnerDropClaims).where(eq(partnerDropClaims.userId, userId)).orderBy(desc(partnerDropClaims.claimedAt)),
    db.select().from(campaignSubmissions).where(eq(campaignSubmissions.userId, userId)).orderBy(desc(campaignSubmissions.submittedAt)),
    db.select({ amount: payouts.amount, currency: payouts.currency, status: payouts.status, paidAt: payouts.paidAt }).from(payouts).where(eq(payouts.userId, userId)).orderBy(desc(payouts.paidAt)),
  ]);
  if (!student) return null;

  const [[cohort], sessionRows, classroomRows, dropRows, campaignRows] = await Promise.all([
    membership[0] ? db.select({ title: cohorts.title, college: cohorts.college }).from(cohorts).where(eq(cohorts.id, membership[0].cohortId)).limit(1) : Promise.resolve([]),
    db.select({ id: attendanceSessions.id, title: attendanceSessions.title, host: attendanceSessions.host }).from(attendanceSessions),
    db.select({ id: classroomSessions.id, title: classroomSessions.title, quest: classroomSessions.quest }).from(classroomSessions),
    db.select({ id: partnerDrops.id, title: partnerDrops.title, host: partnerDrops.host, rewardLabel: partnerDrops.rewardLabel }).from(partnerDrops),
    db.select({ id: campaigns.id, title: campaigns.title, brand: campaigns.brand }).from(campaigns),
  ]);
  const sessionMap = new Map(sessionRows.map((row) => [row.id, row]));
  const classroomMap = new Map(classroomRows.map((row) => [row.id, row]));
  const dropMap = new Map(dropRows.map((row) => [row.id, row]));
  const campaignMap = new Map(campaignRows.map((row) => [row.id, row]));
  const approvedSubmissions = submissions.filter((row) => row.status === "approved_for_payment" || row.status === "paid");
  const deployedLaunches = launches.filter((row) => row.status === "deployed" || row.status === "minted");
  const deployedTokens = tokens.filter((row) => row.status === "deployed");

  return {
    settings: {
      id: settings?.id ?? null,
      shareSlug: settings?.shareSlug ?? null,
      isPublic: settings?.isPublic ?? false,
      headline: settings?.headline ?? DEFAULT_HEADLINE,
      bio: settings?.bio ?? "",
      sharePath: settings?.shareSlug ? `/passport/${settings.shareSlug}` : null,
    },
    profile: {
      displayName: student.displayName,
      username: student.username,
      headline: settings?.headline ?? DEFAULT_HEADLINE,
      bio: settings?.bio ?? "",
      cohortTitle: cohort?.title ?? "Faceless Campus",
      college: cohort?.college ?? null,
      joinedAt: membership[0]?.joinedAt ?? student.createdAt,
    },
    wallets: walletRows.filter((row) => row.isPrimary).map(({ chain, address }) => ({ chain, address })),
    metrics: {
      lessonsCompleted: lessons.length,
      attendanceCount: attendance.length,
      credentials: claims.length,
      classroomProofs: activities.length,
      assetsBuilt: deployedLaunches.length + deployedTokens.length,
      approvedCampaigns: approvedSubmissions.length,
      paidCampaigns: submissions.filter((row) => row.status === "paid").length,
    },
    proofs: {
      lessons: lessons.slice(0, 12).map((row) => ({ title: `${row.course[0].toUpperCase()}${row.course.slice(1)} lesson ${row.lessonId}`, course: row.course, earnedAt: row.completedAt ?? row.updatedAt })),
      attendance: attendance.slice(0, 12).map((row) => ({ title: sessionMap.get(row.sessionId)?.title ?? "Campus session", host: sessionMap.get(row.sessionId)?.host ?? "Faceless", earnedAt: row.checkedInAt })),
      quests: activities.slice(0, 12).map((row) => ({ title: classroomMap.get(row.sessionId)?.title ?? "Live onchain quest", detail: row.proofLabel ?? "Completed in class", earnedAt: row.completedAt ?? row.updatedAt })),
      credentials: claims.slice(0, 12).map((row) => ({ title: dropMap.get(row.dropId)?.title ?? "Partner credential", host: dropMap.get(row.dropId)?.host ?? "Faceless Partner", detail: dropMap.get(row.dropId)?.rewardLabel ?? row.evidence, earnedAt: row.claimedAt })),
      builds: [
        ...deployedLaunches.map((row) => ({ title: row.name, kind: "NFT collection", chain: row.chain, reference: row.contractAddress ?? row.assetAddress, earnedAt: row.updatedAt })),
        ...deployedTokens.map((row) => ({ title: row.name, kind: "Token", chain: row.chain, reference: row.tokenAddress, earnedAt: row.updatedAt })),
      ].slice(0, 12),
      campaigns: approvedSubmissions.slice(0, 12).map((row) => ({ title: campaignMap.get(row.campaignId)?.title ?? "Creator campaign", brand: campaignMap.get(row.campaignId)?.brand ?? "Faceless Partner", status: row.status, earnedAt: row.reviewedAt ?? row.submittedAt })),
    },
    earnings: paymentRows.filter((row) => row.status === "paid").map(({ amount, currency, paidAt }) => ({ amount, currency, paidAt })),
    badges: [
      lessons.length ? "Verified learner" : null,
      attendance.length ? "In-room participant" : null,
      activities.length ? "Onchain builder" : null,
      deployedLaunches.length ? "NFT creator" : null,
      deployedTokens.length ? "Token launcher" : null,
      approvedSubmissions.length ? "Campaign creator" : null,
      claims.length ? "Ecosystem participant" : null,
    ].filter(Boolean),
  };
}

export async function getPublicPassport(shareSlug: string) {
  const db = getDb();
  const [profile] = await db.select({ userId: passportProfiles.userId }).from(passportProfiles).where(and(
    eq(passportProfiles.shareSlug, shareSlug),
    eq(passportProfiles.isPublic, true),
  )).limit(1);
  return profile ? getPassportByUserId(profile.userId) : null;
}

export const passportDefaultHeadline = DEFAULT_HEADLINE;
