"use client";

import { keccak256, encodePacked } from "viem";

// ─── Commitment scheme ────────────────────────────────────────────────────────

export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function generateViewKey(): `0x${string}` {
  return generateSalt();
}

/**
 * Compute commitment = keccak256(abi.encodePacked(amount, salt)).
 * Mirrors the Solidity: keccak256(abi.encodePacked(amount, salt))
 */
export function commitAmount(
  amount: bigint,
  salt: `0x${string}`
): `0x${string}` {
  return keccak256(encodePacked(["uint256", "bytes32"], [amount, salt]));
}

export function viewKeyHash(viewKey: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(["bytes32"], [viewKey]));
}

// ─── AES-GCM encryption (simulates TEE encryption layer) ─────────────────────

export interface TradeDetails {
  amount: string; // bigint as string
  bidAmount?: string; // expected taker amount, bigint as string
  institution: string;
  ref: string;
  currency: string; // maker token symbol
  takerCurrency?: string; // taker token symbol
  ts: number;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(viewKey: `0x${string}`): Promise<CryptoKey> {
  const raw = hexToBytes(viewKey).slice(0, 32);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptDetails(
  details: TradeDetails,
  viewKey: `0x${string}`
): Promise<string> {
  const key = await importKey(viewKey);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const plaintext = new TextEncoder().encode(JSON.stringify(details));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  // [iv (12 bytes)][ciphertext]
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), 12);
  return "0x" + bytesToHex(result);
}

export async function decryptDetails(
  encryptedHex: string,
  viewKey: `0x${string}`
): Promise<TradeDetails> {
  const key = await importKey(viewKey);
  const raw = hexToBytes(encryptedHex);

  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!isTradeDetails(parsed)) {
    throw new Error("Decrypted disclosure has an invalid format.");
  }
  return parsed;
}

function isTradeDetails(value: unknown): value is TradeDetails {
  if (!value || typeof value !== "object") return false;

  const details = value as Partial<TradeDetails>;
  return (
    typeof details.amount === "string" &&
    /^\d+$/.test(details.amount) &&
    (details.bidAmount === undefined ||
      (typeof details.bidAmount === "string" &&
        /^\d+$/.test(details.bidAmount))) &&
    typeof details.institution === "string" &&
    typeof details.ref === "string" &&
    typeof details.currency === "string" &&
    (details.takerCurrency === undefined ||
      typeof details.takerCurrency === "string") &&
    typeof details.ts === "number" &&
    Number.isSafeInteger(details.ts) &&
    details.ts >= 0
  );
}

// ─── Local settlement kit storage ────────────────────────────────────────────

export interface SettlementKit {
  tradeId: number;
  amount: string;
  viewKey: `0x${string}`;
  role: "maker" | "taker";
}

const STORAGE_KEY = "umbra_settlement_kits";
const VIEW_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isViewKey(value: string): value is `0x${string}` {
  return VIEW_KEY_PATTERN.test(value.trim());
}

export function normalizeViewKey(value: string): `0x${string}` | undefined {
  const trimmed = value.trim();
  return isViewKey(trimmed) ? (trimmed.toLowerCase() as `0x${string}`) : undefined;
}

export function saveKit(kit: SettlementKit): void {
  const kits = loadAllKits();
  const idx = kits.findIndex(
    (k) => k.tradeId === kit.tradeId && k.role === kit.role
  );
  if (idx >= 0) kits[idx] = kit;
  else kits.push(kit);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kits));
}

export function loadKit(
  tradeId: number,
  role: "maker" | "taker"
): SettlementKit | null {
  const kits = loadAllKits();
  return kits.find((k) => k.tradeId === tradeId && k.role === role) ?? null;
}

export function loadAllKits(): SettlementKit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((kit): kit is SettlementKit => {
      if (!kit || typeof kit !== "object") return false;
      const candidate = kit as Partial<SettlementKit>;
      return (
        Number.isSafeInteger(candidate.tradeId) &&
        typeof candidate.amount === "string" &&
        (candidate.role === "maker" || candidate.role === "taker") &&
        typeof candidate.viewKey === "string" &&
        isViewKey(candidate.viewKey)
      );
    });
  } catch {
    return [];
  }
}

export function downloadSettlementKit(kit: SettlementKit): void {
  const payload = {
    format: "umbra-audit-kit",
    version: 1,
    tradeId: kit.tradeId,
    role: kit.role,
    amount: kit.amount,
    viewKey: kit.viewKey,
    warning: "This file contains a private audit key. Share it only with an authorized reviewer.",
  };
  downloadJson(`umbra-trade-${kit.tradeId}-${kit.role}-audit-kit.json`, payload);
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
