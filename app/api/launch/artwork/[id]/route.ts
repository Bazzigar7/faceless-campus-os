import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { testnetLaunches } from "../../../../../db/schema";
import { getArtworkBucket } from "../../../../../lib/artwork-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const [launch] = await db.select().from(testnetLaunches).where(eq(testnetLaunches.id, id)).limit(1);
  if (!launch) return new Response("Artwork not found", { status: 404 });
  const object = await getArtworkBucket().get(launch.artworkKey);
  if (!object) return new Response("Artwork not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": launch.artworkContentType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
