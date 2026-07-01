import { AuditDecoder } from "@/components/AuditDecoder";

export default function AuditPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-settled/30 bg-settled/10 text-settled text-xs font-mono mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-settled" />
          Auditor access
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Audit Panel</h1>
        <p className="text-sm text-arc-muted leading-relaxed">
          Trade amounts and firm details are encrypted. To read them you need a view key,
          a short code the trading parties share with their auditor.
          Everything decrypts locally in your browser. Nothing is sent to a server.
        </p>
      </div>

      <div className="rounded-xl border border-arc-border bg-arc-card p-5 mb-6">
        <h2 className="text-sm font-medium text-white mb-3">How it works</h2>
        <ol className="space-y-2.5 text-sm text-arc-muted">
          <li className="flex gap-2.5">
            <span className="text-umbra-glow font-mono shrink-0">1.</span>
            <span>
              When a quote is created, a unique view key is generated. A reference to it
              is recorded on the blockchain. The key itself stays with the trading parties.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-umbra-glow font-mono shrink-0">2.</span>
            <span>
              The trade details — firm name, amount, reference — are encrypted with that
              key and stored on the blockchain in an unreadable form.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-umbra-glow font-mono shrink-0">3.</span>
            <span>
              The trading parties share the view key with you directly. Paste it here
              and the panel checks it matches this trade, then reveals the details.
            </span>
          </li>
        </ol>
      </div>

      <AuditDecoder />
    </div>
  );
}
