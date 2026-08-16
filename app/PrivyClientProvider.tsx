"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { sepolia } from "viem/chains";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });
const solanaDevnetRpc = createSolanaRpc("https://api.devnet.solana.com");
const solanaDevnetSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

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
        supportedChains: [sepolia],
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
