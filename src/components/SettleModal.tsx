"use client";

import { useState } from "react";
import { useSettle } from "@/hooks/useUmbraOTC";
import { pairLabel, makerTokenLabel, takerTokenLabel } from "@/lib/utils";

interface Trade {
  id: bigint;
  maker: `0x${string}`;
  taker: `0x${string}`;
  pair: number;
  rfqRef: string;
}

interface Props {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SettleModal({ trade, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"idle" | "settling" | "done">("idle");
  const [error, setError] = useState("");
  const { settle, isConfirming } = useSettle();

  async function handleSettle() {
    setError("");
    try {
      setStep("settling");
      await settle(trade.id);
      setStep("done");
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e?.shortMessage ?? e?.message ?? "Settlement failed");
      setStep("idle");
    }
  }

  if (step === "done") {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-settled/20 border border-settled/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-settled text-xl">✓</span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Trade Settled</h2>
          <p className="text-sm text-arc-muted mb-6">
            Escrowed tokens have been swapped. The trade is complete.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-settled/20 border border-settled/30 text-settled font-medium"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-white mb-1">Settle Trade</h2>
      <div className="text-xs text-arc-muted font-mono mb-5">
        #{trade.id.toString()} · {pairLabel(trade.pair)} · {trade.rfqRef}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1.5">You send ({makerTokenLabel(trade.pair)})</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-umbra-purple" />
            <span className="text-xs font-mono text-umbra-glow tracking-widest">PRIVATE</span>
          </div>
        </div>
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1.5">You receive ({takerTokenLabel(trade.pair)})</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-umbra-purple" />
            <span className="text-xs font-mono text-umbra-glow tracking-widest">PRIVATE</span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-arc-dark border border-arc-border/50 text-sm text-arc-muted mb-5">
        Settling will atomically swap your escrowed {makerTokenLabel(trade.pair)} for the taker&apos;s escrowed {takerTokenLabel(trade.pair)}.
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSettle}
        disabled={step !== "idle"}
        className="w-full py-2.5 rounded-lg bg-settled/20 hover:bg-settled/30 border border-settled/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-settled font-medium text-sm"
      >
        {step === "settling" || isConfirming
          ? "Settling… (confirm in wallet)"
          : "Confirm & Settle"}
      </button>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-arc-card border border-arc-border rounded-2xl p-6 relative animate-fade-in">
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
