export type WalletProviderName = "privy" | "dynamic";
export type CampusChain = "ethereum" | "solana";
export type CampusFaucetNetwork = CampusChain | "robinhood";
export type CampusWalletKind = "embedded" | "external";

export type VerifiedWalletIdentity = {
  provider: WalletProviderName;
  providerUserId: string;
  email: string;
  wallets: Array<{
    chain: CampusChain;
    address: string;
    kind: CampusWalletKind;
    isPrimary: boolean;
  }>;
};

export interface WalletIdentityProvider {
  readonly name: WalletProviderName;
  verifyRequest(request: Request): Promise<VerifiedWalletIdentity>;
}

export const walletProviderEnvironment = {
  activeProvider: "privy" as WalletProviderName,
  requiredPublicKeys: ["NEXT_PUBLIC_PRIVY_APP_ID"],
  requiredServerKeys: ["PRIVY_VERIFICATION_KEY"],
};

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function isValidUsername(value: string): boolean {
  return /^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsername(value));
}
