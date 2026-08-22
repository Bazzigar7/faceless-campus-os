import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import type { CampusChain, CampusFaucetNetwork } from "./wallet-provider";

type PrivyWallet = { id: string; address: string; chain_type: CampusChain };
type PrivyRpcResponse = { data?: { hash?: string }; error?: { message?: string } };

function credentials() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Secure faucet signing is not activated yet");
  return { appId, authorization: `Basic ${btoa(`${appId}:${appSecret}`)}` };
}

function headers(referenceId?: string) {
  const { appId, authorization } = credentials();
  return {
    Authorization: authorization,
    "Content-Type": "application/json",
    "privy-app-id": appId,
    ...(referenceId ? { "privy-idempotency-key": referenceId } : {}),
  };
}

async function readPrivyResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as (T & { error?: { message?: string }; message?: string }) | null;
  if (!response.ok || !data) {
    throw new Error(data?.error?.message ?? data?.message ?? `Privy wallet request failed (${response.status})`);
  }
  return data;
}

export function isPrivyServerWalletReady() {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

export async function createDistributorWallet(chain: CampusChain): Promise<PrivyWallet> {
  const response = await fetch("https://api.privy.io/v1/wallets", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chain_type: chain }),
  });
  return readPrivyResponse<PrivyWallet>(response);
}

function decimalToBaseUnits(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid faucet amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("Faucet amount has too many decimal places");
  return BigInt(whole) * (BigInt(10) ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
}

async function sendEthereum(walletId: string, destination: string, amount: string, claimId: string, chainId = 11155111) {
  const value = decimalToBaseUnits(amount, 18);
  const response = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`, {
    method: "POST",
    headers: headers(claimId),
    body: JSON.stringify({
      method: "eth_sendTransaction",
      caip2: `eip155:${chainId}`,
      chain_type: "ethereum",
      reference_id: claimId,
      params: { transaction: { to: destination, value: `0x${value.toString(16)}` } },
    }),
  });
  const result = await readPrivyResponse<PrivyRpcResponse>(response);
  if (!result.data?.hash) throw new Error(`${chainId === 46630 ? "Robinhood Testnet" : "Sepolia"} transaction did not return a hash`);
  return result.data.hash;
}

async function sendSolana(walletId: string, distributorAddress: string, destination: string, amount: string, claimId: string) {
  const lamports = decimalToBaseUnits(amount, 9);
  const rpc = createSolanaRpc(process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com");
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const instruction = getTransferSolInstruction({
    amount: lamports,
    destination: address(destination),
    source: createNoopSigner(address(distributorAddress)),
  });
  const transaction = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(address(distributorAddress), tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([instruction], tx),
    (tx) => compileTransaction(tx),
    (tx) => new Uint8Array(getTransactionEncoder().encode(tx)),
  );
  let binary = "";
  for (const byte of transaction) binary += String.fromCharCode(byte);

  const response = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`, {
    method: "POST",
    headers: headers(claimId),
    body: JSON.stringify({
      method: "signAndSendTransaction",
      caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      reference_id: claimId,
      params: { transaction: btoa(binary), encoding: "base64" },
    }),
  });
  const result = await readPrivyResponse<PrivyRpcResponse>(response);
  if (!result.data?.hash) throw new Error("Solana Devnet transaction did not return a hash");
  return result.data.hash;
}

export async function sendFaucetTransfer(input: {
  chain: CampusFaucetNetwork;
  walletId: string;
  distributorAddress: string;
  destination: string;
  amount: string;
  claimId: string;
}) {
  if (input.chain === "ethereum" || input.chain === "robinhood") {
    return sendEthereum(input.walletId, input.destination, input.amount, input.claimId, input.chain === "robinhood" ? 46630 : 11155111);
  }
  return sendSolana(input.walletId, input.distributorAddress, input.destination, input.amount, input.claimId);
}

export async function sendTokenAirdropTransfer(input: {
  chain: CampusChain;
  walletId: string;
  distributorAddress: string;
  tokenAddress: string;
  destination: string;
  amount: string;
  decimals: number;
  claimId: string;
}) {
  const units = decimalToBaseUnits(input.amount, 0) * (10n ** BigInt(input.decimals));
  if (input.chain === "ethereum") {
    const destinationWord = input.destination.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const amountWord = units.toString(16).padStart(64, "0");
    const response = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(input.walletId)}/rpc`, {
      method: "POST",
      headers: headers(input.claimId),
      body: JSON.stringify({
        method: "eth_sendTransaction",
        caip2: "eip155:11155111",
        chain_type: "ethereum",
        reference_id: input.claimId,
        params: { transaction: { to: input.tokenAddress, data: `0xa9059cbb${destinationWord}${amountWord}` } },
      }),
    });
    const result = await readPrivyResponse<PrivyRpcResponse>(response);
    if (!result.data?.hash) throw new Error("Sepolia token claim did not return a hash");
    return result.data.hash;
  }

  const rpc = createSolanaRpc(process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com");
  const distributor = createNoopSigner(address(input.distributorAddress));
  const mint = address(input.tokenAddress);
  const owner = address(input.destination);
  const [source] = await findAssociatedTokenPda({ owner: distributor.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const [destination] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const transaction = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(distributor.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([
      getCreateAssociatedTokenIdempotentInstruction({ payer: distributor, ata: destination, owner, mint }),
      getTransferCheckedInstruction({ source, mint, destination, authority: distributor, amount: units, decimals: input.decimals }),
    ], tx),
    (tx) => compileTransaction(tx),
    (tx) => new Uint8Array(getTransactionEncoder().encode(tx)),
  );
  let binary = "";
  for (const byte of transaction) binary += String.fromCharCode(byte);
  const response = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(input.walletId)}/rpc`, {
    method: "POST",
    headers: headers(input.claimId),
    body: JSON.stringify({
      method: "signAndSendTransaction",
      caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      reference_id: input.claimId,
      params: { transaction: btoa(binary), encoding: "base64" },
    }),
  });
  const result = await readPrivyResponse<PrivyRpcResponse>(response);
  if (!result.data?.hash) throw new Error("Solana token claim did not return a signature");
  return result.data.hash;
}
