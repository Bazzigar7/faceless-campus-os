import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";

type ChatMessage = { role: "user" | "assistant"; text: string };

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

export async function POST(request: Request) {
  try {
    const { student } = await requireCampusUser(request);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "Mask intelligence is being connected by the educator" }, { status: 503 });

    const body = await request.json() as {
      question?: string;
      history?: ChatMessage[];
      lesson?: { course?: string; title?: string; summary?: string };
    };
    const question = String(body.question || "").trim().slice(0, 1_500);
    if (!question) return Response.json({ error: "Ask Mask a question" }, { status: 400 });
    const history = (Array.isArray(body.history) ? body.history : []).slice(-8).flatMap((message) => {
      if (message?.role !== "user" && message?.role !== "assistant") return [];
      const text = String(message.text || "").trim().slice(0, 1_500);
      return text ? [{ role: message.role, content: text }] : [];
    });
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
        max_output_tokens: 700,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "auto",
        instructions: `You are Mask, the warm, sharp AI co-host inside Faceless Campus OS for adult college students.
Answer any legitimate question directly; never force an unrelated question back to blockchain, crypto, Faceless lessons or a video.
When the question genuinely relates to the curriculum, prefer the approved Faceless framing below, explain it simply, and mention the most relevant lesson only when useful.
Use web search only for information that may have changed, when the user asks for current information, or when accuracy requires verification. Never invent current prices, laws, people or events.
Keep ordinary answers concise and conversational. Use an example when it makes the idea easier. Ask at most one useful follow-up question.
For financial, medical or legal questions, give educational information, state uncertainty and encourage qualified help where appropriate. Never promise returns or tell students what token to buy.
Never claim to sign, approve or execute wallet transactions. Classroom testnet assets have no real monetary value.
Student username: @${student.username}.
${curriculum}
Current optional lesson context: ${course || "none"} — ${lessonTitle || "none"}. ${lessonSummary || ""}`,
        input: [...history, { role: "user", content: question }],
      }),
    });
    const data = await upstream.json() as Record<string, unknown> & { error?: { message?: string } };
    if (!upstream.ok) throw new Error(data.error?.message || "Mask could not answer right now");
    const answer = responseText(data);
    if (!answer) throw new Error("Mask could not answer right now");
    return Response.json({ answer, citations: responseCitations(data) });
  } catch (error) {
    return faucetError(error);
  }
}
