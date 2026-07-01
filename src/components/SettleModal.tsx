"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useSettle, useApproveToken, useTokenAllowance } from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";
import { parseAmount, pairLabel, makerTokenLabel, takerTokenLabel } from "@/lib/utils";

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
  const { address } = useAccount();
  const isMaker = address?.toLowerCase() === trade.maker.toLowerCase();

  // My side (pre-fill from localStorage if available)
  const [myAmountStr, setMyAmountStr] = useState("");
  const [mySalt, setMySalt] = useState("");

  // Counterparty side (received from the other party)
  const [cpAmountStr, setCpAmountStr] = useState("");
  const [cpSalt, setCpSalt] = useState("");

  const [step, setStep] = useState<"idle" | "approving" | "settling" | "done">("idle");
  const [error, setError] = useState("");

  // Both parties need their send-token approved
  const makerSendToken = trade.pair === 0 ? USDC_ADDRESS : EURC_ADDRESS;
  const takerSendToken = trade.pair === 0 ? EURC_ADDRESS : USDC_ADDRESS;
  const myToken = isMaker ? makerSendToken : takerSendToken;

  const { data: allowance } = useTokenAllowance(myToken, address);
  const { approve } = useApproveToken();
  const { settle, isPending, isConfirming, isSuccess } = useSettle();

  const makerAmountStr = isMaker ? myAmountStr : cpAmountStr;
  const makerSaltStr = isMaker ? mySalt : cpSalt;
  const takerAmountStr = isMaker ? cpAmountStr : myAmountStr;
  const takerSaltStr = isMaker ? cpSalt : mySalt;

  const myParsedAmount = myAmountStr ? parseAmount(myAmountStr) : 0n;
  const needsApproval = (allowance ?? 0n) < myParsedAmount || (allowance ?? 0n) === 0n;

  const canSettle =
    myAmountStr && mySalt && cpAmountStr && cpSalt && mySalt.startsWith("0x") && cpSalt.startsWith("0x");

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      if (needsApproval) {
        setStep("approving");
        await approve(myToken);
      }

      setStep("settling");

      await settle({
        id: trade.id,
        makerAmount: parseAmount(makerAmountStr),
        makerSalt: makerSaltStr as `0x${string}`,
        takerAmount: parseAmount(takerAmountStr),
        takerSalt: takerSaltStr as `0x${string}`,
      });

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
            Both sides transferred. The amounts are now visible on the trade.
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
      <div className="text-xs text-arc-muted font-mono mb-4">
        #{trade.id.toString()} · {pairLabel(trade.pair)} · {trade.rfqRef}
      </div>

      <div className="p-3 rounded-lg bg-arc-dark border border-arc-border/50 mb-5 text-sm text-arc-muted">
        Share your settlement code and amount with your counterparty, then enter both sides here to complete the trade.
      </div>

      <form onSubmit={handleSettle} className="space-y-5">
        {/* My side */}
        <div>
          <div className="text-xs text-umbra-glow uppercase tracking-wider mb-3">
            {isMaker ? "You (maker)" : "You (taker)"} · sending {isMaker ? makerTokenLabel(trade.pair) : takerTokenLabel(trade.pair)}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-arc-muted mb-1 block">Your Amount</label>
              <input
                type="text"
                placeholder="1000000.00"
                value={myAmountStr}
                onChange={(e) => setMyAmountStr(e.target.value)}
                required
                className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
              />
            </div>
            <div>
              <label className="text-xs text-arc-muted mb-1 block">Your settlement code</label>
              <input
                type="text"
                placeholder="0x..."
                value={mySalt}
                onChange={(e) => setMySalt(e.target.value)}
                required
                className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
              />
            </div>
          </div>
        </div>

        {/* Counterparty side */}
        <div>
          <div className="text-xs text-arc-muted uppercase tracking-wider mb-3">
            {isMaker ? "Counterparty (taker)" : "Counterparty (maker)"} · sending{" "}
            {isMaker ? takerTokenLabel(trade.pair) : makerTokenLabel(trade.pair)}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-arc-muted mb-1 block">Their amount</label>
              <input
                type="text"
                placeholder="920000.00"
                value={cpAmountStr}
                onChange={(e) => setCpAmountStr(e.target.value)}
                required
                className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
              />
            </div>
            <div>
              <label className="text-xs text-arc-muted mb-1 block">Their settlement code</label>
              <input
                type="text"
                placeholder="0x..."
                value={cpSalt}
                onChange={(e) => setCpSalt(e.target.value)}
                required
                className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSettle || step !== "idle"}
          className="w-full py-2.5 rounded-lg bg-settled/20 hover:bg-settled/30 border border-settled/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-settled font-medium text-sm"
        >
          {step === "approving"
            ? "Approving token… (confirm in wallet)"
            : step === "settling" || isConfirming
            ? "Settling… (confirm in wallet)"
            : needsApproval
            ? "Approve & Settle"
            : "Confirm & Settle"}
        </button>
      </form>
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
