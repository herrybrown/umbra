import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// USDC / EURC both use 6 decimals
export function formatAmount(amount: bigint, decimals = 2): string {
  const n = Number(amount) / 1_000_000;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function parseAmount(display: string): bigint {
  const clean = display.replace(/[^0-9.]/g, "");
  const [whole, frac = ""] = clean.split(".");
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded);
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatExpiry(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = ts - now;
  if (remaining <= 0) return "Expired";
  if (remaining < 60) return `${remaining}s`;
  if (remaining < 3600) return `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
  if (remaining < 86400) return `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
  return `${Math.floor(remaining / 86400)}d`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusLabel(status: number): string {
  return ["OPEN", "MATCHED", "SETTLED", "CANCELLED", "EXPIRED"][status] ?? "UNKNOWN";
}

export function statusColor(status: number): string {
  return [
    "text-umbra-glow bg-umbra-purple/10 border-umbra-purple/30",   // OPEN
    "text-matched bg-matched/10 border-matched/30",                  // MATCHED
    "text-settled bg-settled/10 border-settled/30",                  // SETTLED
    "text-arc-muted bg-arc-muted/10 border-arc-muted/30",           // CANCELLED
    "text-danger bg-danger/10 border-danger/30",                     // EXPIRED
  ][status] ?? "text-arc-muted";
}

export function pairLabel(pair: number): string {
  return pair === 0 ? "USDC → EURC" : "EURC → USDC";
}

export function makerTokenLabel(pair: number): string {
  return pair === 0 ? "USDC" : "EURC";
}

export function takerTokenLabel(pair: number): string {
  return pair === 0 ? "EURC" : "USDC";
}
