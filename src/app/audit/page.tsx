import { AuditDecoder } from "@/components/AuditDecoder";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialTradeId =
    typeof params.trade === "string" ? params.trade : "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-7">
        <div className="mb-3 flex items-center gap-2 text-xs font-mono text-settled">
          <span className="h-1.5 w-1.5 rounded-full bg-settled" />
          Arc Testnet / local decryption
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Trade audit
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-arc-muted">
          Review the public settlement record and reveal either participant&apos;s
          private disclosure with that participant&apos;s view key. A complete
          matched-trade record requires both keys; neither key leaves this browser.
        </p>
      </div>

      <AuditDecoder initialTradeId={initialTradeId} />
    </div>
  );
}
