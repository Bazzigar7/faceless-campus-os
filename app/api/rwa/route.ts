import { and, desc, eq } from "drizzle-orm";
import { rwaAssets, rwaDistributions, rwaHoldings, rwaTrades, users } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const STARTING_CREDITS = 10_000;
const starterAssets = [
  { id: "campus_tower", name: "Campus Tower A", symbol: "TOWER", category: "Imaginary building", description: "Split a fictional student residence into digital units and explore ownership records, rent distribution and liquidity.", rights: "A simulated share of the modelled rental pool; not a deed, security or legal claim.", incomeModel: "Simulated rent", risk: "Occupancy, maintenance and legal-enforcement risk", totalUnits: 1_000, priceCredits: 125, annualYieldBps: 680, grossMonthlyCredits: 1_011, vacancyBps: 500, operatingExpenseBps: 2_000, reserveBps: 500 },
  { id: "solar_roof", name: "Solar Roof Co-op", symbol: "SOLAR", category: "Imaginary energy asset", description: "Model how a campus solar installation could represent participation rights and simulated energy revenue.", rights: "A simulated share of modelled energy credits; no ownership of physical panels.", incomeModel: "Energy credits", risk: "Weather, equipment, pricing and counterparty risk", totalUnits: 2_500, priceCredits: 64, annualYieldBps: 420, grossMonthlyCredits: 800, vacancyBps: 300, operatingExpenseBps: 1_500, reserveBps: 1_200 },
  { id: "creator_studio", name: "Creator Studio Equipment", symbol: "STUDIO", category: "Imaginary business asset", description: "Explore fractional access to cameras and production gear through a fictional revenue-sharing structure.", rights: "A simulated share of modelled booking revenue; no claim over the equipment.", incomeModel: "Booking revenue", risk: "Utilisation, damage, depreciation and operator risk", totalUnits: 500, priceCredits: 38, annualYieldBps: 810, grossMonthlyCredits: 183, vacancyBps: 800, operatingExpenseBps: 1_800, reserveBps: 400 },
] as const;

function practiceBalance(trades: Array<{ side: "buy" | "sell"; totalCredits: number }>, distributions: Array<{ amountCredits: number }> = []) {
  return trades.reduce((balance, trade) => balance + (trade.side === "sell" ? trade.totalCredits : -trade.totalCredits), STARTING_CREDITS)
    + distributions.reduce((total, distribution) => total + distribution.amountCredits, 0);
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function nextDistributionAt() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function cashflowFor(asset: { totalUnits: number; priceCredits: number; annualYieldBps: number; grossMonthlyCredits: number; vacancyBps: number; operatingExpenseBps: number; reserveBps: number }) {
  const fallbackDeductions = { vacancyBps: 500, operatingExpenseBps: 2_000, reserveBps: 500 };
  const vacancyBps = asset.grossMonthlyCredits > 0 ? asset.vacancyBps : fallbackDeductions.vacancyBps;
  const operatingExpenseBps = asset.grossMonthlyCredits > 0 ? asset.operatingExpenseBps : fallbackDeductions.operatingExpenseBps;
  const reserveBps = asset.grossMonthlyCredits > 0 ? asset.reserveBps : fallbackDeductions.reserveBps;
  const targetNet = Math.round((asset.totalUnits * asset.priceCredits * asset.annualYieldBps) / 10_000 / 12);
  const grossMonthlyCredits = asset.grossMonthlyCredits > 0 ? asset.grossMonthlyCredits : Math.round(targetNet / 0.7);
  const vacancyCredits = Math.round((grossMonthlyCredits * vacancyBps) / 10_000);
  const operatingExpenseCredits = Math.round((grossMonthlyCredits * operatingExpenseBps) / 10_000);
  const reserveCredits = Math.round((grossMonthlyCredits * reserveBps) / 10_000);
  const netDistributableCredits = Math.max(0, grossMonthlyCredits - vacancyCredits - operatingExpenseCredits - reserveCredits);
  const annualYieldBps = asset.totalUnits * asset.priceCredits > 0 ? Math.round((netDistributableCredits * 12 * 10_000) / (asset.totalUnits * asset.priceCredits)) : 0;
  return { grossMonthlyCredits, vacancyCredits, operatingExpenseCredits, reserveCredits, netDistributableCredits, annualYieldBps, vacancyBps, operatingExpenseBps, reserveBps };
}

async function ensureStarterAssets(db: Awaited<ReturnType<typeof requireCampusUser>>["db"]) {
  for (const asset of starterAssets) await db.insert(rwaAssets).values(asset).onConflictDoUpdate({ target: rwaAssets.id, set: { annualYieldBps: asset.annualYieldBps, incomeModel: asset.incomeModel, grossMonthlyCredits: asset.grossMonthlyCredits, vacancyBps: asset.vacancyBps, operatingExpenseBps: asset.operatingExpenseBps, reserveBps: asset.reserveBps } });
}

async function marketState(request: Request) {
  const { db, student } = await requireCampusUser(request);
  await ensureStarterAssets(db);
  const [assetRows, holdings, trades, allHoldings, creators, distributions] = await Promise.all([
    db.select().from(rwaAssets).where(eq(rwaAssets.status, "active")).orderBy(desc(rwaAssets.createdAt)),
    db.select().from(rwaHoldings).where(eq(rwaHoldings.userId, student.id)),
    db.select().from(rwaTrades).where(eq(rwaTrades.userId, student.id)).orderBy(desc(rwaTrades.createdAt)),
    db.select().from(rwaHoldings),
    db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users),
    db.select().from(rwaDistributions).where(eq(rwaDistributions.userId, student.id)).orderBy(desc(rwaDistributions.createdAt)),
  ]);
  const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
  return {
    balanceCredits: practiceBalance(trades, distributions),
    holdings,
    trades: trades.slice(0, 20),
    distributions: distributions.slice(0, 20),
    currentPeriod: currentPeriod(),
    nextDistributionAt: nextDistributionAt(),
    assets: assetRows.map((asset) => {
      const marketHoldings = allHoldings.filter((holding) => holding.assetId === asset.id && holding.units > 0);
      const ownUnits = holdings.find((holding) => holding.assetId === asset.id)?.units ?? 0;
      const cashflow = cashflowFor(asset);
      const monthlyEstimateCredits = Math.round((ownUnits * cashflow.netDistributableCredits) / asset.totalUnits);
      return { ...asset, annualYieldBps: cashflow.annualYieldBps, cashflow, creator: asset.creatorUserId ? creatorMap.get(asset.creatorUserId) ?? null : null, unitsHeld: marketHoldings.reduce((total, holding) => total + holding.units, 0), holders: marketHoldings.length, monthlyEstimateCredits, incomeClaimedThisPeriod: distributions.some((distribution) => distribution.assetId === asset.id && distribution.period === currentPeriod()) };
    }),
  };
}

