"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { UMBRA_OTC_ABI, UMBRA_OTC_ADDRESS, ERC20_ABI, USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";
import { arcTestnet } from "@/lib/chains";

function useEnsureArcChain() {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  return async () => {
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  };
}

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useNextTradeId() {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "nextTradeId",
    query: { refetchInterval: 5000 },
  });
}

export function useOpenCount() {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "openCount",
    query: { refetchInterval: 5000 },
  });
}

export function useOpenIds() {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "getOpenIds",
    query: { refetchInterval: 5000 },
  });
}

export function useTrade(id: bigint | undefined) {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "getTrade",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled: id !== undefined,
      refetchInterval: 4000,
    },
  });
}

export function useMakerTrades(address: `0x${string}` | undefined) {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "getMakerTrades",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });
}

export function useTakerTrades(address: `0x${string}` | undefined) {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "getTakerTrades",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });
}

export function useVerifyViewKey(id: bigint | undefined, viewKey: `0x${string}` | undefined) {
  return useReadContract({
    address: UMBRA_OTC_ADDRESS,
    abi: UMBRA_OTC_ABI,
    functionName: "verifyViewKey",
    args: id !== undefined && viewKey ? [id, viewKey] : undefined,
    query: { enabled: id !== undefined && !!viewKey },
  });
}

export function useTokenBalance(token: `0x${string}`, address: `0x${string}` | undefined) {
  return useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 4000,
    },
  });
}

export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useTokenBalance(USDC_ADDRESS, address);
}

export function useEurcBalance(address: `0x${string}` | undefined) {
  return useTokenBalance(EURC_ADDRESS, address);
}

export function useTokenAllowance(
  token: `0x${string}`,
  owner: `0x${string}` | undefined
) {
  return useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner ? [owner, UMBRA_OTC_ADDRESS] : undefined,
    query: {
      enabled: !!owner,
      refetchInterval: 5000,
    },
  });
}

// ─── Write hooks ─────────────────────────────────────────────────────────────

function useWrite<T>(
  mutate: ReturnType<typeof useWriteContract>["writeContractAsync"]
) {
  return mutate;
}

export function useCreateRFQ() {
  const ensureArc = useEnsureArcChain();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const create = async (args: {
    pair: number;
    commitment: `0x${string}`;
    encrypted: `0x${string}`;
    viewKeyHash: `0x${string}`;
    preferredTaker: `0x${string}`;
    expiresAt: bigint;
    rfqRef: string;
  }) => {
    await ensureArc();
    return writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "createRFQ",
      chainId: arcTestnet.id,
      args: [
        args.pair,
        args.commitment,
        args.encrypted as `0x${string}`,
        args.viewKeyHash,
        args.preferredTaker,
        args.expiresAt,
        args.rfqRef,
      ],
    });
  };

  return { create, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useMatchRFQ() {
  const ensureArc = useEnsureArcChain();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const match = async (args: {
    id: bigint;
    takerCommitment: `0x${string}`;
    takerEncrypted: `0x${string}`;
  }) => {
    await ensureArc();
    return writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "matchRFQ",
      chainId: arcTestnet.id,
      args: [args.id, args.takerCommitment, args.takerEncrypted as `0x${string}`],
    });
  };

  return { match, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useSettle() {
  const ensureArc = useEnsureArcChain();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const settle = async (args: {
    id: bigint;
    makerAmount: bigint;
    makerSalt: `0x${string}`;
    takerAmount: bigint;
    takerSalt: `0x${string}`;
  }) => {
    await ensureArc();
    return writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "settle",
      chainId: arcTestnet.id,
      args: [args.id, args.makerAmount, args.makerSalt, args.takerAmount, args.takerSalt],
    });
  };

  return { settle, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useCancel() {
  const ensureArc = useEnsureArcChain();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const cancel = async (id: bigint) => {
    await ensureArc();
    return writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "cancel",
      chainId: arcTestnet.id,
      args: [id],
    });
  };

  return { cancel, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useApproveToken() {
  const ensureArc = useEnsureArcChain();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const approve = async (token: `0x${string}`) => {
    await ensureArc();
    return writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      chainId: arcTestnet.id,
      args: [UMBRA_OTC_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash: data };
}
