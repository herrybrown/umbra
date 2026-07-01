"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  formatAmount,
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

interface Trade {
  id: bigint;
  maker: `0x${string}`;
  taker: `0x${string}`;
  pair: number;
  status: number;
  expiresAt: bigint;
  createdAt: bigint;
  makerCommitment: `0x${string}`;
  takerCommitment: `0x${string}`;
  makerEncrypted: `0x${string}`;
  takerEncrypted: `0x${string}`;
  viewKeyHash: `0x${string}`;
  makerAmount: bigint;
  takerAmount: bigint;
  rfqRef: string;
}

interface Props {
  trade: Trade;
  onMatch?: () => void;
  onSettle?: () => void;
  onCancel?: () => void;
}

export function RFQCard({ trade, onMatch, onSettle, onCancel }: Props) {
  const { address } = useAccount();
  const isMaker = address?.toLowerCase() === trade.maker.toLowerCase();
  const isTaker = address?.toLowerCase() === trade.taker.toLowerCase();
  const isParty = isMaker || isTaker;
  const isOpen = trade.status === 0;
  const isMatched = trade.status === 1;
  const isSettled = trade.status === 2;
  const isActive = isOpen || isMatched;
  const expiresAt = Number(trade.expiresAt);

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
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{pairLabel(trade.pair)}</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                statusColor(trade.status)
              )}
            >
              {statusLabel(trade.status)}
            </span>
          </div>
        </div>

        {isActive && (
          <div className="text-right">
            <div className="text-xs text-arc-muted">Expires in</div>
            <div
              className={cn(
                "text-sm font-mono",
                expiresAt - Date.now() / 1000 < 3600
                  ? "text-danger"
                  : "text-white"
              )}
            >
              {formatExpiry(expiresAt)}
            </div>
          </div>
        )}
      </div>

      {/* Confidential amounts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1">
            Maker sends ({makerTokenLabel(trade.pair)})
          </div>
          {isSettled ? (
            <div className="font-mono text-sm text-white">
              {formatAmount(trade.makerAmount)}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-umbra-purple animate-pulse" />
              <span className="text-xs font-mono text-umbra-glow">
                CONFIDENTIAL
              </span>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-arc-dark border border-arc-border/50 p-3">
          <div className="text-xs text-arc-muted mb-1">
            Taker sends ({takerTokenLabel(trade.pair)})
          </div>
          {isSettled ? (
            <div className="font-mono text-sm text-white">
              {formatAmount(trade.takerAmount)}
            </div>
          ) : isMatched ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-umbra-purple animate-pulse" />
              <span className="text-xs font-mono text-umbra-glow">
                CONFIDENTIAL
              </span>
            </div>
          ) : (
            <span className="text-xs text-arc-muted font-mono">Awaiting taker</span>
          )}
        </div>
      </div>

      {/* Counterparties */}
      <div className="flex items-center justify-between text-xs text-arc-muted mb-4">
        <div>
          <span>Maker: </span>
          <span className="font-mono text-white">
            {shortenAddress(trade.maker)}
          </span>
          {isMaker && (
            <span className="ml-1 text-umbra-glow">(you)</span>
          )}
        </div>
        {trade.taker !== "0x0000000000000000000000000000000000000000" && (
          <div>
            <span>Taker: </span>
            <span className="font-mono text-white">
              {shortenAddress(trade.taker)}
            </span>
            {isTaker && <span className="ml-1 text-umbra-glow">(you)</span>}
          </div>
        )}
        <div className="font-mono text-arc-border">
          {formatTimestamp(Number(trade.createdAt))}
        </div>
      </div>

      {(isMatched || isSettled) && (
        <div className="mb-4 p-2 rounded bg-arc-dark border border-arc-border/30">
          <div className="text-[10px] text-arc-muted mb-1 uppercase tracking-wider">
            Trade record
          </div>
          <div className="font-mono text-[10px] text-arc-muted truncate">
            M: {trade.makerCommitment.slice(0, 20)}…
          </div>
          <div className="font-mono text-[10px] text-arc-muted truncate">
            T: {trade.takerCommitment.slice(0, 20)}…
          </div>
        </div>
      )}

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
        {isMatched && isParty && onSettle && (
          <button
            onClick={onSettle}
            className="flex-1 py-2 rounded-lg bg-settled/20 hover:bg-settled/30 border border-settled/30 transition-colors text-sm font-medium text-settled"
          >
            Settle Trade
          </button>
        )}
        {isActive && isParty && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-arc-border hover:border-danger/50 hover:text-danger transition-colors text-sm text-arc-muted"
          >
            Cancel
          </button>
        )}
        {!isActive && (
          <div className="flex-1 text-center text-xs text-arc-muted py-2">
            {isSettled ? "Trade settled — amounts revealed above" : "No further action"}
          </div>
        )}
      </div>
    </div>
  );
}
