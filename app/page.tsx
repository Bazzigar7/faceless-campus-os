import OnchainLab from "./OnchainLab";
import PrivyClientProvider from "./PrivyClientProvider";

export default function Home() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is required");
  }

  return <PrivyClientProvider appId={appId}><OnchainLab /></PrivyClientProvider>;
}
