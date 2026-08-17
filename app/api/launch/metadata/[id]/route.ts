import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { testnetLaunches } from "../../../../../db/schema";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const [launch] = await db.select().from(testnetLaunches).where(eq(testnetLaunches.id, id)).limit(1);
  if (!launch) return Response.json({ error: "Metadata not found" }, { status: 404 });
  const origin = new URL(request.url).origin;
  return Response.json({
    name: launch.name,
    description: launch.description,
    image: `${origin}/api/launch/artwork/${launch.id}`,
    external_url: origin,
    properties: {
      category: "image",
      standard: launch.standard.toUpperCase(),
      network: "Sepolia testnet",
      creator: launch.creatorAddress,
      max_supply: launch.maxSupply,
      purpose: launch.purpose,
    },
    attributes: [
      { trait_type: "Campus", value: "Faceless" },
      { trait_type: "Network", value: "Sepolia" },
      { trait_type: "Edition Size", value: launch.maxSupply },
    ],
  }, { headers: { "cache-control": "public, max-age=300" } });
}
