"use client";

import { useState } from "react";
import { decryptDetails } from "@/lib/crypto";
import { useTrade, useVerifyViewKey } from "@/hooks/useUmbraOTC";
import { formatAmount, formatTimestamp, statusLabel, statusColor, pairLabel, cn } from "@/lib/utils";

export function AuditDecoder() {
  const [tradeIdStr, setTradeIdStr] = useState("");
  const [viewKeyStr, setViewKeyStr] = useState("");
  const [decrypted, setDecrypted] = useState<{
    maker?: { amount: string; institution: string; ref: string; currency: string; ts: number };
    taker?: { amount: string; institution: string; ref: string; currency: string; ts: number };
  } | null>(null);
  const [decryptError, setDecryptError] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);

  const tradeId = tradeIdStr ? BigInt(tradeIdStr) : undefined;
  const viewKey = viewKeyStr.startsWith("0x") ? (viewKeyStr as `0x${string}`) : undefined;

  const { data: trade } = useTrade(tradeId);
  const { data: isValidKey } = useVerifyViewKey(tradeId, viewKey);

  async function handleDecrypt() {
    if (!trade || !viewKey) return;
    setDecryptError("");
    setDecrypted(null);
    setIsDecrypting(true);

    try {
      const results: typeof decrypted = {};

      if (trade.makerEncrypted && trade.makerEncrypted !== "0x") {
        results.maker = await decryptDetails(trade.makerEncrypted, viewKey);
      }
      if (trade.takerEncrypted && trade.takerEncrypted !== "0x") {
        results.taker = await decryptDetails(trade.takerEncrypted, viewKey);
      }

      setDecrypted(results);
    } catch {
      setDecryptError(
        "Could not decrypt. Check that the view key is correct for this trade and try again."
      );
    } finally {
      setIsDecrypting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="rounded-xl border border-arc-border bg-arc-card p-6">
        <h2 className="text-sm font-medium text-white mb-1">Audit Access</h2>
        <p className="text-xs text-arc-muted mb-5">
          Enter a trade ID and the view key the trading parties shared with you. The details decrypt locally in your browser.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              Trade ID
            </label>
            <input
              type="number"
              placeholder="0"
              min="0"
              value={tradeIdStr}
              onChange={(e) => {
                setTradeIdStr(e.target.value);
                setDecrypted(null);
              }}
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
            />
          </div>

          <div>
            <label className="text-xs text-arc-muted uppercase tracking-wider mb-2 block">
              View Key
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={viewKeyStr}
              onChange={(e) => {
                setViewKeyStr(e.target.value);
                setDecrypted(null);
              }}
              className="w-full bg-arc-dark border border-arc-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-umbra-purple"
            />
            {viewKey && trade && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isValidKey ? "bg-settled" : "bg-danger"}`}
                />
                <span className={`text-xs ${isValidKey ? "text-settled" : "text-danger"}`}>
                  {isValidKey ? "View key verified" : "View key doesn't match this trade"}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleDecrypt}
            disabled={!trade || !viewKey || !isValidKey || isDecrypting}
            className="w-full py-2.5 rounded-lg bg-umbra-purple hover:bg-umbra-violet disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-medium text-sm"
          >
            {isDecrypting ? "Decrypting…" : "Reveal trade details"}
          </button>
        </div>
      </div>

      {/* Trade overview (public data) */}
      {trade && (
        <div className="rounded-xl border border-arc-border bg-arc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">
              Trade #{trade.id.toString()}
            </h3>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                statusColor(trade.status)
              )}
            >
              {statusLabel(trade.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Pair" value={pairLabel(trade.pair)} />
            <Field label="Reference" value={trade.rfqRef || "—"} />
            <Field label="Created" value={formatTimestamp(Number(trade.createdAt))} />
            <Field label="Expires" value={formatTimestamp(Number(trade.expiresAt))} />
            <Field label="Maker" value={trade.maker} mono />
            <Field label="Taker" value={trade.taker === "0x0000000000000000000000000000000000000000" ? "Open" : trade.taker} mono />
            {trade.status === 2 && (
              <>
                <Field
                  label="Maker amount"
                  value={formatAmount(trade.makerAmount)}
                  highlight
                />
                <Field
                  label="Taker amount"
                  value={formatAmount(trade.takerAmount)}
                  highlight
                />
              </>
            )}
          </div>

          {/* Commitment fingerprints */}
          <div className="mt-4 p-3 rounded-lg bg-arc-dark border border-arc-border/50">
            <div className="text-[10px] text-arc-muted uppercase tracking-wider mb-2">
              Onchain record
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[10px] text-arc-muted break-all">
                <span className="text-umbra-glow">M:</span> {trade.makerCommitment}
              </div>
              {trade.takerCommitment !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                <div className="font-mono text-[10px] text-arc-muted break-all">
                  <span className="text-umbra-glow">T:</span> {trade.takerCommitment}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decrypted details */}
      {decryptError && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {decryptError}
        </div>
      )}

      {decrypted && (
        <div className="rounded-xl border border-settled/30 bg-settled/5 p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-settled" />
            <h3 className="text-sm font-medium text-settled">Trade details</h3>
          </div>

          <div className="space-y-4">
            {decrypted.maker && (
              <div>
                <div className="text-xs text-umbra-glow uppercase tracking-wider mb-2">Maker</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Institution" value={decrypted.maker.institution} />
                  <Field label="Currency" value={decrypted.maker.currency} />
                  <Field label="Amount" value={formatAmount(BigInt(decrypted.maker.amount))} mono />
                  <Field label="Reference" value={decrypted.maker.ref} />
                  <Field label="Timestamp" value={formatTimestamp(decrypted.maker.ts)} />
                </div>
              </div>
            )}
            {decrypted.taker && (
              <div>
                <div className="text-xs text-umbra-glow uppercase tracking-wider mb-2">Taker</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Institution" value={decrypted.taker.institution} />
                  <Field label="Currency" value={decrypted.taker.currency} />
                  <Field label="Amount" value={formatAmount(BigInt(decrypted.taker.amount))} mono />
                  <Field label="Reference" value={decrypted.taker.ref} />
                  <Field label="Timestamp" value={formatTimestamp(decrypted.taker.ts)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-arc-muted mb-0.5">{label}</div>
      <div
        className={cn(
          "text-sm break-all",
          mono ? "font-mono" : "",
          highlight ? "text-settled font-medium" : "text-white"
        )}
      >
        {value}
      </div>
    </div>
  );
}
