import { importSPKI, jwtVerify, type JWTPayload } from "jose";
import type { CampusChain, CampusWalletKind, VerifiedWalletIdentity } from "./wallet-provider";

type LinkedAccount = {
  type?: string;
  address?: string;
  email?: string;
  name?: string;
  display_name?: string;
  chain_type?: string;
  chainType?: string;
  wallet_client_type?: string;
  walletClientType?: string;
  imported?: boolean;
};

function readLinkedAccounts(payload: JWTPayload): LinkedAccount[] {
  const raw = payload.linked_accounts;
  if (typeof raw !== "string") throw new Error("Privy identity token is missing linked accounts");

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Privy linked accounts are invalid");
  return parsed as LinkedAccount[];
}

function accountChain(account: LinkedAccount): CampusChain | null {
  const chain = account.chain_type ?? account.chainType;
  return chain === "ethereum" || chain === "solana" ? chain : null;
}

function walletKind(account: LinkedAccount): CampusWalletKind {
  const client = account.wallet_client_type ?? account.walletClientType;
  return client === "privy" && !account.imported ? "embedded" : "external";
}

export async function verifyPrivyIdentityToken(
  token: string,
  appId: string,
  verificationKey: string,
): Promise<VerifiedWalletIdentity & { displayName: string }> {
  const key = await importSPKI(verificationKey.replace(/\\n/g, "\n"), "ES256");
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["ES256"],
    issuer: "privy.io",
    audience: appId,
  });

  if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) {
    throw new Error("Privy user identity is invalid");
  }

  const accounts = readLinkedAccounts(payload);
  const google = accounts.find((account) => account.type === "google_oauth" || account.type === "google");
  const emailAccount = accounts.find((account) => account.type === "email");
  const email = google?.email ?? google?.address ?? emailAccount?.address ?? emailAccount?.email;
  if (!email) throw new Error("The Google account email is missing from the Privy identity token");

  const wallets = accounts.flatMap((account) => {
    if (account.type !== "wallet" || !account.address) return [];
    const chain = accountChain(account);
    if (!chain) return [];
    return [{ chain, address: account.address, kind: walletKind(account), isPrimary: false }];
  });

  const uniqueWallets = Array.from(
    new Map(wallets.map((wallet) => [`${wallet.chain}:${wallet.address.toLowerCase()}`, wallet])).values(),
  );
  for (const chain of ["ethereum", "solana"] as const) {
    const chainWallets = uniqueWallets.filter((wallet) => wallet.chain === chain);
    const primary = chainWallets.find((wallet) => wallet.kind === "embedded") ?? chainWallets[0];
    if (primary) primary.isPrimary = true;
  }

  if (!uniqueWallets.some((wallet) => wallet.chain === "ethereum") || !uniqueWallets.some((wallet) => wallet.chain === "solana")) {
    throw new Error("Ethereum and Solana wallet creation is still finishing");
  }

  return {
    provider: "privy",
    providerUserId: payload.sub,
    email: email.toLowerCase(),
    displayName: google?.name ?? google?.display_name ?? email.split("@")[0],
    wallets: uniqueWallets,
  };
}
