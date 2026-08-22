"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { Buffer } from "buffer";
import { defineChain } from "viem";
import { sepolia } from "viem/chains";

const browserGlobals = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
browserGlobals.Buffer ??= Buffer;

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });
const solanaDevnetRpc = createSolanaRpc("/api/solana-rpc");
const solanaDevnetSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");
const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
});

export default function PrivyClientProvider({ appId, children }: { appId: string; children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6b55e8",
          logo: "/faceless-blue.png",
          walletChainType: "ethereum-and-solana",
        },
        defaultChain: sepolia,
        supportedChains: [sepolia, robinhoodTestnet],
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: solanaDevnetRpc,
              rpcSubscriptions: solanaDevnetSubscriptions,
            },
          },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
          solana: { createOnLogin: "all-users" },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
