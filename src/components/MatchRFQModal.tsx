"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { generateViewKey, encryptDetails } from "@/lib/crypto";
import { parseAmount, pairLabel, takerTokenLabel } from "@/lib/utils";
import { useMatchRFQ, useApproveToken, useTokenAllowance } from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";

interface Trade {
  id: bigint;
  pair: number;
  rfqRef: string;
  maker: `0x${string}`;
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
      });

      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStep("idle");
    }
  }

  if (step === "done") {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-lg font-semibold text-white mb-1">Quote matched</h2>
        <p className="text-sm text-arc-muted mb-5">
          Your tokens are locked in escrow. The maker will settle the trade when ready.
        </p>

        <div className="p-3 rounded-lg bg-matched/10 border border-matched/30 text-sm text-matched mb-5">
          Once the maker settles, tokens will be swapped automatically. No further action needed from you.
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-umbra-purple hover:bg-umbra-violet transition-colors text-white font-medium"
        >
          Done
        </button>
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
        Enter the amount you agreed with the maker. Your tokens will be locked in escrow immediately and amounts remain private.
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
          className="w-full py-2.5 rounded-lg bg-umbra-purple hover:bg-umbra-violet disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white font-medium text-sm"
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
