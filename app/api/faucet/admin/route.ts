import { eq } from "drizzle-orm";
import { faucetConfigs } from "../../../../db/schema";
import { faucetError, requireOwner } from "../../../../lib/faucet-auth";
import { createDistributorWallet, isPrivyServerWalletReady } from "../../../../lib/privy-server-wallet";
import type { CampusFaucetNetwork } from "../../../../lib/wallet-provider";

export async function POST(request: Request) {
  try {
    const { db, student } = await requireOwner(request);
    const body = await request.json() as {
      action?: "prepare" | "update";
      chain?: CampusFaucetNetwork;
      amount?: string;
      maxClaims?: number;
      enabled?: boolean;
    };

    if (body.action === "prepare") {
      if (!isPrivyServerWalletReady()) {
        return Response.json({ error: "Add the Privy app secret to activate secure distributor wallets" }, { status: 503 });
      }
      const created: Array<{ chain: CampusFaucetNetwork; address: string }> = [];
      for (const chain of ["ethereum", "solana", "robinhood"] as const) {
        const [existing] = await db.select().from(faucetConfigs).where(eq(faucetConfigs.chain, chain)).limit(1);
        if (existing?.distributorWalletId && existing.distributorAddress) {
          created.push({ chain, address: existing.distributorAddress });
          continue;
        }
        const wallet = await createDistributorWallet(chain === "robinhood" ? "ethereum" : chain);
        await db.insert(faucetConfigs).values({
          chain,
          amount: chain === "solana" ? "0.05" : chain === "robinhood" ? "0.001" : "0.002",
          maxClaims: 1,
          distributorWalletId: wallet.id,
          distributorAddress: wallet.address,
          updatedBy: student.id,
        }).onConflictDoUpdate({
          target: faucetConfigs.chain,
          set: { distributorWalletId: wallet.id, distributorAddress: wallet.address, updatedBy: student.id, updatedAt: new Date().toISOString() },
        });
        created.push({ chain, address: wallet.address });
      }
      return Response.json({ ok: true, wallets: created });
    }

    if (body.action === "update") {
      const chain = body.chain;
      if (chain !== "ethereum" && chain !== "solana" && chain !== "robinhood") return Response.json({ error: "Choose a faucet network" }, { status: 400 });
      const amount = (body.amount || "").trim();
      if (!/^\d+(\.\d{1,9})?$/.test(amount) || Number(amount) <= 0) return Response.json({ error: "Enter a valid claim amount" }, { status: 400 });
      const maxClaims = Number(body.maxClaims);
      if (!Number.isInteger(maxClaims) || maxClaims < 1 || maxClaims > 5) return Response.json({ error: "Claims per student must be between 1 and 5" }, { status: 400 });

      await db.update(faucetConfigs).set({
        amount,
        maxClaims,
        enabled: Boolean(body.enabled),
        updatedBy: student.id,
        updatedAt: new Date().toISOString(),
      }).where(eq(faucetConfigs.chain, chain));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown faucet action" }, { status: 400 });
  } catch (error) {
    return faucetError(error);
  }
}
