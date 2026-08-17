type PriceSnapshot = {
  ethereum: number;
  solana: number;
  updatedAt: number;
};

let cachedPrices: PriceSnapshot | null = null;
let cachedAt = 0;

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedPrices && now - cachedAt < 60) {
    return Response.json({ usd: cachedPrices, source: "CoinGecko", referenceOnly: true }, {
      headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  }

  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana&vs_currencies=usd&include_last_updated_at=true", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("Market reference is unavailable");
    const data = await response.json() as {
      ethereum?: { usd?: number; last_updated_at?: number };
      solana?: { usd?: number; last_updated_at?: number };
    };
    const ethereum = Number(data.ethereum?.usd);
    const solana = Number(data.solana?.usd);
    if (!Number.isFinite(ethereum) || ethereum <= 0 || !Number.isFinite(solana) || solana <= 0) {
      throw new Error("Market reference is unavailable");
    }
    cachedPrices = {
      ethereum,
      solana,
      updatedAt: Math.max(data.ethereum?.last_updated_at ?? now, data.solana?.last_updated_at ?? now),
    };
    cachedAt = now;
    return Response.json({ usd: cachedPrices, source: "CoinGecko", referenceOnly: true }, {
      headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    if (cachedPrices) return Response.json({ usd: cachedPrices, source: "CoinGecko", referenceOnly: true, stale: true });
    return Response.json({ error: "USD reference prices are temporarily unavailable" }, { status: 503 });
  }
}
