import { and, desc, eq } from "drizzle-orm";
import { encodeDeployData, isAddress, parseEther, type Hex } from "viem";
import artifact from "../../../contracts/artifacts/CampusEdition.json";
import { testnetLaunches, wallets } from "../../../db/schema";
import { faucetError, requireCampusUser } from "../../../lib/faucet-auth";
import { getArtworkBucket } from "../../../lib/artwork-storage";

function decodeArtwork(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Response(JSON.stringify({ error: "Upload a PNG, JPG or WebP image" }), { status: 400 });
  if (dataUrl.length > 5_600_000) throw new Response(JSON.stringify({ error: "Keep artwork under 4 MB" }), { status: 413 });
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, contentType: match[1] };
}

function textValue(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const launches = await db.select().from(testnetLaunches).where(and(
      eq(testnetLaunches.userId, student.id),
      eq(testnetLaunches.status, "minted"),
    )).orderBy(desc(testnetLaunches.updatedAt));
    const origin = new URL(request.url).origin;
    return Response.json({
      nfts: launches.map((launch) => ({
        id: launch.id,
        chain: launch.chain,
        network: launch.network,
        standard: launch.standard.toUpperCase(),
        name: launch.name,
        symbol: launch.symbol,
        description: launch.description,
        quantity: 1,
        maxSupply: launch.maxSupply,
        contractAddress: launch.contractAddress,
        mintTransactionHash: launch.mintTxHash,
        image: `${origin}/api/launch/artwork/${launch.id}`,
        metadata: `${origin}/api/launch/metadata/${launch.id}`,
        updatedAt: launch.updatedAt,
      })),
    });
  } catch (error) {
    return faucetError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, student } = await requireCampusUser(request);
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action, 30) || "prepare";

    if (action === "record_deploy" || action === "record_mint") {
      const launchId = textValue(body.launchId, 80);
      const [launch] = await db.select().from(testnetLaunches).where(and(eq(testnetLaunches.id, launchId), eq(testnetLaunches.userId, student.id))).limit(1);
      if (!launch) return Response.json({ error: "Launch draft not found" }, { status: 404 });
      const transactionHash = textValue(body.transactionHash, 70);
      if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return Response.json({ error: "Invalid Sepolia transaction hash" }, { status: 400 });
      if (action === "record_deploy") {
        const contractAddress = textValue(body.contractAddress, 44);
        if (!isAddress(contractAddress)) return Response.json({ error: "Contract address is missing from the deployment receipt" }, { status: 400 });
        await db.update(testnetLaunches).set({ status: "deployed", deployTxHash: transactionHash, contractAddress, updatedAt: new Date().toISOString() }).where(eq(testnetLaunches.id, launch.id));
        return Response.json({ ok: true, status: "deployed" });
      }
      await db.update(testnetLaunches).set({ status: "minted", mintTxHash: transactionHash, updatedAt: new Date().toISOString() }).where(eq(testnetLaunches.id, launch.id));
      return Response.json({ ok: true, status: "minted" });
    }

    const creatorAddress = textValue(body.creatorAddress, 44);
    if (!isAddress(creatorAddress)) return Response.json({ error: "Connect your Ethereum classroom wallet" }, { status: 400 });
    const [campusWallet] = await db.select().from(wallets).where(and(
      eq(wallets.userId, student.id),
      eq(wallets.chain, "ethereum"),
      eq(wallets.address, creatorAddress),
    )).limit(1);
    if (!campusWallet) return Response.json({ error: "Use an Ethereum wallet linked to your Campus profile" }, { status: 403 });

    const name = textValue(body.name, 80);
    const symbol = textValue(body.symbol, 10).toUpperCase();
    const description = textValue(body.description, 600);
    const purpose = textValue(body.purpose, 240);
    const maxSupply = Number(body.maxSupply);
    const mintPrice = textValue(body.mintPrice, 30).toLowerCase() === "free" ? "0" : textValue(body.mintPrice, 30) || "0";
    const royaltyPercent = Number(body.royaltyPercent || 0);
    if (!name || !symbol || !description || !purpose) return Response.json({ error: "Complete the collection details first" }, { status: 400 });
    if (!Number.isInteger(maxSupply) || maxSupply < 1 || maxSupply > 10_000) return Response.json({ error: "Supply must be between 1 and 10,000" }, { status: 400 });
    if (!Number.isFinite(royaltyPercent) || royaltyPercent < 0 || royaltyPercent > 10) return Response.json({ error: "Royalty must be between 0% and 10%" }, { status: 400 });
    let mintPriceWei: bigint;
    try { mintPriceWei = parseEther(mintPrice); } catch { return Response.json({ error: "Enter a valid mint price in ETH" }, { status: 400 }); }

    const artwork = decodeArtwork(textValue(body.artworkDataUrl, 5_600_000));
    const launchId = crypto.randomUUID();
    const extension = artwork.contentType === "image/png" ? "png" : artwork.contentType === "image/webp" ? "webp" : "jpg";
    const artworkKey = `launches/${student.id}/${launchId}/artwork.${extension}`;
    await getArtworkBucket().put(artworkKey, artwork.bytes, { httpMetadata: { contentType: artwork.contentType } });

    const origin = new URL(request.url).origin;
    const metadataUrl = `${origin}/api/launch/metadata/${launchId}`;
    const royaltyBps = Math.round(royaltyPercent * 100);
    await db.insert(testnetLaunches).values({
      id: launchId,
      userId: student.id,
      chain: "ethereum",
      network: "sepolia",
      standard: "erc1155",
      name,
      symbol,
      description,
      purpose,
      maxSupply,
      mintPrice,
      royaltyBps,
      creatorAddress,
      artworkKey,
      artworkContentType: artwork.contentType,
    });

    const deploymentData = encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hex,
      args: [name, symbol, metadataUrl, BigInt(maxSupply), mintPriceWei, creatorAddress, royaltyBps],
    });
    return Response.json({ launchId, deploymentData, metadataUrl, standard: "ERC-1155", network: "Sepolia", chainId: 11155111 });
  } catch (error) {
    return faucetError(error);
  }
}
