"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/chains";

export function ChainGuard() {
  const { isConnected, chainId } = useAccount();
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
    if (chainId === undefined) return;
    if (lastAttemptedRef.current === chainId) return;
    lastAttemptedRef.current = chainId;
    switchChain({ chainId: arcTestnet.id });
  }, [isConnected, chainId, switchChain]);

  return null;
}
