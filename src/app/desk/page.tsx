"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { RFQCard } from "@/components/RFQCard";
import { CreateRFQModal } from "@/components/CreateRFQModal";
import { MatchRFQModal } from "@/components/MatchRFQModal";
import { SettleModal } from "@/components/SettleModal";
import {
  useOpenIds,
  useTrade,
  useMakerTrades,
  useTakerTrades,
  useUsdcBalance,
  useEurcBalance,
  useCancel,
} from "@/hooks/useUmbraOTC";
import { formatAmount } from "@/lib/utils";

type Tab = "market" | "mine";

export default function DeskPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("market");
  const [showCreate, setShowCreate] = useState(false);
  const [matchTradeId, setMatchTradeId] = useState<bigint | null>(null);
  const [settleTradeId, setSettleTradeId] = useState<bigint | null>(null);

  const { data: openIds = [], refetch: refetchOpen } = useOpenIds();
  const { data: makerIds = [] } = useMakerTrades(address);
  const { data: takerIds = [] } = useTakerTrades(address);
  const { data: usdcBalance } = useUsdcBalance(address);
  const { data: eurcBalance } = useEurcBalance(address);
  const { cancel } = useCancel();

  const myIds = Array.from(
    new Set([...(makerIds as bigint[]), ...(takerIds as bigint[])])
  ).sort((a, b) => (b > a ? 1 : -1));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Trading Desk</h1>
          <p className="text-sm text-arc-muted">
            Private FX · Amounts hidden until settlement
          </p>
        </div>

        {isConnected && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl bg-umbra-purple hover:bg-umbra-violet transition-colors text-white text-sm font-medium"
          >
            + New Quote
          </button>
        )}
      </div>

      {/* Balances */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <BalanceCard
            label="USDC Balance"
            value={usdcBalance !== undefined ? `${formatAmount(usdcBalance)}` : "—"}
            color="usdc"
          />
          <BalanceCard
            label="EURC Balance"
            value={eurcBalance !== undefined ? `${formatAmount(eurcBalance)}` : "—"}
            color="eurc"
          />
          <BalanceCard
            label="Open Trades"
            value={openIds.length.toString()}
            color="umbra"
          />
          <BalanceCard
            label="My Trades"
            value={myIds.length.toString()}
            color="muted"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-arc-border pb-0">
        {[
          { key: "market" as Tab, label: "Open Market" },
          { key: "mine" as Tab, label: "My Trades", badge: myIds.length },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-umbra-purple text-white"
                : "border-transparent text-arc-muted hover:text-white"
            }`}
          >
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-2 text-xs bg-arc-border text-arc-muted rounded-full px-1.5 py-0.5">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {!isConnected ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-full border border-arc-border flex items-center justify-center mx-auto mb-4">
            <span className="text-arc-muted text-xl">◈</span>
          </div>
          <div className="text-arc-muted text-sm">
            Connect your wallet to view the trading desk
          </div>
        </div>
      ) : tab === "market" ? (
        <MarketTab
          openIds={openIds as bigint[]}
          onMatch={setMatchTradeId}
          onCancel={async (id) => {
            await cancel(id);
            refetchOpen();
          }}
          onSettle={setSettleTradeId}
        />
      ) : (
        <MyTradesTab
          ids={myIds}
          onSettle={setSettleTradeId}
          onCancel={async (id) => {
            await cancel(id);
          }}
        />
      )}

      {/* Modals */}
      {showCreate && (
        <CreateRFQModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            refetchOpen();
          }}
        />
      )}

      {matchTradeId !== null && (
        <MatchRFQTradeLoader
          id={matchTradeId}
          onClose={() => setMatchTradeId(null)}
          onSuccess={() => {
            setMatchTradeId(null);
            refetchOpen();
          }}
        />
      )}

      {settleTradeId !== null && (
        <SettleTradeLoader
          id={settleTradeId}
          onClose={() => setSettleTradeId(null)}
          onSuccess={() => setSettleTradeId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BalanceCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const dotColor = {
    usdc: "bg-usdc",
    eurc: "bg-eurc",
    umbra: "bg-umbra-glow",
    muted: "bg-arc-muted",
  }[color] ?? "bg-arc-muted";

  return (
    <div className="rounded-xl border border-arc-border bg-arc-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="text-xs text-arc-muted">{label}</span>
      </div>
      <div className="font-mono text-lg text-white">{value}</div>
    </div>
  );
}

function MarketTab({
  openIds,
  onMatch,
  onCancel,
  onSettle,
}: {
  openIds: bigint[];
  onMatch: (id: bigint) => void;
  onCancel: (id: bigint) => void;
  onSettle: (id: bigint) => void;
}) {
  if (openIds.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4 text-arc-muted/30">◈</div>
        <div className="text-arc-muted text-sm mb-2">No open quotes</div>
        <div className="text-xs text-arc-muted/60">
          Post the first quote to get started
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {openIds.map((id) => (
        <TradeCardLoader
          key={id.toString()}
          id={id}
          onMatch={() => onMatch(id)}
          onCancel={() => onCancel(id)}
          onSettle={() => onSettle(id)}
        />
      ))}
    </div>
  );
}

function MyTradesTab({
  ids,
  onSettle,
  onCancel,
}: {
  ids: bigint[];
  onSettle: (id: bigint) => void;
  onCancel: (id: bigint) => void;
}) {
  if (ids.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-arc-muted text-sm">No trades yet</div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {ids.map((id) => (
        <TradeCardLoader
          key={id.toString()}
          id={id}
          onSettle={() => onSettle(id)}
          onCancel={() => onCancel(id)}
        />
      ))}
    </div>
  );
}

function TradeCardLoader({
  id,
  onMatch,
  onSettle,
  onCancel,
}: {
  id: bigint;
  onMatch?: () => void;
  onSettle?: () => void;
  onCancel?: () => void;
}) {
  const { data: trade, isLoading } = useTrade(id);

  if (isLoading || !trade) {
    return (
      <div className="rounded-xl border border-arc-border bg-arc-card p-5 animate-pulse">
        <div className="h-4 bg-arc-border rounded w-1/3 mb-3" />
        <div className="h-3 bg-arc-border rounded w-2/3 mb-2" />
        <div className="h-3 bg-arc-border rounded w-1/2" />
      </div>
    );
  }

  return (
    <RFQCard
      trade={trade}
      onMatch={onMatch}
      onSettle={onSettle}
      onCancel={onCancel}
    />
  );
}

function MatchRFQTradeLoader({
  id,
  onClose,
  onSuccess,
}: {
  id: bigint;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: trade } = useTrade(id);
  if (!trade) return null;
  return (
    <MatchRFQModal trade={trade} onClose={onClose} onSuccess={onSuccess} />
  );
}

function SettleTradeLoader({
  id,
  onClose,
  onSuccess,
}: {
  id: bigint;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: trade } = useTrade(id);
  if (!trade) return null;
  return <SettleModal trade={trade} onClose={onClose} onSuccess={onSuccess} />;
}
