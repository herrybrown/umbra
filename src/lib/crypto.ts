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
  institution: string;
  ref: string;
  currency: string; // "USDC" or "EURC"
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

  return JSON.parse(new TextDecoder().decode(plaintext)) as TradeDetails;
}

// ─── Local settlement kit storage ────────────────────────────────────────────

export interface SettlementKit {
  tradeId: number;
  amount: string;
  salt: `0x${string}`;
  viewKey: `0x${string}`;
  role: "maker" | "taker";
}

const STORAGE_KEY = "umbra_settlement_kits";

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
  return kits.find((k) => k.tradeId === tradeId && k.role === k.role) ?? null;
}

function loadAllKits(): SettlementKit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
