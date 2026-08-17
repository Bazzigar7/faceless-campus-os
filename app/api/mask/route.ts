import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type ChatMessage = { role: "user" | "assistant"; text: string };

type LaunchDraft = {
  assetType: "nft_collection" | "token";
  chain: "ethereum" | "solana";
  name: string;
  symbol: string;
  description: string;
  supply: number;
  mintPrice: string | null;
  royaltyPercent: number | null;
  decimals: number | null;
  purpose: string;
  artworkReady: boolean | null;
  authorityMode: "keep" | "revoke" | null;
};

type LaunchProgress = {
  assetType: "nft_collection" | "token" | null;
  chain: "ethereum" | "solana" | null;
  name: string | null;
  symbol: string | null;
  description: string | null;
  supply: number | null;
  mintPrice: string | null;
  royaltyPercent: number | null;
  decimals: number | null;
  purpose: string | null;
  artworkReady: boolean | null;
  authorityMode: "keep" | "revoke" | null;
  ready: boolean;
};

const curriculum = `
Faceless Campus OS teaches 25 approved lessons across three courses.
Blockchain basics: USDT, peer-to-peer exchange and escrow, and blockchain as a shared public record.
Bitcoin: recap, wallet-to-wallet transfers, Satoshi and Bitcoin's beginning, mining, the 21 million supply rule, Bitcoin Pizza Day, and transaction confirmations/speed.
Ethereum: what Ethereum is, smart contracts, tokenising assets, transaction confirmation, validators and Proof of Stake, gas, ETH supply, NFTs, provenance, digital certificates, product authenticity, DeFi borrowing, bank-versus-contract systems, token swaps and liquidity pools.
Classroom blockchain activities use Sepolia and Solana Devnet test assets with no real monetary value.
`;

function responseText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const output = Array.isArray(data.output) ? data.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    return content.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []);
  }).join("\n").trim();
}

function responseCitations(data: Record<string, unknown>) {
  const output = Array.isArray(data.output) ? data.output : [];
  const citations = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const annotations = Array.isArray((part as { annotations?: unknown[] }).annotations) ? (part as { annotations: unknown[] }).annotations : [];
      return annotations.flatMap((annotation) => {
        if (!annotation || typeof annotation !== "object") return [];
        const item = annotation as { type?: string; url?: string; title?: string };
        return item.type === "url_citation" && item.url ? [{ url: item.url, title: item.title || new URL(item.url).hostname }] : [];
      });
    });
  });
  return Array.from(new Map(citations.map((item) => [item.url, item])).values()).slice(0, 5);
}

function responseLaunchDraft(data: Record<string, unknown>): LaunchDraft | null {
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const call = item as { type?: string; name?: string; arguments?: string };
    if (call.type !== "function_call" || call.name !== "prepare_launch" || !call.arguments) continue;
    try {
      return JSON.parse(call.arguments) as LaunchDraft;
    } catch {
      return null;
    }
  }
  return null;
}

