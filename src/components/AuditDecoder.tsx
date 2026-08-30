"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { padHex, toEventSelector, toHex, type Hex } from "viem";
import {
  decryptDetails,
  downloadJson,
  loadKit,
  normalizeViewKey,
  viewKeyHash,
  type TradeDetails,
} from "@/lib/crypto";
import {
  useMakerTrades,
  useNextTradeId,
  useTakerTrades,
  useTrade,
} from "@/hooks/useUmbraOTC";
import {
  UMBRA_OTC_ADDRESS,
  UMBRA_OTC_DEPLOYMENT_BLOCK,
} from "@/lib/contracts";
import { arcTestnet } from "@/lib/chains";
import {
  formatAmount,
  formatTimestamp,
  statusLabel,
  statusColor,
  pairLabel,
  cn,
} from "@/lib/utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVENT_TYPES = new Map<string, AuditEventType>([
  [
    toEventSelector("TradeCreated(uint256,address,uint8,uint64,string)"),
    "Created",
  ],
  [toEventSelector("TradeMatched(uint256,address)"), "Matched"],
  [toEventSelector("TradeSettled(uint256)"), "Settled"],
  [toEventSelector("TradeCancelled(uint256)"), "Cancelled"],
  [toEventSelector("TradeExpired(uint256)"), "Expired"],
]);

type Role = "maker" | "taker";
type DisclosureState = Partial<Record<Role, TradeDetails>>;
type DisclosureErrors = Partial<Record<Role, string>>;
type AuditEventType = "Created" | "Matched" | "Settled" | "Cancelled" | "Expired";

interface AuditEvent {
  type: AuditEventType;
  transactionHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
}

interface ExplorerLog {
  blockNumber: string;
  logIndex: string;
  timeStamp?: string;
  topics: string[];
  transactionHash: Hex;
}

interface AuditDecoderProps {
  initialTradeId?: string;
}

