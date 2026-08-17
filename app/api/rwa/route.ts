import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { rwaHoldings, rwaTrades } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const STARTING_CREDITS = 10_000;
const assets = {
  campus_tower: { priceCredits: 125, maxUnits: 1_000 },
  solar_roof: { priceCredits: 64, maxUnits: 2_500 },
  creator_studio: { priceCredits: 38, maxUnits: 500 },
} as const;

function practiceBalance(trades: Array<{ side: "buy" | "sell"; totalCredits: number }>) {
  return trades.reduce((balance, trade) => balance + (trade.side === "sell" ? trade.totalCredits : -trade.totalCredits), STARTING_CREDITS);
}

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const [holdings, trades] = await Promise.all([
      db.select().from(rwaHoldings).where(eq(rwaHoldings.userId, student.id)),
      db.select().from(rwaTrades).where(eq(rwaTrades.userId, student.id)).orderBy(desc(rwaTrades.createdAt)),
    ]);
    return Response.json({ balanceCredits: practiceBalance(trades), holdings, trades: trades.slice(0, 12) });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as { assetId?: string; side?: string; units?: number };
    const assetId = String(body.assetId || "") as keyof typeof assets;
    const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
    const units = Number(body.units);
    const asset = assets[assetId];
    if (!asset || !side || !Number.isInteger(units) || units < 1 || units > 100) {
      return Response.json({ error: "Choose 1–100 practice units" }, { status: 400 });
    }
    const [holdings, trades] = await Promise.all([
      db.select().from(rwaHoldings).where(eq(rwaHoldings.userId, student.id)),
      db.select().from(rwaTrades).where(eq(rwaTrades.userId, student.id)),
    ]);
    const holding = holdings.find((item) => item.assetId === assetId);
    const balance = practiceBalance(trades);
    const totalCredits = asset.priceCredits * units;
    if (side === "buy" && totalCredits > balance) return Response.json({ error: "Not enough practice credits" }, { status: 400 });
    if (side === "sell" && (holding?.units ?? 0) < units) return Response.json({ error: "You cannot sell more units than you hold" }, { status: 400 });
    const nextUnits = (holding?.units ?? 0) + (side === "buy" ? units : -units);
    const nextCost = side === "buy" ? (holding?.totalCostCredits ?? 0) + totalCredits : Math.max(0, Math.round((holding?.totalCostCredits ?? 0) * (nextUnits / Math.max(1, holding?.units ?? 1))));
    if (holding) {
      await db.update(rwaHoldings).set({ units: nextUnits, totalCostCredits: nextCost, updatedAt: new Date().toISOString() }).where(eq(rwaHoldings.id, holding.id));
    } else {
      await db.insert(rwaHoldings).values({ id: crypto.randomUUID(), userId: student.id, assetId, units: nextUnits, totalCostCredits: nextCost });
    }
    await db.insert(rwaTrades).values({ id: crypto.randomUUID(), userId: student.id, assetId, side, units, priceCredits: asset.priceCredits, totalCredits });
    return Response.json({ ok: true });
  } catch (error) {
    return faucetError(error);
  }
}
