"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function PrivyClientProvider({ appId, children }: { appId: string; children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6b55e8",
          logo: "/faceless-blue.png",
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