export function AuditDecoder({ initialTradeId = "" }: AuditDecoderProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [tradeIdStr, setTradeIdStr] = useState(
    /^\d+$/.test(initialTradeId) ? initialTradeId : ""
  );
  const [makerKeyStr, setMakerKeyStr] = useState("");
  const [takerKeyStr, setTakerKeyStr] = useState("");
  const [decrypted, setDecrypted] = useState<DisclosureState | null>(null);
  const [decryptErrors, setDecryptErrors] = useState<DisclosureErrors>({});
  const [kitError, setKitError] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);

  const tradeId = parseTradeId(tradeIdStr);
  const { data: nextTradeId } = useNextTradeId();
  const tradeIsKnownMissing =
    tradeId !== undefined &&
    nextTradeId !== undefined &&
    tradeId >= nextTradeId;
  const shouldLoadTrade = tradeId !== undefined && !tradeIsKnownMissing;
  const {
    data: trade,
    isLoading: isTradeLoading,
    isError: isTradeError,
    error: tradeError,
    refetch: refetchTrade,
  } = useTrade(
    shouldLoadTrade ? tradeId : undefined
  );
  const { data: makerIds = [] } = useMakerTrades(address);
  const { data: takerIds = [] } = useTakerTrades(address);

  const makerViewKey = normalizeViewKey(makerKeyStr);
  const takerViewKey = normalizeViewKey(takerKeyStr);
  const makerKeyMatches =
    !!trade &&
    !!makerViewKey &&
    viewKeyHash(makerViewKey).toLowerCase() ===
      trade.makerViewKeyHash.toLowerCase();
  const takerKeyMatches =
    !!trade &&
    !!takerViewKey &&
    viewKeyHash(takerViewKey).toLowerCase() ===
      trade.takerViewKeyHash.toLowerCase();
  const hasTakerDisclosure =
    !!trade && trade.takerEncrypted !== "0x" && trade.taker !== ZERO_ADDRESS;
  const takerUsesDecryptionAuthentication =
    !!trade && trade.contractVersion === "legacy" && hasTakerDisclosure;
  const takerKeyEligible =
    !!takerViewKey &&
    (takerUsesDecryptionAuthentication || takerKeyMatches);

  const myTrades = useMemo(() => {
    const roles = new Map<string, Set<Role>>();
    for (const id of makerIds as readonly bigint[]) {
      roles.set(id.toString(), new Set(["maker"]));
    }
    for (const id of takerIds as readonly bigint[]) {
      const key = id.toString();
      const existing = roles.get(key) ?? new Set<Role>();
      existing.add("taker");
      roles.set(key, existing);
    }

    return Array.from(roles.entries())
      .map(([id, tradeRoles]) => ({
        id: BigInt(id),
        roles: Array.from(tradeRoles),
      }))
      .sort((a, b) => (a.id > b.id ? -1 : 1));
  }, [makerIds, takerIds]);

  useEffect(() => {
    if (!trade || !address) return;

    const normalizedAddress = address.toLowerCase();
    const numericTradeId = Number(trade.id);

    if (trade.maker.toLowerCase() === normalizedAddress) {
      const kit = loadKit(numericTradeId, "maker");
      if (kit) setMakerKeyStr((current) => current || kit.viewKey);
    }

    if (trade.taker.toLowerCase() === normalizedAddress) {
      const kit = loadKit(numericTradeId, "taker");
      if (kit) setTakerKeyStr((current) => current || kit.viewKey);
    }
  }, [address, trade]);

  useEffect(() => {
    if (!shouldLoadTrade || tradeId === undefined) {
      setAuditEvents([]);
      setEventsError("");
      setEventsLoading(false);
      return;
    }

    let cancelled = false;
    setAuditEvents([]);
    setEventsError("");
    setEventsLoading(true);

    async function loadAuditEvents() {
      if (tradeId === undefined) return;

      try {
        const query = new URLSearchParams({
          module: "logs",
          action: "getLogs",
          address: UMBRA_OTC_ADDRESS,
          fromBlock: UMBRA_OTC_DEPLOYMENT_BLOCK.toString(),
          toBlock: "latest",
          topic1: padHex(toHex(tradeId), { size: 32 }),
        });
        const response = await fetch(
          `${arcTestnet.blockExplorers.default.url}/api?${query.toString()}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Explorer request failed.");

        const body: unknown = await response.json();
        if (!body || typeof body !== "object") {
          throw new Error("Explorer returned an invalid response.");
        }

        const result = (body as { result?: unknown }).result;
        if (!Array.isArray(result)) {
          throw new Error("Explorer returned an invalid log list.");
        }

        const timeline = (result as ExplorerLog[])
          .flatMap((log): AuditEvent[] => {
            const type = EVENT_TYPES.get(log.topics?.[0]?.toLowerCase());
            if (
              !type ||
              typeof log.blockNumber !== "string" ||
              typeof log.logIndex !== "string" ||
              typeof log.transactionHash !== "string"
            ) {
              return [];
            }

            return [
              {
                type,
                transactionHash: log.transactionHash,
                blockNumber: BigInt(log.blockNumber),
                logIndex: Number(BigInt(log.logIndex)),
                timestamp: log.timeStamp ? Number(BigInt(log.timeStamp)) : 0,
              },
            ];
          })
          .sort((a, b) => {
            if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
            return a.blockNumber < b.blockNumber ? -1 : 1;
          });

        if (!cancelled) setAuditEvents(timeline);
      } catch {
        if (!cancelled) {
          setEventsError("Onchain event history is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }

    loadAuditEvents();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadTrade, tradeId]);

  function selectTrade(id: bigint) {
    const value = id.toString();
    setTradeIdStr(value);
    setMakerKeyStr("");
    setTakerKeyStr("");
    setDecrypted(null);
    setDecryptErrors({});
    setKitError("");
    router.replace(`/audit?trade=${value}`, { scroll: false });
  }

  async function importAuditKit(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setKitError("");

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid audit kit.");
      }

      const kit = parsed as {
        format?: unknown;
        tradeId?: unknown;
        role?: unknown;
        viewKey?: unknown;
      };
      if (
        kit.format !== "umbra-audit-kit" ||
        !Number.isSafeInteger(kit.tradeId) ||
        Number(kit.tradeId) < 0 ||
        (kit.role !== "maker" && kit.role !== "taker") ||
        typeof kit.viewKey !== "string" ||
        !normalizeViewKey(kit.viewKey)
      ) {
        throw new Error("This file is not a valid Umbra audit kit.");
      }

      const importedTradeId = Number(kit.tradeId);
      const importedKey = normalizeViewKey(kit.viewKey);
      if (!importedKey) throw new Error("The audit kit contains an invalid key.");

      if (tradeIdStr !== importedTradeId.toString()) {
        setMakerKeyStr("");
        setTakerKeyStr("");
      }

      setTradeIdStr(importedTradeId.toString());
      if (kit.role === "maker") setMakerKeyStr(importedKey);
      else setTakerKeyStr(importedKey);
      setDecrypted(null);
      setDecryptErrors({});
      router.replace(`/audit?trade=${importedTradeId}`, { scroll: false });
    } catch (error) {
      setKitError(
        error instanceof Error ? error.message : "The audit kit could not be read."
      );
    } finally {
      input.value = "";
    }
  }

  async function handleDecrypt() {
    if (!trade) return;

    setDecryptErrors({});
    setIsDecrypting(true);

    const results: DisclosureState = {};
    const errors: DisclosureErrors = {};

    if (makerKeyMatches && makerViewKey && trade.makerEncrypted !== "0x") {
      try {
        results.maker = await decryptDetails(
          trade.makerEncrypted,
          makerViewKey
        );
      } catch {
        errors.maker = "The maker disclosure could not be decrypted.";
      }
    }

    if (takerKeyEligible && takerViewKey && hasTakerDisclosure) {
      try {
        results.taker = await decryptDetails(
          trade.takerEncrypted,
          takerViewKey
        );
      } catch {
        errors.taker = "The taker disclosure could not be decrypted.";
      }
    }

    setDecrypted(results);
    setDecryptErrors(errors);
    setIsDecrypting(false);
  }

  function exportAuditRecord() {
    if (!trade || !decrypted) return;

    const auditRecord = {
      format: "umbra-trade-audit",
      version: 1,
      generatedAt: new Date().toISOString(),
      network: {
        name: arcTestnet.name,
        chainId: arcTestnet.id,
        contract: UMBRA_OTC_ADDRESS,
      },
      trade: {
        id: trade.id.toString(),
        contractVersion: trade.contractVersion,
        maker: trade.maker,
        taker: trade.taker,
        pair: pairLabel(trade.pair),
        status: statusLabel(trade.status),
        createdAt: new Date(Number(trade.createdAt) * 1000).toISOString(),
        expiresAt: new Date(Number(trade.expiresAt) * 1000).toISOString(),
        reference: trade.rfqRef,
        bidCommitment: trade.bidCommitment,
      },
      lifecycle: auditEvents.map((event) => ({
        type: event.type,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber.toString(),
        timestamp: event.timestamp
          ? new Date(event.timestamp * 1000).toISOString()
          : null,
      })),
      disclosureCoverage: {
        maker: !!decrypted.maker,
        taker: !!decrypted.taker,
        complete: !!decrypted.maker && (!hasTakerDisclosure || !!decrypted.taker),
      },
      disclosures: {
        maker: decrypted.maker
          ? {
              keyHash: trade.makerViewKeyHash,
              authentication: "onchain-key-hash",
              details: decrypted.maker,
            }
          : null,
        taker: decrypted.taker
          ? {
              keyHash:
                trade.contractVersion === "legacy"
                  ? null
                  : trade.takerViewKeyHash,
              authentication:
                trade.contractVersion === "legacy"
                  ? "aes-gcm-decryption"
                  : "onchain-key-hash",
              details: decrypted.taker,
            }
          : null,
      },
    };

    downloadJson(
      `umbra-trade-${trade.id.toString()}-audit-record.json`,
      auditRecord
    );
  }

  const canReveal = makerKeyMatches || (hasTakerDisclosure && takerKeyEligible);
  const isComplete =
    !!decrypted?.maker && (!hasTakerDisclosure || !!decrypted?.taker);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-arc-border bg-arc-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">My trades</h2>
            <span className="font-mono text-xs text-arc-muted">
              {myTrades.length}
            </span>
          </div>

          {!isConnected ? (
            <p className="text-xs leading-relaxed text-arc-muted">
              Connect the participant wallet to load its saved audit key.
            </p>
          ) : myTrades.length === 0 ? (
            <p className="text-xs text-arc-muted">No participant trades found.</p>
          ) : (
            <div className="space-y-1">
              {myTrades.map(({ id, roles }) => (
                <button
                  key={id.toString()}
                  type="button"
                  onClick={() => selectTrade(id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                    tradeId === id
                      ? "border-umbra-purple bg-umbra-purple/10 text-white"
                      : "border-transparent text-arc-muted hover:border-arc-border hover:text-white"
                  )}
                >
                  <span className="font-mono text-xs">Trade #{id.toString()}</span>
                  <span className="text-[10px] uppercase">
                    {roles.join(" / ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-arc-border bg-arc-card p-4 text-xs leading-relaxed text-arc-muted">
          A complete matched-trade audit uses two keys: the maker key reveals
          the maker disclosure and the taker key reveals the taker disclosure.
          Each party controls its own key. External auditors can import shared
          audit-kit files without connecting a wallet.
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-arc-border bg-arc-card p-5">
          <h2 className="mb-1 text-sm font-medium text-white">Audit access</h2>
          <p className="mb-5 text-xs text-arc-muted">
            Participant keys are authenticated against their onchain
            fingerprints when available. Legacy taker keys are authenticated by
            successful disclosure decryption. Keys are used only in this browser.
          </p>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-xs uppercase text-arc-muted">
                Trade ID
              </label>
              <label className="cursor-pointer rounded-md border border-arc-border px-2.5 py-1 text-xs text-arc-muted transition-colors hover:text-white">
                Import audit kit
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={importAuditKit}
                  className="sr-only"
                />
              </label>
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={tradeIdStr}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  setTradeIdStr(value);
                  setMakerKeyStr("");
                  setTakerKeyStr("");
                  setDecrypted(null);
                  setDecryptErrors({});
                  setKitError("");
                }
              }}
              onBlur={() => {
                if (tradeId !== undefined) {
                  router.replace(`/audit?trade=${tradeId.toString()}`, {
                    scroll: false,
                  });
                }
              }}
              className="w-full rounded-lg border border-arc-border bg-arc-dark px-3 py-2.5 font-mono text-sm text-white focus:border-umbra-purple focus:outline-none"
            />
            {tradeId !== undefined &&
              nextTradeId !== undefined &&
              tradeIsKnownMissing && (
                <p className="mt-1.5 text-xs text-danger">
                  Trade #{tradeId.toString()} does not exist.
                </p>
              )}
            {kitError && (
              <p className="mt-1.5 text-xs text-danger">{kitError}</p>
            )}
          </div>

          {trade && (
            <div className="grid gap-4 md:grid-cols-2">
              <KeyInput
                role="maker"
                value={makerKeyStr}
                onChange={(value) => {
                  setMakerKeyStr(value);
                  setDecrypted(null);
                  setDecryptErrors({});
                }}
                authentication="onchain"
                authenticated={makerKeyMatches}
                disabled={false}
              />
              <KeyInput
                role="taker"
                value={takerKeyStr}
                onChange={(value) => {
                  setTakerKeyStr(value);
                  setDecrypted(null);
                  setDecryptErrors({});
                }}
                authentication={
                  takerUsesDecryptionAuthentication ? "decryption" : "onchain"
                }
                authenticated={
                  takerUsesDecryptionAuthentication
                    ? !!decrypted?.taker
                    : takerKeyMatches
                }
                disabled={!hasTakerDisclosure}
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleDecrypt}
            disabled={!trade || !canReveal || isDecrypting}
            className="mt-5 w-full rounded-lg bg-umbra-purple py-2.5 text-sm font-medium text-white transition-colors hover:bg-umbra-violet disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDecrypting ? "Decrypting..." : "Reveal authenticated disclosures"}
          </button>
        </div>

        {isTradeError && shouldLoadTrade && !trade && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-5">
            <div className="mb-2 text-sm font-medium text-danger">
              Trade #{tradeId?.toString()} could not be loaded
            </div>
            <p className="mb-4 text-xs leading-relaxed text-arc-muted">
              {tradeError instanceof Error
                ? tradeError.message
                : "The contract returned data in an unsupported format."}
            </p>
            <button
              type="button"
              onClick={() => refetchTrade()}
              className="rounded-md border border-arc-border px-3 py-1.5 text-xs text-white transition-colors hover:border-umbra-purple"
            >
              Retry
            </button>
          </div>
        )}

        {isTradeLoading && shouldLoadTrade && !isTradeError && (
          <div className="rounded-lg border border-arc-border bg-arc-card p-5 text-sm text-arc-muted">
            Loading onchain trade record...
          </div>
        )}

        {trade && (
          <div className="rounded-lg border border-arc-border bg-arc-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-white">
                Trade #{trade.id.toString()}
              </h3>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  statusColor(trade.status)
                )}
              >
                {statusLabel(trade.status)}
              </span>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Pair" value={pairLabel(trade.pair)} />
              <Field label="Reference" value={trade.rfqRef || "None"} />
              <Field
                label="Created"
                value={formatTimestamp(Number(trade.createdAt))}
              />
              <Field
                label="Expires"
                value={formatTimestamp(Number(trade.expiresAt))}
              />
              <Field label="Maker" value={trade.maker} mono />
              <Field
                label="Taker"
                value={trade.taker === ZERO_ADDRESS ? "Open" : trade.taker}
                mono={trade.taker !== ZERO_ADDRESS}
              />
            </div>

            <div className="mt-4 grid gap-2 rounded-lg border border-arc-border/50 bg-arc-dark p-3">
              <Fingerprint
                label="Maker key fingerprint"
                value={trade.makerViewKeyHash}
              />
              <Fingerprint
                label="Taker key fingerprint"
                value={
                  !hasTakerDisclosure
                    ? "Not submitted"
                    : trade.contractVersion === "legacy"
                    ? "Not recorded by legacy contract; authenticated on decryption"
                    : trade.takerViewKeyHash
                }
              />
            </div>

            <div className="mt-5 border-t border-arc-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs uppercase text-arc-muted">
                  Onchain lifecycle
                </h4>
                {eventsLoading && (
                  <span className="text-[10px] text-arc-muted">Loading...</span>
                )}
              </div>
              {eventsError ? (
                <p className="text-xs text-danger">{eventsError}</p>
              ) : auditEvents.length === 0 && !eventsLoading ? (
                <p className="text-xs text-arc-muted">
                  No lifecycle events were returned by ArcScan.
                </p>
              ) : (
                <div className="space-y-2">
                  {auditEvents.map((event) => (
                    <div
                      key={`${event.transactionHash}-${event.logIndex}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-arc-border/50 bg-arc-dark px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-medium text-white">
                          {event.type}
                        </div>
                        <div className="mt-0.5 text-[10px] text-arc-muted">
                          Block {event.blockNumber.toString()}
                          {event.timestamp
                            ? ` / ${formatTimestamp(event.timestamp)}`
                            : ""}
                        </div>
                      </div>
                      <a
                        href={`${arcTestnet.blockExplorers.default.url}/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-umbra-glow hover:text-white"
                      >
                        {shortenHash(event.transactionHash)}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {Object.keys(decryptErrors).length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {Object.values(decryptErrors).join(" ")}
          </div>
        )}

        {decrypted && Object.keys(decrypted).length > 0 && trade && (
          <div className="rounded-lg border border-settled/30 bg-settled/5 p-5 animate-fade-in">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-settled" />
                  <h3 className="text-sm font-medium text-settled">
                    {isComplete ? "Complete audit record" : "Partial audit record"}
                  </h3>
                </div>
                <p className="text-xs text-arc-muted">
                  {isComplete
                    ? "Both available participant disclosures are authenticated."
                    : "Add the other participant key to complete this matched-trade audit."}
                </p>
              </div>
              <button
                type="button"
                onClick={exportAuditRecord}
                className="rounded-md border border-settled/30 px-3 py-2 text-xs font-medium text-settled transition-colors hover:bg-settled/10"
              >
                Download JSON
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <DisclosurePanel
                role="maker"
                details={decrypted.maker}
                authenticated={makerKeyMatches}
                authenticationLabel="Onchain key verified"
              />
              {hasTakerDisclosure && (
                <DisclosurePanel
                  role="taker"
                  details={decrypted.taker}
                  authenticated={
                    takerUsesDecryptionAuthentication
                      ? !!decrypted.taker
                      : takerKeyMatches
                  }
                  authenticationLabel={
                    takerUsesDecryptionAuthentication
                      ? "Authenticated by decryption"
                      : "Onchain key verified"
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyInput({
  role,
  value,
  onChange,
  authentication,
  authenticated,
  disabled,
}: {
  role: Role;
  value: string;
  onChange: (value: string) => void;
  authentication: "onchain" | "decryption";
  authenticated: boolean;
  disabled: boolean;
}) {
  const normalized = normalizeViewKey(value);
  const label = role === "maker" ? "Maker view key" : "Taker view key";

  return (
    <div>
      <label className="mb-2 block text-xs uppercase text-arc-muted">
        {label}
      </label>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={disabled ? "Available after matching" : "0x..."}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-arc-border bg-arc-dark px-3 py-2.5 font-mono text-sm text-white focus:border-umbra-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      {value && !disabled && (
        <p
          className={cn(
            "mt-1.5 text-xs",
            authenticated
              ? "text-settled"
              : authentication === "decryption" && normalized
              ? "text-arc-muted"
              : "text-danger"
          )}
        >
          {authenticated
            ? authentication === "decryption"
              ? `${roleLabel(role)} disclosure authenticated`
              : `${roleLabel(role)} key verified`
            : normalized
            ? authentication === "decryption"
              ? "Legacy key will be authenticated when decryption succeeds"
              : `Key does not match the ${role} disclosure`
            : "Enter a 32-byte key beginning with 0x"}
        </p>
      )}
    </div>
  );
}

function DisclosurePanel({
  role,
  details,
  authenticated,
  authenticationLabel,
}: {
  role: Role;
  details?: TradeDetails;
  authenticated: boolean;
  authenticationLabel: string;
}) {
  const roleLabel = role === "maker" ? "Maker" : "Taker";

  return (
    <section className="rounded-lg border border-arc-border bg-arc-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xs uppercase text-umbra-glow">{roleLabel}</h4>
        <span
          className={cn(
            "text-[10px] uppercase",
            details && authenticated ? "text-settled" : "text-arc-muted"
          )}
        >
          {details && authenticated ? authenticationLabel : "Not disclosed"}
        </span>
      </div>

      {details ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Institution" value={details.institution} />
          <Field label="Currency" value={details.currency} />
          <Field
            label="Amount"
            value={formatAmount(BigInt(details.amount))}
            mono
          />
          <Field label="Reference" value={details.ref || "None"} />
          {details.bidAmount && (
            <Field
              label="Expected taker amount"
              value={formatAmount(BigInt(details.bidAmount))}
              mono
            />
          )}
          {details.takerCurrency && (
            <Field label="Receive currency" value={details.takerCurrency} />
          )}
          <Field
            label="Recorded"
            value={formatTimestamp(details.ts)}
          />
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-arc-muted">
          This participant&apos;s authenticated key is required to reveal the
          disclosure.
        </p>
      )}
    </section>
  );
}

function Fingerprint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase text-arc-muted">{label}</div>
      <div className="break-all font-mono text-[10px] text-white">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-arc-muted">{label}</div>
      <div
        className={cn(
          "break-all text-sm text-white",
          mono ? "font-mono" : ""
        )}
      >
        {value}
      </div>
    </div>
  );
}

function parseTradeId(value: string): bigint | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function shortenHash(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function roleLabel(role: Role): string {
  return role === "maker" ? "Maker" : "Taker";
}
