"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256, encodePacked } from "viem";
import {
  generateViewKey,
  viewKeyHash as hashViewKey,
  encryptDetails,
  saveKit,
  downloadSettlementKit,
  type SettlementKit,
} from "@/lib/crypto";
import { parseAmount } from "@/lib/utils";
import { useCreateRFQ, useApproveToken, useTokenAllowance } from "@/hooks/useUmbraOTC";
import { USDC_ADDRESS, EURC_ADDRESS } from "@/lib/contracts";

const TOKENS = [
  { address: USDC_ADDRESS, symbol: "USDC" },
  { address: EURC_ADDRESS, symbol: "EURC" },
] as const;

const ZERO_COMMITMENT = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateRFQModal({ onClose, onSuccess }: Props) {
  const { address } = useAccount();

  const [makerToken, setMakerToken] = useState<`0x${string}`>(USDC_ADDRESS);
  const [takerToken, setTakerToken] = useState<`0x${string}`>(EURC_ADDRESS);
  const [makerAmountStr, setMakerAmountStr] = useState("");
  const [bidAmountStr, setBidAmountStr] = useState("");
  const [institution, setInstitution] = useState("");
  const [rfqRef, setRfqRef] = useState("");
  const [preferredTaker, setPreferredTaker] = useState("");
  const [expiryHours, setExpiryHours] = useState("4");
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">("idle");
  const [error, setError] = useState("");
  const [createdKit, setCreatedKit] = useState<SettlementKit | null>(null);

  const pair: 0 | 1 = makerToken === USDC_ADDRESS ? 0 : 1;
  const makerSymbol = TOKENS.find((t) => t.address === makerToken)?.symbol ?? "USDC";
  const takerSymbol = TOKENS.find((t) => t.address === takerToken)?.symbol ?? "EURC";

  function onMakerTokenChange(addr: `0x${string}`) {
    setMakerToken(addr);
    setTakerToken(addr === USDC_ADDRESS ? EURC_ADDRESS : USDC_ADDRESS);
  }

  function onTakerTokenChange(addr: `0x${string}`) {
    setTakerToken(addr);
    setMakerToken(addr === USDC_ADDRESS ? EURC_ADDRESS : USDC_ADDRESS);
  }

  const { data: allowance } = useTokenAllowance(makerToken, address);
  const { approve } = useApproveToken();
  const { create, isConfirming } = useCreateRFQ();

  const parsedMakerAmount = makerAmountStr ? parseAmount(makerAmountStr) : 0n;
  const parsedBidAmount = bidAmountStr ? parseAmount(bidAmountStr) : 0n;
  const needsApproval = (allowance ?? 0n) < parsedMakerAmount;

  // Bid commitment: keccak256(expectedTakerAmount) if set, else zero bytes
  const bidCommitment: `0x${string}` = parsedBidAmount > 0n
    ? keccak256(encodePacked(["uint256"], [parsedBidAmount]))
    : ZERO_COMMITMENT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setError("");

    try {
      if (needsApproval) {
        setStep("approving");
        await approve(makerToken);
      }

      setStep("creating");

      const viewKey = generateViewKey();
      const makerViewKeyHash = hashViewKey(viewKey);

      const encrypted = await encryptDetails(
        {
          amount: parsedMakerAmount.toString(),
          bidAmount: parsedBidAmount > 0n ? parsedBidAmount.toString() : undefined,
          institution,
          ref: rfqRef,
          currency: makerSymbol,
          takerCurrency: takerSymbol,
          ts: Math.floor(Date.now() / 1000),
        },
        viewKey
      );

      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + Number(expiryHours) * 3600);

      const result = await create({
        pair,
        makerAmount: parsedMakerAmount,
        bidCommitment,
        encrypted: encrypted as `0x${string}`,
        makerViewKeyHash,
        preferredTaker: (preferredTaker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
        expiresAt,
        rfqRef,
      });

      if (result.tradeId === null) {
        throw new Error("Quote was created, but its trade ID could not be read from the receipt.");
      }

      const kit: SettlementKit = {
        tradeId: Number(result.tradeId),
        amount: parsedMakerAmount.toString(),
        viewKey,
        role: "maker",
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
        <h2 className="text-lg font-semibold text-white mb-1">Quote posted</h2>
        <p className="text-sm text-arc-muted mb-5">
          Your tokens are locked in escrow. Keep this audit kit so the maker
          disclosure can be reviewed later.
        </p>

        <div className="mb-5 space-y-3">
          <CopyField label="Trade ID" value={createdKit.tradeId.toString()} />
          <CopyField
            label="Maker view key"
            value={createdKit.viewKey}
          />
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
            className="rounded-lg bg-umbra-purple py-2.5 font-medium text-white transition-colors hover:bg-umbra-violet"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-white mb-1">New quote</h2>
      <p className="text-sm text-arc-muted mb-5">
        Amounts are omitted from quote cards. Your tokens are locked in escrow on posting.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Token pair */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              You send
            </label>
            <select
              value={makerToken}
              onChange={(e) => onMakerTokenChange(e.target.value as `0x${string}`)}
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
            >
              {TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              You receive
            </label>
            <select
              value={takerToken}
              onChange={(e) => onTakerTokenChange(e.target.value as `0x${string}`)}
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-umbra-purple"
            >
              {TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              Amount ({makerSymbol})
            </label>
            <input
              type="text"
              placeholder="0.00"
              value={makerAmountStr}
              onChange={(e) => setMakerAmountStr(e.target.value)}
              required
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
            />
          </div>
          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              Expected bid ({takerSymbol})
            </label>
            <input
              type="text"
              placeholder="0.00 (optional)"
              value={bidAmountStr}
              onChange={(e) => setBidAmountStr(e.target.value)}
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
            />
            <p className="text-[11px] text-arc-muted mt-1">
              If set, only takers who bid this exact amount get matched.
            </p>
          </div>
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
          disabled={step !== "idle" || !parsedMakerAmount}
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

function CopyField({ label, value }: { label: string; value: string }) {
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
