"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  downloadSettlementKit,
  encryptDetails,
  generateViewKey,
  saveKit,
  viewKeyHash,
  type SettlementKit,
} from "@/lib/crypto";
import { parseAmount, pairLabel, takerTokenLabel } from "@/lib/utils";
import {
  useMatchRFQ,
  useApproveToken,
  useTokenAllowance,
  type ContractVersion,
} from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";

interface Trade {
  id: bigint;
  pair: number;
  rfqRef: string;
  maker: `0x${string}`;
  contractVersion: ContractVersion;
}

interface Props {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MatchRFQModal({ trade, onClose, onSuccess }: Props) {
  const { address } = useAccount();

  const [takerAmountStr, setTakerAmountStr] = useState("");
  const [institution, setInstitution] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "matching" | "done">("idle");
  const [error, setError] = useState("");
  const [createdKit, setCreatedKit] = useState<SettlementKit | null>(null);

  const sendToken = trade.pair === 0 ? EURC_ADDRESS : USDC_ADDRESS;
  const sendSymbol = takerTokenLabel(trade.pair);

  const { data: allowance } = useTokenAllowance(sendToken, address);
  const { approve } = useApproveToken();
  const { match, isConfirming } = useMatchRFQ();

  const parsedAmount = takerAmountStr ? parseAmount(takerAmountStr) : 0n;
  const needsApproval = (allowance ?? 0n) < parsedAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setError("");

    try {
      if (needsApproval) {
        setStep("approving");
        await approve(sendToken);
      }

      setStep("matching");

      const viewKey = generateViewKey();
      const encrypted = await encryptDetails(
        {
          amount: parsedAmount.toString(),
          institution,
          ref: trade.rfqRef,
          currency: sendSymbol,
          ts: Math.floor(Date.now() / 1000),
        },
        viewKey
      );

      await match({
        id: trade.id,
        takerAmount: parsedAmount,
        takerEncrypted: encrypted as `0x${string}`,
        takerViewKeyHash: viewKeyHash(viewKey),
        contractVersion: trade.contractVersion,
      });

      const kit: SettlementKit = {
        tradeId: Number(trade.id),
        amount: parsedAmount.toString(),
        viewKey,
        role: "taker",
      };
      saveKit(kit);
      setCreatedKit(kit);

      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStep("idle");
    }
  }

  if (step === "done" && createdKit) {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-lg font-semibold text-white mb-1">Quote matched</h2>
        <p className="text-sm text-arc-muted mb-5">
          Your tokens are locked in escrow. Keep this audit kit so the taker
          disclosure can be reviewed later.
        </p>

        <div className="mb-5 space-y-3">
          <CopyField label="Trade ID" value={createdKit.tradeId.toString()} />
          <CopyField label="Taker view key" value={createdKit.viewKey} />
        </div>

        <div className="p-3 rounded-lg bg-matched/10 border border-matched/30 text-sm text-matched mb-5">
          The key is saved in this browser. Download a backup before clearing
          browser storage or moving to another device.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => downloadSettlementKit(createdKit)}
            className="rounded-lg border border-arc-border py-2.5 text-sm font-medium text-white transition-colors hover:border-umbra-purple"
          >
            Download kit
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-umbra-purple py-2.5 font-medium text-action transition-colors hover:bg-umbra-violet"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-white mb-1">Take quote</h2>
      <div className="text-xs text-arc-muted font-mono mb-1">
        Trade #{trade.id.toString()} · {pairLabel(trade.pair)}
      </div>
      <p className="text-sm text-arc-muted mb-5">
        Enter the amount you agreed with the maker. Your tokens will be locked in escrow immediately.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Your amount ({sendSymbol})
          </label>
          <input
            type="text"
            placeholder="0.00"
            value={takerAmountStr}
            onChange={(e) => setTakerAmountStr(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
          />
        </div>

        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Your firm name
          </label>
          <input
            type="text"
            placeholder="Beta Fund Ltd"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={step !== "idle" || !parsedAmount}
          className="umbra-action w-full py-2.5 rounded-lg bg-umbra-purple hover:bg-umbra-violet disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-action font-medium text-sm"
        >
          {step === "approving"
            ? "Approving… (confirm in wallet)"
            : step === "matching" || isConfirming
            ? "Locking tokens… (confirm in wallet)"
            : needsApproval
            ? `Approve ${sendSymbol} & Take`
            : "Take Quote"}
        </button>
      </form>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-arc-card border border-arc-border rounded-2xl p-6 relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-arc-muted hover:text-white transition-colors"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-1 text-xs text-arc-muted">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded border border-arc-border bg-arc-dark p-2 font-mono text-xs text-umbra-glow">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded border border-arc-border px-2 py-1 text-xs text-arc-muted transition-colors hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