function responseLaunchProgress(data: Record<string, unknown>) {
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const call = item as { type?: string; name?: string; arguments?: string };
    if (call.type !== "function_call" || call.name !== "update_launch_progress" || !call.arguments) continue;
    try {
      return JSON.parse(call.arguments) as { message: string; progress: LaunchProgress };
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { student } = await requireCampusUser(request);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "Mask intelligence is being connected by the educator" }, { status: 503 });

    const body = await request.json() as {
      question?: string;
      history?: ChatMessage[];
      launchProgress?: LaunchProgress | null;
      artwork?: { dataUrl?: string; name?: string; type?: string; size?: number; rightsConfirmed?: boolean } | null;
      lesson?: { course?: string; title?: string; summary?: string };
    };
    const question = String(body.question || "").trim().slice(0, 1_500);
    if (!question) return Response.json({ error: "Ask Mask a question" }, { status: 400 });
    const history = (Array.isArray(body.history) ? body.history : []).slice(-30).flatMap((message) => {
      if (message?.role !== "user" && message?.role !== "assistant") return [];
      const text = String(message.text || "").trim().slice(0, 1_200);
      return text ? [{ role: message.role, content: text }] : [];
    });
    const suppliedProgress = body.launchProgress && typeof body.launchProgress === "object" ? body.launchProgress : null;
    const artworkDataUrl = String(body.artwork?.dataUrl || "");
    const hasArtwork = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(artworkDataUrl);
    if (artworkDataUrl && !hasArtwork) return Response.json({ error: "Upload a PNG, JPG or WebP image" }, { status: 400 });
    if (artworkDataUrl.length > 5_600_000) return Response.json({ error: "Keep artwork under 4 MB" }, { status: 413 });
    if (hasArtwork && !body.artwork?.rightsConfirmed) return Response.json({ error: "Confirm that you created the artwork or have permission to use it" }, { status: 400 });
    const launchStart = /(?:\b(?:nft|eft)\b.*collection|launch.*(?:nft|collection|token)|create.*(?:nft|collection|token))/i.test(question);
    const launchActive = Boolean(suppliedProgress || launchStart);
    const lessonTitle = String(body.lesson?.title || "").slice(0, 120);
    const lessonSummary = String(body.lesson?.summary || "").slice(0, 500);
    const course = String(body.lesson?.course || "").slice(0, 40);

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: launchActive ? 900 : 700,
        tools: launchActive ? [
          {
            type: "function",
            name: "update_launch_progress",
            description: "Merge the student's newest answer into the persistent Campus Launchpad progress and return the next conversational reply.",
            strict: true,
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                message: { type: "string", description: "A concise natural reply. Answer any side question first, then ask exactly one genuinely missing launch question unless ready." },
                progress: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    assetType: { type: ["string", "null"], enum: ["nft_collection", "token", null] },
                    chain: { type: ["string", "null"], enum: ["ethereum", "solana", null] },
                    name: { type: ["string", "null"] },
                    symbol: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    supply: { type: ["integer", "null"], minimum: 1 },
                    mintPrice: { type: ["string", "null"] },
                    royaltyPercent: { type: ["number", "null"], minimum: 0, maximum: 10 },
                    decimals: { type: ["integer", "null"], minimum: 0, maximum: 18 },
                    purpose: { type: ["string", "null"] },
                    artworkReady: { type: ["boolean", "null"] },
                    authorityMode: { type: ["string", "null"], enum: ["keep", "revoke", null] },
                    ready: { type: "boolean" },
                  },
                  required: ["assetType", "chain", "name", "symbol", "description", "supply", "mintPrice", "royaltyPercent", "decimals", "purpose", "artworkReady", "authorityMode", "ready"],
                },
              },
              required: ["message", "progress"],
            },
          },
        ] : [
          { type: "web_search", search_context_size: "low" },
        ],
        tool_choice: launchActive ? { type: "function", name: "update_launch_progress" } : "auto",
        instructions: `You are Mask, the warm, sharp AI co-host inside Faceless Campus OS for adult college students.
Answer any legitimate question directly; never force an unrelated question back to blockchain, crypto, Faceless lessons or a video.
When the question genuinely relates to the curriculum, prefer the approved Faceless framing below, explain it simply, and mention the most relevant lesson only when useful.
Use web search only for information that may have changed, when the user asks for current information, or when accuracy requires verification. Never invent current prices, laws, people or events.
Keep ordinary answers concise and conversational. Use an example when it makes the idea easier. Ask at most one useful follow-up question.
For financial, medical or legal questions, give educational information, state uncertainty and encourage qualified help where appropriate. Never promise returns or tell students what token to buy.
Never claim to sign, approve or execute wallet transactions. Classroom testnet assets have no real monetary value.
You are also the conversational front door to the built-in Campus Launchpad. Never recommend an outside launchpad when a student asks to launch an NFT collection or token.
For a launch request, explain that Campus OS can prepare it on Sepolia or Solana Devnet, then collect the requirements conversationally. Ask exactly one missing question at a time and remember answers already present in the conversation.
For an NFT collection collect: chain, artwork readiness, name, description, supply, free-or-paid mint price, royalty percentage, and purpose. A symbol is technical metadata here, not a marketplace requirement: never make the student stop to choose one. If absent, automatically derive a sensible 3–5 character uppercase symbol from the collection name.
For a token collect: chain, name, symbol, description and purpose, supply, decimals, and whether mint and freeze authority should be kept for learning or revoked for fixed supply. Explain authority tradeoffs plainly.
Before asking anything, audit the persistent progress and the full conversation. Never ask again for a non-null value unless the student explicitly corrects it. If the student asks a side question, answer it and then continue with the next missing requirement. When the student says “make your own”, “you decide” or similar, choose a sensible learning-focused value and save it rather than asking again.
When artwork is attached, inspect it briefly, acknowledge what is visibly present without inventing identity or ownership, set artworkReady to true, and suggest metadata only when useful. The student has confirmed they created it or have permission to use it; do not claim that this confirmation independently proves copyright.
On every active launch turn, call update_launch_progress. Merge the newest answer into the supplied progress; never erase an existing value without an explicit correction. Mark ready only when all relevant values are present. Use null for fields that do not apply. The student's connected Campus wallet is the default creator and proceeds wallet. All launches in this first workflow are testnet.
Persistent launch progress supplied by Campus OS: ${JSON.stringify(suppliedProgress)}
Attached artwork: ${hasArtwork ? `${String(body.artwork?.name || "artwork").slice(0, 120)} (student rights confirmation received)` : "none on this turn"}.
Student username: @${student.username}.
${curriculum}
Current optional lesson context: ${course || "none"} — ${lessonTitle || "none"}. ${lessonSummary || ""}`,
        input: [...history, { role: "user", content: hasArtwork ? [
          { type: "input_text", text: question },
          { type: "input_image", image_url: artworkDataUrl, detail: "low" },
        ] : question }],
      }),
    });
    const data = await upstream.json() as Record<string, unknown> & { error?: { message?: string } };
    if (!upstream.ok) throw new Error(data.error?.message || "Mask could not answer right now");
    const progressResult = responseLaunchProgress(data);
    const progress = progressResult?.progress ?? null;
    const launchDraft = progress?.ready && progress.assetType && progress.chain && progress.name && progress.symbol && progress.description && progress.supply && progress.purpose ? progress as LaunchDraft : responseLaunchDraft(data);
    const answer = progressResult?.message || responseText(data) || (launchDraft ? `Your ${launchDraft.assetType === "nft_collection" ? "NFT collection" : "token"} draft is ready. Review every detail in the Campus Launchpad, then approve the testnet deployment with your own wallet.` : "");
    if (!answer) throw new Error("Mask could not answer right now");
    return Response.json({ answer, citations: responseCitations(data), launchDraft, launchProgress: progress });
  } catch (error) {
    return faucetError(error);
  }
}
