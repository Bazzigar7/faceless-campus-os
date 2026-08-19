import { and, desc, eq, inArray } from "drizzle-orm";
import { builderProjectMembers, builderProjects, campaignSubmissions, campaigns, cohortAssignments, cohortMembers, creatorProjects, notificationReads, partnerDropClaims, partnerDrops, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type Destination = "learn" | "create" | "tools" | "campaigns" | "drops" | "admin";
type Notice = { key: string; kind: "assignment" | "invitation" | "review" | "campaign" | "drop" | "owner"; title: string; body: string; destination: Destination; createdAt: string; referenceId?: string };
function clean(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }

async function notificationState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  const [reads, memberships, projectMemberships, ownProjects, ownCreatorProjects, ownSubmissions, liveDrops, ownDropClaims, campaignRows] = await Promise.all([
    db.select().from(notificationReads).where(eq(notificationReads.userId, student.id)),
    db.select().from(cohortMembers).where(eq(cohortMembers.userId, student.id)),
    db.select().from(builderProjectMembers).where(eq(builderProjectMembers.userId, student.id)),
    db.select().from(builderProjects).where(eq(builderProjects.userId, student.id)),
    db.select().from(creatorProjects).where(eq(creatorProjects.userId, student.id)),
    db.select().from(campaignSubmissions).where(eq(campaignSubmissions.userId, student.id)),
    db.select().from(partnerDrops).where(eq(partnerDrops.status, "live")).orderBy(desc(partnerDrops.createdAt)),
    db.select().from(partnerDropClaims).where(eq(partnerDropClaims.userId, student.id)),
    db.select().from(campaigns),
  ]);
  const notices: Notice[] = [];
  const cohortId = memberships[0]?.cohortId;
  if (cohortId) {
    const assignments = await db.select().from(cohortAssignments).where(and(eq(cohortAssignments.cohortId, cohortId), eq(cohortAssignments.status, "active"))).orderBy(desc(cohortAssignments.createdAt));
    for (const assignment of assignments) notices.push({ key: `assignment:${assignment.id}`, kind: "assignment", title: `New lesson · ${assignment.title}`, body: assignment.instructions || `${assignment.course} lesson ${assignment.lessonId} is ready for your cohort.`, destination: "learn", createdAt: assignment.createdAt, referenceId: assignment.id });
  }

  const sharedProjectIds = projectMemberships.map((row) => row.projectId);
  const sharedProjects = sharedProjectIds.length ? await db.select().from(builderProjects).where(inArray(builderProjects.id, sharedProjectIds)) : [];
  for (const membership of projectMemberships.filter((row) => row.status === "invited")) {
    const project = sharedProjects.find((row) => row.id === membership.projectId);
    if (project) notices.push({ key: `builder-invite:${membership.id}`, kind: "invitation", title: `Project invitation · ${project.title}`, body: `You were invited as ${membership.role}. Open Project Studio to join or decline.`, destination: "create", createdAt: membership.invitedAt, referenceId: project.id });
  }
  const visibleProjects = [...ownProjects, ...sharedProjects.filter((project) => projectMemberships.some((member) => member.projectId === project.id && member.status === "accepted"))];
  for (const project of visibleProjects) {
    if (project.status === "changes_requested") notices.push({ key: `builder-review:${project.id}:${project.status}:${project.reviewedAt}`, kind: "review", title: `Changes requested · ${project.title}`, body: project.reviewNotes || "Your educator left feedback on this build.", destination: "create", createdAt: project.reviewedAt || project.updatedAt, referenceId: project.id });
    if (project.status === "verified") notices.push({ key: `builder-review:${project.id}:${project.status}:${project.reviewedAt}`, kind: "review", title: `Project verified · ${project.title}`, body: "The verified build is now credited to every accepted teammate and eligible for Showcase.", destination: "create", createdAt: project.reviewedAt || project.updatedAt, referenceId: project.id });
  }
  for (const project of ownCreatorProjects) {
    if (project.reviewStatus === "changes_requested" || project.reviewStatus === "approved") notices.push({ key: `creator-review:${project.id}:${project.reviewStatus}:${project.reviewedAt}`, kind: "review", title: project.reviewStatus === "approved" ? `Shoot plan approved · ${project.title}` : `Creator feedback · ${project.title}`, body: project.reviewNotes || (project.reviewStatus === "approved" ? "Your plan is approved to shoot." : "Open Creator Tools to make the requested changes."), destination: "tools", createdAt: project.reviewedAt || project.updatedAt, referenceId: project.id });
  }
  for (const submission of ownSubmissions.filter((row) => row.status !== "submitted")) {
    const campaign = campaignRows.find((row) => row.id === submission.campaignId);
    const label = submission.status === "paid" ? "Payment recorded" : submission.status === "approved_for_payment" ? "Approved for payment" : submission.status === "changes_requested" ? "Campaign changes requested" : "Campaign submission updated";
    notices.push({ key: `campaign:${submission.id}:${submission.status}:${submission.reviewedAt}`, kind: "campaign", title: `${label} · ${campaign?.title ?? "Campaign"}`, body: submission.reviewNotes || `Your submission is now ${submission.status.replaceAll("_", " ")}.`, destination: "campaigns", createdAt: submission.reviewedAt || submission.submittedAt, referenceId: submission.id });
  }
  const claimedDropIds = new Set(ownDropClaims.map((row) => row.dropId));
  for (const drop of liveDrops.filter((row) => !claimedDropIds.has(row.id)).slice(0, 6)) notices.push({ key: `drop:${drop.id}`, kind: "drop", title: `Live drop · ${drop.title}`, body: `${drop.host} · ${drop.rewardLabel}. Check your eligibility and claim it in Campus OS.`, destination: "drops", createdAt: drop.createdAt, referenceId: drop.id });

  if (student.role === "owner") {
    const [submittedBuilds, submittedCreatorPlans, submittedCampaigns, people] = await Promise.all([
      db.select().from(builderProjects).where(eq(builderProjects.status, "submitted")),
      db.select().from(creatorProjects).where(eq(creatorProjects.reviewStatus, "submitted")),
      db.select().from(campaignSubmissions).where(eq(campaignSubmissions.status, "submitted")),
      db.select({ id: users.id, username: users.username }).from(users),
    ]);
    const username = (id: string) => people.find((person) => person.id === id)?.username ?? "student";
    for (const project of submittedBuilds) notices.push({ key: `owner-builder:${project.id}:${project.updatedAt}`, kind: "owner", title: `Build waiting · ${project.title}`, body: `@${username(project.userId)} requested Project Studio verification.`, destination: "admin", createdAt: project.updatedAt, referenceId: project.id });
    for (const project of submittedCreatorPlans) notices.push({ key: `owner-creator:${project.id}:${project.updatedAt}`, kind: "owner", title: `Shoot plan waiting · ${project.title}`, body: `@${username(project.userId)} requested pre-shoot review.`, destination: "admin", createdAt: project.updatedAt, referenceId: project.id });
    for (const submission of submittedCampaigns) notices.push({ key: `owner-campaign:${submission.id}:${submission.submittedAt}`, kind: "owner", title: `Campaign work waiting`, body: `@${username(submission.userId)} submitted content for review.`, destination: "admin", createdAt: submission.submittedAt, referenceId: submission.id });
  }

  const readKeys = new Set(reads.map((row) => row.notificationKey));
  const notifications = [...new Map(notices.map((notice) => [notice.key, notice])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40).map((notice) => ({ ...notice, read: readKeys.has(notice.key) }));
  return { role: student.role, unreadCount: notifications.filter((notice) => !notice.read).length, notifications };
}

export async function GET(request: Request) {
  try { return Response.json(await notificationState(request), { headers: { "cache-control": "no-store" } }); } catch (error) { return faucetError(error); }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 20);
    if (action !== "mark" && action !== "mark_all") return Response.json({ error: "Choose a valid Inbox action" }, { status: 400 });
    const current = await notificationState(request);
    const keys = action === "mark_all" ? current.notifications.map((notice) => notice.key) : [clean(body.key, 260)];
    const allowed = new Set(current.notifications.map((notice) => notice.key));
    const valid = keys.filter((key) => key && allowed.has(key));
    if (!valid.length) return Response.json(current);
    const now = new Date().toISOString();
    await db.insert(notificationReads).values(valid.map((key) => ({ id: crypto.randomUUID(), userId: student.id, notificationKey: key, readAt: now }))).onConflictDoNothing({ target: [notificationReads.userId, notificationReads.notificationKey] });
    return Response.json(await notificationState(request));
  } catch (error) { return faucetError(error); }
}
