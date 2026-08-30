"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
  useConfig,
  usePublicClient,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import type { Config } from "wagmi";
import {
  decodeFunctionResult,
  encodeFunctionData,
  toEventSelector,
} from "viem";
import {
  UMBRA_OTC_ABI,
  LEGACY_UMBRA_OTC_ABI,
  UMBRA_OTC_ADDRESS,
  ERC20_ABI,
  USDC_ADDRESS,
  EURC_ADDRESS,
} from "@/lib/contracts";
import { arcTestnet } from "@/lib/chains";

const TRADE_CREATED_TOPIC = toEventSelector(
  "TradeCreated(uint256,address,uint8,uint64,string)"
);
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type ContractVersion = "participant-keys" | "legacy";

export interface UmbraTrade {
  id: bigint;
  maker: `0x${string}`;
  taker: `0x${string}`;
  pair: number;
  status: number;
  expiresAt: bigint;
  createdAt: bigint;
  bidCommitment: `0x${string}`;
  makerEncrypted: `0x${string}`;
  takerEncrypted: `0x${string}`;
  makerViewKeyHash: `0x${string}`;
  takerViewKeyHash: `0x${string}`;
  rfqRef: string;
  contractVersion: ContractVersion;
}

function useEnsureArcChain() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return async () => {
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  };
}

async function awaitMined(config: Config, hash: `0x${string}`) {
  const receipt = await waitForTransactionReceipt(config, { hash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain");
  }
  return receipt;
}

function findTradeCreatedId(
  logs: readonly {
    address: `0x${string}`;
    topics: readonly `0x${string}`[];
  }[]
): bigint | null {
  for (const log of logs) {
    if (
      log.address.toLowerCase() === UMBRA_OTC_ADDRESS.toLowerCase() &&
      log.topics[0] === TRADE_CREATED_TOPIC &&
      log.topics.length >= 2
    ) {
      return BigInt(log.topics[1]);
    }
  }
  return null;
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
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  return useQuery({
    queryKey: ["umbra-trade", UMBRA_OTC_ADDRESS, id?.toString()],
    enabled: id !== undefined && !!publicClient,
    refetchInterval: 4000,
    queryFn: async (): Promise<UmbraTrade> => {
      if (id === undefined || !publicClient) {
        throw new Error("Trade read is not ready.");
      }

      const callData = encodeFunctionData({
        abi: UMBRA_OTC_ABI,
        functionName: "getTrade",
        args: [id],
      });
      const result = await publicClient.call({
        to: UMBRA_OTC_ADDRESS,
        data: callData,
      });
      if (!result.data) {
        throw new Error("The contract returned no trade data.");
      }

      try {
        const current = decodeFunctionResult({
          abi: UMBRA_OTC_ABI,
          functionName: "getTrade",
          data: result.data,
        });
        return {
          ...current,
          contractVersion: "participant-keys",
        };
      } catch {
        const legacy = decodeFunctionResult({
          abi: LEGACY_UMBRA_OTC_ABI,
          functionName: "getTrade",
          data: result.data,
        });
        return {
          id: legacy.id,
          maker: legacy.maker,
          taker: legacy.taker,
          pair: legacy.pair,
          status: legacy.status,
          expiresAt: legacy.expiresAt,
          createdAt: legacy.createdAt,
          bidCommitment: legacy.bidCommitment,
          makerEncrypted: legacy.makerEncrypted,
          takerEncrypted: legacy.takerEncrypted,
          makerViewKeyHash: legacy.viewKeyHash,
          takerViewKeyHash: ZERO_BYTES32,
          rfqRef: legacy.rfqRef,
          contractVersion: "legacy",
        };
      }
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

export function useCreateRFQ() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const create = async (args: {
    pair: number;
    makerAmount: bigint;
    bidCommitment: `0x${string}`;
    encrypted: `0x${string}`;
    makerViewKeyHash: `0x${string}`;
    preferredTaker: `0x${string}`;
    expiresAt: bigint;
    rfqRef: string;
  }) => {
    await ensureArc();
    const hash = await writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "createRFQ",
      args: [
        args.pair,
        args.makerAmount,
        args.bidCommitment,
        args.encrypted as `0x${string}`,
        args.makerViewKeyHash,
        args.preferredTaker,
        args.expiresAt,
        args.rfqRef,
      ],
    });
    const receipt = await awaitMined(config, hash);
    return {
      hash,
      tradeId: findTradeCreatedId(receipt.logs),
    };
  };

  return { create, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useMatchRFQ() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const match = async (args: {
    id: bigint;
    takerAmount: bigint;
    takerEncrypted: `0x${string}`;
    takerViewKeyHash: `0x${string}`;
    contractVersion: ContractVersion;
  }) => {
    await ensureArc();
    const hash =
      args.contractVersion === "legacy"
        ? await writeContractAsync({
            address: UMBRA_OTC_ADDRESS,
            abi: LEGACY_UMBRA_OTC_ABI,
            functionName: "matchRFQ",
            args: [
              args.id,
              args.takerAmount,
              args.takerEncrypted as `0x${string}`,
            ],
          })
        : await writeContractAsync({
            address: UMBRA_OTC_ADDRESS,
            abi: UMBRA_OTC_ABI,
            functionName: "matchRFQ",
            args: [
              args.id,
              args.takerAmount,
              args.takerEncrypted as `0x${string}`,
              args.takerViewKeyHash,
            ],
          });
    await awaitMined(config, hash);
    return hash;
  };

  return { match, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useSettle() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const settle = async (id: bigint) => {
    await ensureArc();
    const hash = await writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "settle",
      args: [id],
    });
    await awaitMined(config, hash);
    return hash;
  };

  return { settle, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useCancel() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const cancel = async (id: bigint) => {
    await ensureArc();
    const hash = await writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "cancel",
      args: [id],
    });
    await awaitMined(config, hash);
    return hash;
  };

  return { cancel, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useMarkExpired() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const markExpired = async (id: bigint) => {
    await ensureArc();
    const hash = await writeContractAsync({
      address: UMBRA_OTC_ADDRESS,
      abi: UMBRA_OTC_ABI,
      functionName: "markExpired",
      args: [id],
    });
    await awaitMined(config, hash);
    return hash;
  };

  return { markExpired, isPending, isConfirming, isSuccess, error, hash: data };
}

export function useApproveToken() {
  const ensureArc = useEnsureArcChain();
  const config = useConfig();
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: data });

  const approve = async (token: `0x${string}`) => {
    await ensureArc();
    const hash = await writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [UMBRA_OTC_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
    await awaitMined(config, hash);
    return hash;
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash: data };
}
