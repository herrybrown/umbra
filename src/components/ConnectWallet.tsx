"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "@/lib/utils";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-arc-muted border border-arc-border rounded px-2 py-1">
          {shortenAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-arc-muted hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="px-4 py-2 rounded-lg bg-umbra-purple hover:bg-umbra-violet transition-colors text-sm font-medium text-white"
    >
      Connect Wallet
    </button>
  );
}
