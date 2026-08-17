import { env } from "cloudflare:workers";

type StoredObject = { body: BodyInit };
type ArtworkBucket = {
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
};

export function getArtworkBucket() {
  const bucket = (env as unknown as { ARTWORK?: ArtworkBucket }).ARTWORK;
  if (!bucket) throw new Error("Campus artwork storage is not available yet");
  return bucket;
}
