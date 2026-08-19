import { eq } from "drizzle-orm";
import { passportProfiles } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";
import { getPassportByUserId, passportDefaultHeadline } from "../../../lib/passport-profile";

function cleanText(value: unknown, fallback: string, max: number) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned || fallback;
}

function makeSlug(username: string) {
  const base = username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "student";
  return `${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

export async function GET(request: Request) {
  try {
    const { student } = await requireCampusUser(request);
    const passport = await getPassportByUserId(student.id);
    return Response.json(passport);
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as { action?: "save" | "rotate" | "unpublish"; headline?: string; bio?: string; isPublic?: boolean };
    const [existing] = await db.select().from(passportProfiles).where(eq(passportProfiles.userId, student.id)).limit(1);
    const now = new Date().toISOString();

    if (body.action === "unpublish") {
      if (existing) await db.update(passportProfiles).set({ isPublic: false, updatedAt: now }).where(eq(passportProfiles.id, existing.id));
    } else if (body.action === "rotate") {
      if (!existing) throw new Error("Publish your Passport before regenerating its link");
      await db.update(passportProfiles).set({ shareSlug: makeSlug(student.username), updatedAt: now }).where(eq(passportProfiles.id, existing.id));
    } else if (body.action === "save") {
      const values = {
        headline: cleanText(body.headline, passportDefaultHeadline, 100),
        bio: cleanText(body.bio, "", 400),
        isPublic: body.isPublic === true,
        updatedAt: now,
      };
      if (existing) {
        await db.update(passportProfiles).set(values).where(eq(passportProfiles.id, existing.id));
      } else {
        await db.insert(passportProfiles).values({ id: crypto.randomUUID(), userId: student.id, shareSlug: makeSlug(student.username), ...values, createdAt: now });
      }
    } else {
      return Response.json({ error: "Choose a valid Passport action" }, { status: 400 });
    }

    return Response.json(await getPassportByUserId(student.id));
  } catch (error) {
    return faucetError(error);
  }
}
