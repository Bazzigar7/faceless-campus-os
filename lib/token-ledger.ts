export function campusTokenBalances(
  token: { id: string; userId: string; totalSupply: string },
  transfers: Array<{ tokenId: string; fromUserId: string; toUserId: string; amount: string }>,
  airdrops: Array<{ id: string; tokenId: string; creatorUserId: string; totalAllocation: string; status: string }> = [],
  claims: Array<{ airdropId: string; userId: string; amount: string; status: string }> = [],
) {
  const balances = new Map<string, bigint>([[token.userId, BigInt(token.totalSupply)]]);
  for (const transfer of transfers) {
    if (transfer.tokenId !== token.id) continue;
    const amount = BigInt(transfer.amount);
    balances.set(transfer.fromUserId, (balances.get(transfer.fromUserId) ?? 0n) - amount);
    balances.set(transfer.toUserId, (balances.get(transfer.toUserId) ?? 0n) + amount);
  }
  const tokenAirdrops = airdrops.filter((airdrop) => airdrop.tokenId === token.id && ["open", "closed", "exhausted"].includes(airdrop.status));
  for (const airdrop of tokenAirdrops) {
    balances.set(airdrop.creatorUserId, (balances.get(airdrop.creatorUserId) ?? 0n) - BigInt(airdrop.totalAllocation));
  }
  const validIds = new Set(tokenAirdrops.map((airdrop) => airdrop.id));
  for (const claim of claims) {
    if (!validIds.has(claim.airdropId) || claim.status !== "sent") continue;
    balances.set(claim.userId, (balances.get(claim.userId) ?? 0n) + BigInt(claim.amount));
  }
  return balances;
}
