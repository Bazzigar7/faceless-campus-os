const allowedMethods = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getSignatureStatuses",
  "getSlot",
  "getTransaction",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };

function errorResponse(id: RpcRequest["id"], code: number, message: string, status = 400) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

function validRequest(value: unknown): value is RpcRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as RpcRequest;
  return request.jsonrpc === "2.0" && typeof request.method === "string" && allowedMethods.has(request.method);
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 256_000) {
    return errorResponse(null, -32600, "Campus Solana request is too large", 413);
  }
  let body: RpcRequest | RpcRequest[];
  try {
    body = await request.json() as RpcRequest | RpcRequest[];
  } catch {
    return errorResponse(null, -32700, "Invalid Solana RPC request");
  }
  const requests = Array.isArray(body) ? body : [body];
  if (!requests.length || requests.length > 20 || !requests.every(validRequest)) {
    return errorResponse(Array.isArray(body) ? null : body.id, -32601, "This Solana RPC method is not available through Campus OS");
  }
  const origin = request.headers.get("origin");
  const sameOrigin = !origin || origin === new URL(request.url).origin;
  if (!sameOrigin && requests.some((item) => item.method === "sendTransaction" || item.method === "simulateTransaction")) {
    return errorResponse(null, -32600, "Transaction requests must come from Campus OS", 403);
  }

  const includesTransaction = requests.some((item) => item.method === "sendTransaction");
  const privateEndpoint = process.env.SOLANA_DEVNET_RPC_URL?.trim();
  const endpoints = [...new Set([privateEndpoint, "https://api.devnet.solana.com"].filter(Boolean) as string[])];
  const attempts = includesTransaction ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const endpoint of endpoints) {
      try {
        const upstream = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": "Faceless-Campus-OS/1.0" },
          body: JSON.stringify(body),
        });
        const text = await upstream.text();
        if (upstream.ok) {
          const payload = JSON.parse(text) as { error?: { code?: number } } | Array<{ error?: { code?: number } }>;
          const errors = Array.isArray(payload) ? payload.map((item) => item.error?.code) : [payload.error?.code];
          if (!errors.some((code) => code === 429 || code === -32005 || code === -32429)) {
            return new Response(text, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
          }
        }
      } catch {
        // Try the next endpoint, then retry transaction submissions after a short pause.
      }
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return errorResponse(requests[0]?.id, -32005, "Solana Devnet is busy. Wait a few seconds and try again.", 503);
}
