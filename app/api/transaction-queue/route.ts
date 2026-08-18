import { env } from "cloudflare:workers";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

const SLOT_INTERVAL_MS = 3_000;
const MAX_QUEUE_WAIT_MS = 10 * 60 * 1_000;

export async function POST(request: Request) {
  try {
    await requireCampusUser(request);
    const body = await request.json().catch(() => ({})) as { network?: string };
    if (body.network !== "solana_devnet") {
      return Response.json({ error: "This Campus queue currently supports Solana Devnet" }, { status: 400 });
    }

    const now = Date.now();
    const result = await env.DB.prepare(`
      INSERT INTO campus_transaction_queues (network, next_available_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(network) DO UPDATE SET
        next_available_at = CASE
          WHEN campus_transaction_queues.next_available_at < ? THEN ?
          ELSE campus_transaction_queues.next_available_at + ?
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING next_available_at
    `).bind("solana_devnet", now, now, now, SLOT_INTERVAL_MS).first<{ next_available_at: number }>();

    const readyAt = Math.min(result?.next_available_at ?? now, now + MAX_QUEUE_WAIT_MS);
    const waitMs = Math.max(0, readyAt - now);
    return Response.json({
      readyAt,
      waitMs,
      position: Math.max(1, Math.ceil(waitMs / SLOT_INTERVAL_MS) + 1),
      retryAfterMs: SLOT_INTERVAL_MS,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return faucetError(error);
  }
}
