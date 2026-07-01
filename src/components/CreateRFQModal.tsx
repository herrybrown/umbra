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
import { parseAmount, formatAmount } from "@/lib/utils";
import { useCreateRFQ, useApproveToken, useTokenAllowance } from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateRFQModal({ onClose, onSuccess }: Props) {
  const { address } = useAccount();

  const [pair, setPair] = useState<0 | 1>(0);
  const [amountStr, setAmountStr] = useState("");
  const [institution, setInstitution] = useState("");
  const [rfqRef, setRfqRef] = useState("");
  const [preferredTaker, setPreferredTaker] = useState("");
  const [expiryHours, setExpiryHours] = useState("4");
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">("idle");
  const [error, setError] = useState("");
  const [kitCopy, setKitCopy] = useState<{ viewKey: string; salt: string; amount: string } | null>(null);

  const sendToken = pair === 0 ? USDC_ADDRESS : EURC_ADDRESS;
  const { data: allowance } = useTokenAllowance(sendToken, address);
  const { approve, isPending: isApproving } = useApproveToken();
  const { create, isPending: isCreating, isConfirming } = useCreateRFQ();

  const parsedAmount = amountStr ? parseAmount(amountStr) : 0n;
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

      setStep("creating");

      const salt = generateSalt();
      const viewKey = generateViewKey();
      const commitment = commitAmount(parsedAmount, salt);
      const vkHash = hashViewKey(viewKey);

      const encrypted = await encryptDetails(
        {
          amount: parsedAmount.toString(),
          institution,
          ref: rfqRef,
          currency: pair === 0 ? "USDC" : "EURC",
          ts: Math.floor(Date.now() / 1000),
        },
        viewKey
      );

      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + Number(expiryHours) * 3600);

      await create({
        pair,
        commitment,
        encrypted: encrypted as `0x${string}`,
        viewKeyHash: vkHash,
        preferredTaker: (preferredTaker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
        expiresAt,
        rfqRef,
      });

      // Save settlement kit for later use
      const nextId = Date.now(); // approximate — will be overwritten on re-load
      saveKit({
        tradeId: nextId,
        amount: parsedAmount.toString(),
        salt,
        viewKey,
        role: "maker",
      });

      setKitCopy({ viewKey, salt, amount: parsedAmount.toString() });
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
        <h2 className="text-lg font-semibold text-white mb-1">Quote posted</h2>
        <p className="text-sm text-arc-muted mb-5">
          Save these. You will need them to settle the trade. Share the view key with your auditor.
        </p>

        <div className="space-y-3 mb-6">
          <KitField label="View key (share with your auditor)" value={kitCopy.viewKey} />
          <KitField label="Settlement code (keep this private)" value={kitCopy.salt} />
          <KitField label="Your amount" value={formatAmount(BigInt(kitCopy.amount))} />
        </div>

        <div className="p-3 rounded-lg bg-matched/10 border border-matched/30 text-sm text-matched mb-5">
          Wait for someone to take your quote. Once matched, share your settlement code and amount with them to complete the trade.
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
      <h2 className="text-lg font-semibold text-white mb-1">New quote</h2>
      <p className="text-sm text-arc-muted mb-5">
        Your amount stays hidden until both sides settle. Firm name and reference are encrypted and only readable with your view key.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pair */}
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 0, label: "Send USDC → Receive EURC" },
              { val: 1, label: "Send EURC → Receive USDC" },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setPair(val as 0 | 1)}
                className={`py-2 rounded-lg border text-sm transition-colors ${
                  pair === val
                    ? "border-umbra-purple bg-umbra-purple/10 text-umbra-glow"
                    : "border-arc-border text-arc-muted hover:border-arc-border/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Amount ({pair === 0 ? "USDC" : "EURC"})
          </label>
          <input
            type="text"
            placeholder="1000000.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
          />
        </div>

        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Trade reference
          </label>
          <input
            type="text"
            placeholder="TRADE-001"
            value={rfqRef}
            onChange={(e) => setRfqRef(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
          />
        </div>

        {/* Institution */}
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Your firm name
          </label>
          <input
            type="text"
            placeholder="Acme Capital"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            required
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
          />
        </div>

        {/* Expiry */}
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Expiry (hours)
          </label>
          <select
            value={expiryHours}
            onChange={(e) => setExpiryHours(e.target.value)}
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
          >
            {["1", "2", "4", "8", "12", "24", "48", "72"].map((h) => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
        </div>

        {/* Preferred taker (optional) */}
        <div>
          <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
            Specific counterparty (optional)
          </label>
          <input
            type="text"
            placeholder="0x… (leave blank for open market)"
            value={preferredTaker}
            onChange={(e) => setPreferredTaker(e.target.value)}
            className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
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
            ? "Approving spend… (confirm in wallet)"
            : step === "creating" || isConfirming
            ? "Posting quote… (confirm in wallet)"
            : needsApproval
            ? "Approve & Post Quote"
            : "Post Quote"}
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