export async function GET(request: Request) {
  try {
    return Response.json(await marketState(request), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    await ensureStarterAssets(db);
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 20) || "trade";

    if (action === "create") {
      const name = clean(body.name, 70);
      const symbol = clean(body.symbol, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
      const category = clean(body.category, 50);
      const description = clean(body.description, 300);
      const rights = clean(body.rights, 260);
      const incomeModel = clean(body.incomeModel, 160);
      const risk = clean(body.risk, 220);
      const totalUnits = Number(body.totalUnits);
      const priceCredits = Number(body.priceCredits);
      const grossMonthlyCredits = Number(body.grossMonthlyCredits);
      const vacancyPercent = Number(body.vacancyPercent);
      const operatingExpensePercent = Number(body.operatingExpensePercent);
      const reservePercent = Number(body.reservePercent);
      if (!name || symbol.length < 2 || !category || !description || !rights || !incomeModel || !risk) return Response.json({ error: "Complete the asset story, rights, income model and risk" }, { status: 400 });
      if (!Number.isInteger(totalUnits) || totalUnits < 10 || totalUnits > 1_000_000) return Response.json({ error: "Supply must be between 10 and 1,000,000 practice units" }, { status: 400 });
      if (!Number.isInteger(priceCredits) || priceCredits < 1 || priceCredits > 10_000) return Response.json({ error: "Unit price must be between 1 and 10,000 credits" }, { status: 400 });
      if (!Number.isInteger(grossMonthlyCredits) || grossMonthlyCredits < 1 || grossMonthlyCredits > 10_000_000) return Response.json({ error: "Enter valid modelled monthly gross income" }, { status: 400 });
      if (![vacancyPercent, operatingExpensePercent, reservePercent].every((value) => Number.isFinite(value) && value >= 0 && value <= 60) || vacancyPercent + operatingExpensePercent + reservePercent > 80) return Response.json({ error: "Cash-flow deductions must be realistic and total no more than 80%" }, { status: 400 });
      const [symbolTaken] = await db.select({ id: rwaAssets.id }).from(rwaAssets).where(eq(rwaAssets.symbol, symbol)).limit(1);
      if (symbolTaken) return Response.json({ error: "That RWA symbol is already being used" }, { status: 409 });
      const id = crypto.randomUUID();
      const vacancyBps = Math.round(vacancyPercent * 100);
      const operatingExpenseBps = Math.round(operatingExpensePercent * 100);
      const reserveBps = Math.round(reservePercent * 100);
      const netMonthly = Math.round(grossMonthlyCredits * (1 - (vacancyBps + operatingExpenseBps + reserveBps) / 10_000));
      const annualYieldBps = Math.round((netMonthly * 12 * 10_000) / (totalUnits * priceCredits));
      if (annualYieldBps > 5_000) return Response.json({ error: "This model implies more than a 50% annual return. Review the income, price or expense assumptions." }, { status: 400 });
      await db.insert(rwaAssets).values({ id, creatorUserId: student.id, name, symbol, category, description, rights, incomeModel, risk, totalUnits, priceCredits, annualYieldBps, grossMonthlyCredits, vacancyBps, operatingExpenseBps, reserveBps });
      return Response.json({ ok: true, id });
    }

    if (action === "claim_income") {
      const assetId = clean(body.assetId, 80);
      const [[asset], [holding], [existing]] = await Promise.all([
        db.select().from(rwaAssets).where(eq(rwaAssets.id, assetId)).limit(1),
        db.select().from(rwaHoldings).where(and(eq(rwaHoldings.userId, student.id), eq(rwaHoldings.assetId, assetId))).limit(1),
        db.select().from(rwaDistributions).where(and(eq(rwaDistributions.userId, student.id), eq(rwaDistributions.assetId, assetId), eq(rwaDistributions.period, currentPeriod()))).limit(1),
      ]);
      if (!asset || !holding || holding.units < 1) return Response.json({ error: "Hold at least one unit to receive simulated income" }, { status: 400 });
      if (existing) return Response.json({ error: "This month’s simulated income is already in your practice balance" }, { status: 409 });
      const amountCredits = Math.round((holding.units * cashflowFor(asset).netDistributableCredits) / asset.totalUnits);
      if (amountCredits < 1) return Response.json({ error: "This holding is too small to generate one practice credit this month" }, { status: 400 });
      await db.insert(rwaDistributions).values({ id: crypto.randomUUID(), assetId, userId: student.id, period: currentPeriod(), unitsSnapshot: holding.units, amountCredits });
      return Response.json({ ok: true, amountCredits });
    }

    if (action === "trade") {
      const assetId = clean(body.assetId, 80);
      const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
      const units = Number(body.units);
      const [asset] = await db.select().from(rwaAssets).where(eq(rwaAssets.id, assetId)).limit(1);
      if (!asset || asset.status !== "active" || !side || !Number.isInteger(units) || units < 1 || units > 100) return Response.json({ error: "Choose 1–100 practice units" }, { status: 400 });
      const [holdings, trades, marketHoldings, distributions] = await Promise.all([
        db.select().from(rwaHoldings).where(eq(rwaHoldings.userId, student.id)),
        db.select().from(rwaTrades).where(eq(rwaTrades.userId, student.id)),
        db.select().from(rwaHoldings).where(eq(rwaHoldings.assetId, asset.id)),
        db.select().from(rwaDistributions).where(eq(rwaDistributions.userId, student.id)),
      ]);
      const holding = holdings.find((item) => item.assetId === assetId);
      const balance = practiceBalance(trades, distributions);
      const totalCredits = asset.priceCredits * units;
      const issuedUnits = marketHoldings.reduce((total, item) => total + item.units, 0);
      if (side === "buy" && issuedUnits + units > asset.totalUnits) return Response.json({ error: "Not enough practice units remain in this asset" }, { status: 400 });
      if (side === "buy" && totalCredits > balance) return Response.json({ error: "Not enough practice credits" }, { status: 400 });
      if (side === "sell" && (holding?.units ?? 0) < units) return Response.json({ error: "You cannot sell more units than you hold" }, { status: 400 });
      const nextUnits = (holding?.units ?? 0) + (side === "buy" ? units : -units);
      const nextCost = side === "buy" ? (holding?.totalCostCredits ?? 0) + totalCredits : Math.max(0, Math.round((holding?.totalCostCredits ?? 0) * (nextUnits / Math.max(1, holding?.units ?? 1))));
      if (holding) await db.update(rwaHoldings).set({ units: nextUnits, totalCostCredits: nextCost, updatedAt: new Date().toISOString() }).where(eq(rwaHoldings.id, holding.id));
      else await db.insert(rwaHoldings).values({ id: crypto.randomUUID(), userId: student.id, assetId, units: nextUnits, totalCostCredits: nextCost });
      await db.insert(rwaTrades).values({ id: crypto.randomUUID(), userId: student.id, assetId, side, units, priceCredits: asset.priceCredits, totalCredits });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Choose an RWA action" }, { status: 400 });
  } catch (error) {
    return faucetError(error);
  }
}
