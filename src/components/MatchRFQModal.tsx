"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  generateSalt,
  generateViewKey,
  commitAmount,
  viewKeyHash as hashViewKey,
  encryptDetails,
  saveKit,
} from "@/lib/crypto";
import { parseAmount, formatAmount, pairLabel, takerTokenLabel } from "@/lib/utils";
import { useMatchRFQ, useApproveToken, useTokenAllowance } from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";

interface Trade {
  id: bigint;
  pair: number;
  rfqRef: string;
  maker: `0x${string}`;
  viewKeyHash: `0x${string}`;
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
  const [kitCopy, setKitCopy] = useState<{ salt: string; amount: string; viewKey: string } | null>(null);

  // Taker sends the opposite token of maker
  const sendToken = trade.pair === 0 ? EURC_ADDRESS : USDC_ADDRESS;
  const sendSymbol = takerTokenLabel(trade.pair);

  const { data: allowance } = useTokenAllowance(sendToken, address);
  const { approve } = useApproveToken();
  const { match, isPending, isConfirming } = useMatchRFQ();

  const parsedAmount = takerAmountStr ? parseAmount(takerAmountStr) : 0n;
  const needsApproval = (allowance ?? 0n) < parsedAmount || (allowance ?? 0n) === 0n;

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

      const salt = generateSalt();
      // Taker uses the maker's viewKeyHash for shared audit trail
      const takerViewKey = generateViewKey();
      const commitment = commitAmount(parsedAmount, salt);

      const encrypted = await encryptDetails(
        {
          amount: parsedAmount.toString(),
          institution,
          ref: trade.rfqRef,
          currency: sendSymbol,
          ts: Math.floor(Date.now() / 1000),
        },
        takerViewKey
      );

      await match({
        id: trade.id,
        takerCommitment: commitment,
        takerEncrypted: encrypted as `0x${string}`,
      });

      saveKit({
        tradeId: Number(trade.id),
        amount: parsedAmount.toString(),
        salt,
        viewKey: takerViewKey,
        role: "taker",
      });

      setKitCopy({ salt, amount: parsedAmount.toString(), viewKey: takerViewKey });
      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStep("idle");
    }
  }

  if (step === "done" && kitCopy) {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-lg font-semibold text-white mb-1">Quote matched</h2>
        <p className="text-sm text-arc-muted mb-5">
          Share these with the other party. You will both need them to complete the trade.
        </p>

        <div className="space-y-3 mb-6">
          <KitField label="Settlement code (share this with the maker)" value={kitCopy.salt} />
          <KitField label="Your amount" value={formatAmount(BigInt(kitCopy.amount))} />
        </div>

        <div className="p-3 rounded-lg bg-matched/10 border border-matched/30 text-sm text-matched mb-5">
          Share your settlement code and amount with the maker. Either of you can then settle the trade.
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
        Enter the amount you will send ({sendSymbol}). The size stays hidden until both sides settle.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Amount you send ({sendSymbol})
          </label>
          <input
            type="text"
            placeholder="920000.00"
            value={takerAmountStr}
            onChange={(e) => setTakerAmountStr(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
          />
          <p className="text-[11px] text-arc-muted mt-1">
            This should match the rate you agreed with the maker.
          </p>
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
            ? "Taking quote… (confirm in wallet)"
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

function KitField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <div className="text-xs text-arc-muted mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-umbra-glow bg-arc-dark border border-arc-border rounded p-2 truncate">
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-xs text-arc-muted hover:text-white transition-colors px-2 py-1 border border-arc-border rounded"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
