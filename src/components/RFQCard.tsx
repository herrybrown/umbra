"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  formatExpiry,
  formatTimestamp,
  pairLabel,
  makerTokenLabel,
  takerTokenLabel,
  shortenAddress,
  statusLabel,
  statusColor,
  cn,
} from "@/lib/utils";
import { loadKit } from "@/lib/crypto";

interface Trade {
  id: bigint;
  maker: `0x${string}`;
  taker: `0x${string}`;
  pair: number;
  status: number;
  expiresAt: bigint;
  createdAt: bigint;
  bidCommitment: `0x${string}`;
  rfqRef: string;
}

interface Props {
  trade: Trade;
  onMatch?: () => void;
  onSettle?: () => void;
  onCancel?: () => void;
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function RFQCard({ trade, onMatch, onSettle, onCancel }: Props) {
  const { address } = useAccount();
  const isMaker = address?.toLowerCase() === trade.maker.toLowerCase();
  const isTaker = address?.toLowerCase() === trade.taker.toLowerCase();
  const isOpen = trade.status === 0;
  const isMatched = trade.status === 1;
  const isSettled = trade.status === 2;
  const isActive = isOpen || isMatched;
  const hasBidCriteria = trade.bidCommitment !== ZERO_BYTES32;
  const expiresAt = Number(trade.expiresAt);
  const participantRole = isMaker ? "maker" : isTaker ? "taker" : null;
  const auditKit = participantRole ? loadKit(Number(trade.id), participantRole) : null;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-all animate-fade-in",
        isActive
          ? "border-arc-border bg-arc-card hover:border-arc-border/80"
          : "border-arc-border/50 bg-arc-card/50 opacity-70"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-arc-muted">
              #{trade.id.toString()}
            </span>
            {trade.rfqRef && (
              <span className="font-mono text-xs text-umbra-glow">
                {trade.rfqRef}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium">{pairLabel(trade.pair)}</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                statusColor(trade.status)
              )}
            >
              {statusLabel(trade.status)}
            </span>
            {hasBidCriteria && isOpen && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-matched/30 text-matched bg-matched/10">
                CRITERIA SET
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="text-right shrink-0 ml-2">
            <div className="text-xs text-arc-muted">Expires in</div>
            <div
              className={cn(
                "text-sm font-mono",
                expiresAt - Date.now() / 1000 < 3600 ? "text-danger" : "text-white"
              )}
            >
              {formatExpiry(expiresAt)}
            </div>
          </div>
        )}
      </div>

      {/* Private amounts indicator */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1.5">
            Maker sends ({makerTokenLabel(trade.pair)})
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-umbra-purple" />
            <span className="text-xs font-mono text-umbra-glow tracking-widest">PRIVATE</span>
          </div>
        </div>
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1.5">
            Taker sends ({takerTokenLabel(trade.pair)})
          </div>
          {isOpen ? (
            <span className="text-xs text-arc-muted font-mono">Awaiting taker</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-umbra-purple" />
              <span className="text-xs font-mono text-umbra-glow tracking-widest">PRIVATE</span>
            </div>
          )}
        </div>
      </div>

      {/* Counterparties */}
      <div className="flex items-center justify-between text-xs text-arc-muted mb-4">
        <div>
          <span>Maker: </span>
          <span className="font-mono text-white">{shortenAddress(trade.maker)}</span>
          {isMaker && <span className="ml-1 text-umbra-glow">(you)</span>}
        </div>
        {trade.taker !== "0x0000000000000000000000000000000000000000" && (
          <div>
            <span>Taker: </span>
            <span className="font-mono text-white">{shortenAddress(trade.taker)}</span>
            {isTaker && <span className="ml-1 text-umbra-glow">(you)</span>}
          </div>
        )}
        <div className="font-mono text-arc-border">
          {formatTimestamp(Number(trade.createdAt))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {isOpen && !isMaker && onMatch && (
          <button
            onClick={onMatch}
            className="flex-1 py-2 rounded-lg bg-umbra-purple hover:bg-umbra-violet transition-colors text-sm font-medium text-white"
          >
            Take Quote
          </button>
        )}
        {isMatched && isMaker && onSettle && (
          <button
            onClick={onSettle}
            className="flex-1 py-2 rounded-lg bg-settled/20 hover:bg-settled/30 border border-settled/30 transition-colors text-sm font-medium text-settled"
          >
            Settle Trade
          </button>
        )}
        {isActive && isMaker && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-arc-border hover:border-danger/50 hover:text-danger transition-colors text-sm text-arc-muted"
          >
            Cancel
          </button>
        )}
        {isMatched && isTaker && (
          <div className="flex-1 text-center text-xs text-arc-muted py-2">
            Tokens locked — waiting for maker to settle
          </div>
        )}
        {!isActive && (
          <div className="flex-1 text-center text-xs text-arc-muted py-2">
            {isSettled ? "Trade settled" : "No further action"}
          </div>
        )}
      </div>

      {isSettled && participantRole && auditKit && (
        <AuditAccessPanel tradeId={trade.id} viewKey={auditKit.viewKey} />
      )}
    </div>
  );
}

function AuditAccessPanel({
  tradeId,
  viewKey,
}: {
  tradeId: bigint;
  viewKey: `0x${string}`;
}) {
  const [copiedField, setCopiedField] = useState<"tradeId" | "viewKey" | null>(null);

  async function copy(label: "tradeId" | "viewKey", value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div className="mt-4 rounded-lg border border-settled/30 bg-settled/5 p-3">
      <div className="text-xs text-settled font-medium mb-3">Audit access</div>
      <div className="space-y-2">
        <AuditRow
          label="Trade ID"
          value={tradeId.toString()}
          copied={copiedField === "tradeId"}
          onCopy={() => copy("tradeId", tradeId.toString())}
        />
        <AuditRow
          label="View Key"
          value={viewKey}
          copied={copiedField === "viewKey"}
          onCopy={() => copy("viewKey", viewKey)}
        />
      </div>
    </div>
  );
}

function AuditRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-arc-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded border border-arc-border bg-arc-dark p-2 text-[11px] font-mono text-white">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="shrink-0 rounded border border-arc-border px-2 py-1 text-xs text-arc-muted transition-colors hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
