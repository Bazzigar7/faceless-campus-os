import { and, desc, eq } from "drizzle-orm";
import { campaignEnrollments, campaigns, campaignSubmissions, payouts, users } from "../../../db/schema";
import { faucetError, requireCampusUser, requireOwner } from "../../../lib/faucet-auth";

type CampaignType = "creator" | "faceless" | "clipper" | "user_acquisition";
const campaignTypes: CampaignType[] = ["creator", "faceless", "clipper", "user_acquisition"];

async function campaignState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [allCampaigns, enrollments, submissions, people, payoutRows] = await Promise.all([
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)), db.select().from(campaignEnrollments),
    db.select().from(campaignSubmissions).orderBy(desc(campaignSubmissions.submittedAt)), db.select().from(users), db.select().from(payouts).orderBy(desc(payouts.approvedAt)),
  ]);
  const visible = student.role === "owner" ? allCampaigns : allCampaigns.filter((item) => item.status === "live");
  return {
    role: student.role,
    campaigns: visible.map((campaign) => ({ ...campaign, joined: enrollments.some((row) => row.campaignId === campaign.id && row.userId === student.id), joinedCount: enrollments.filter((row) => row.campaignId === campaign.id).length, ownSubmission: submissions.find((row) => row.campaignId === campaign.id && row.userId === student.id) ?? null })),
    reviewQueue: student.role === "owner" ? submissions.map((submission) => ({ ...submission, campaign: allCampaigns.find((item) => item.id === submission.campaignId) ?? null, student: people.find((item) => item.id === submission.userId) ?? null })) : [],
    payouts: (student.role === "owner" ? payoutRows : payoutRows.filter((row) => row.userId === student.id)).map((payout) => ({ ...payout, campaign: allCampaigns.find((item) => submissions.find((submission) => submission.id === payout.submissionId)?.campaignId === item.id) ?? null })),
    paymentQueue: student.role === "owner" ? submissions.filter((submission) => submission.status === "approved_for_payment" && !payoutRows.some((payout) => payout.submissionId === submission.id)).map((submission) => ({ ...submission, campaign: allCampaigns.find((item) => item.id === submission.campaignId) ?? null, student: people.find((item) => item.id === submission.userId) ?? null })) : [],
  };
}

export async function GET(request: Request) {
  try { return Response.json(await campaignState(request)); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create") {
      const { db, student } = await requireOwner(request);
      const type = String(body.campaignType || "creator") as CampaignType;
      if (!campaignTypes.includes(type)) return Response.json({ error: "Choose a valid campaign type" }, { status: 400 });
      const title = String(body.title || "").trim(); const brief = String(body.brief || "").trim(); const brand = String(body.brand || "").trim();
      if (!title || !brief || !brand) return Response.json({ error: "Add the brand, title and brief" }, { status: 400 });
      await db.insert(campaigns).values({ id: crypto.randomUUID(), title: title.slice(0, 100), brand: brand.slice(0, 60), brief: brief.slice(0, 800), campaignType: type, platform: String(body.platform || "Instagram").slice(0, 40), spots: Math.max(1, Math.min(500, Number(body.spots) || 50)), rewardAmount: String(body.rewardAmount || "0").slice(0, 30), rewardCurrency: String(body.rewardCurrency || "INR").slice(0, 10), status: body.status === "draft" ? "draft" : "live", createdBy: student.id });
      return Response.json(await campaignState(request));
    }
    const { db, student } = await requireCampusUser(request);
    const campaignId = String(body.campaignId || "");
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
    if (body.action === "join") {
      if (campaign.status !== "live") return Response.json({ error: "This campaign is not accepting students" }, { status: 409 });
      const joinedRows = await db.select().from(campaignEnrollments).where(eq(campaignEnrollments.campaignId, campaignId));
      if (joinedRows.length >= campaign.spots) return Response.json({ error: "This campaign is full" }, { status: 409 });
      await db.insert(campaignEnrollments).values({ id: crypto.randomUUID(), campaignId, userId: student.id }).onConflictDoNothing({ target: [campaignEnrollments.campaignId, campaignEnrollments.userId] });
    } else if (body.action === "submit") {
      const url = String(body.contentUrl || "").trim();
      try { const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { return Response.json({ error: "Paste a valid public content link" }, { status: 400 }); }
      const [joined] = await db.select().from(campaignEnrollments).where(and(eq(campaignEnrollments.campaignId, campaignId), eq(campaignEnrollments.userId, student.id))).limit(1);
      if (!joined) return Response.json({ error: "Join the campaign before submitting" }, { status: 409 });
      const now = new Date().toISOString();
      await db.insert(campaignSubmissions).values({ id: crypto.randomUUID(), campaignId, userId: student.id, contentUrl: url, status: "submitted", submittedAt: now }).onConflictDoUpdate({ target: [campaignSubmissions.campaignId, campaignSubmissions.userId], set: { contentUrl: url, status: "submitted", reviewNotes: null, reviewedBy: null, submittedAt: now, reviewedAt: null } });
    } else if (body.action === "review") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can review submissions" }, { status: 403 });
      const submissionId = String(body.submissionId || "");
      const status = body.status === "approved_for_payment" ? "approved_for_payment" : body.status === "changes_requested" ? "changes_requested" : "rejected";
      await db.update(campaignSubmissions).set({ status, reviewNotes: String(body.reviewNotes || "").slice(0, 500), reviewedBy: student.id, reviewedAt: new Date().toISOString() }).where(eq(campaignSubmissions.id, submissionId));
    } else if (body.action === "record_payment") {
      if (student.role !== "owner") return Response.json({ error: "Only the Campus OS owner can record payments" }, { status: 403 });
      const submissionId = String(body.submissionId || "");
      const [submission] = await db.select().from(campaignSubmissions).where(and(eq(campaignSubmissions.id, submissionId), eq(campaignSubmissions.campaignId, campaignId))).limit(1);
      if (!submission || submission.status !== "approved_for_payment") return Response.json({ error: "Approve this work before recording payment" }, { status: 409 });
      const destinationReference = String(body.destinationReference || "").trim(); const transactionReference = String(body.transactionReference || "").trim();
      if (!destinationReference || !transactionReference) return Response.json({ error: "Add the payout destination and payment reference" }, { status: 400 });
      const now = new Date().toISOString();
      await db.insert(payouts).values({ id: crypto.randomUUID(), submissionId, userId: submission.userId, method: "manual_bank", destinationReference: destinationReference.slice(0, 120), amount: campaign.rewardAmount, currency: campaign.rewardCurrency, status: "paid", approvedBy: student.id, transactionReference: transactionReference.slice(0, 120), approvedAt: now, paidAt: now });
      await db.update(campaignSubmissions).set({ status: "paid", reviewedBy: student.id, reviewedAt: now }).where(eq(campaignSubmissions.id, submissionId));
    } else return Response.json({ error: "Choose a valid campaign action" }, { status: 400 });
    return Response.json(await campaignState(request));
  } catch (error) { return faucetError(error); }
}
