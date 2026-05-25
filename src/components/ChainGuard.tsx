"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/chains";

export function ChainGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const lastAttemptedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected) {
      lastAttemptedRef.current = null;
      return;
    }
    if (chainId === arcTestnet.id) {
      lastAttemptedRef.current = null;
      return;
    }
    if (lastAttemptedRef.current === chainId) return;
    lastAttemptedRef.current = chainId;
    switchChain({ chainId: arcTestnet.id });
  }, [isConnected, chainId, switchChain]);

  return null;
}
