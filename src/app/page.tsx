import Link from "next/link";
import { UmbraLogo } from "@/components/UmbraLogo";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Hero */}
      <div className="pt-24 pb-20 text-center">
        <div className="flex justify-center mb-6">
          <UmbraLogo size={56} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-umbra-purple/30 bg-umbra-purple/10 text-umbra-glow text-xs font-mono mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-umbra-glow animate-pulse" />
          On Arc Testnet
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-tight">
          OTC settlement with
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-umbra-glow to-umbra-indigo">
            selective disclosure.
          </span>
        </h1>

        <p className="text-lg text-arc-muted max-w-xl mx-auto mb-10 leading-relaxed">
          Umbra lets institutions trade USDC and EURC in size without
          displaying amounts in the open market interface. Agree on terms, settle
          on Arc, give your auditor the participant keys they are authorized to use.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/desk"
            className="px-6 py-3 rounded-xl bg-umbra-purple hover:bg-umbra-violet transition-colors text-white font-medium text-sm"
          >
            Open Trading Desk
          </Link>
          <Link
            href="/audit"
            className="px-6 py-3 rounded-xl border border-arc-border hover:border-arc-border/80 text-arc-muted hover:text-white transition-colors text-sm"
          >
            Auditor Access
          </Link>
        </div>
      </div>

      {/* Problem */}
      <div className="mb-20">
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-3">
            Application privacy is not chain privacy
          </h2>
          <p className="text-arc-muted max-w-2xl mx-auto">
            Umbra omits amounts from quote cards and encrypts participant audit
            disclosures. Arc remains a public EVM network, so transaction calldata
            can still be inspected onchain.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-20">
        <h2 className="text-2xl font-semibold text-white text-center mb-12">
          How a trade works
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Post a quote",
              description:
                "You set the direction and amount. The size stays off the market card while your participant disclosure is encrypted for later audit.",
              icon: "◈",
              color: "umbra-purple",
            },
            {
              step: "02",
              title: "Agree terms",
              description:
                "The other party accepts your quote and locks in at the rate you both agreed. Each side receives a separate audit key.",
              icon: "⟷",
              color: "matched",
            },
            {
              step: "03",
              title: "Settle",
              description:
                "The maker triggers settlement. Both escrowed sides swap atomically with no partial fill.",
              icon: "✓",
              color: "settled",
            },
          ].map(({ step, title, description, icon, color }) => (
            <div
              key={step}
              className="rounded-xl border border-arc-border bg-arc-card p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0
                    ${color === "umbra-purple" ? "border-umbra-purple/30 bg-umbra-purple/10 text-umbra-glow" : ""}
                    ${color === "matched" ? "border-matched/30 bg-matched/10 text-matched" : ""}
                    ${color === "settled" ? "border-settled/30 bg-settled/10 text-settled" : ""}
                  `}
                >
                  <span className="text-lg">{icon}</span>
                </div>
                <div>
                  <div className="text-xs font-mono text-arc-muted mb-0.5">{step}</div>
                  <div className="font-medium text-white">{title}</div>
                </div>
              </div>
              <p className="text-sm text-arc-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mb-20">
        <h2 className="text-2xl font-semibold text-white text-center mb-12">
          Built for serious traders
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: "Controlled disclosure",
              description:
                "Trade cards omit amounts while encrypted maker and taker records support participant-controlled audit access.",
            },
            {
              title: "Auditor access",
              description:
                "Maker and taker disclosures are encrypted separately and stored on the blockchain. Each participant can share their own view key with a compliance team or regulator.",
            },
            {
              title: "Native FX on Arc",
              description:
                "USDC and EURC settle directly on Arc Testnet. Finality in under a second. Gas is paid in USDC so there are no ETH swings eating into your spread.",
            },
            {
              title: "One-transaction settlement",
              description:
                "Both sides settle together. If anything does not add up, the whole thing reverts. You get exactly what you agreed to, or nothing moves.",
            },
            {
              title: "Open market or private",
              description:
                "Post a quote for anyone to take, or restrict it to a specific wallet address. The amount stays off the quote card either way.",
            },
            {
              title: "Permanent record",
              description:
                "Every trade is recorded on Arc permanently. One participant key reveals one side; both keys assemble the complete matched-trade audit record.",
            },
          ].map(({ title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-arc-border bg-arc-card p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-umbra-glow mt-2 shrink-0" />
                <div>
                  <div className="font-medium text-white mb-1">{title}</div>
                  <p className="text-sm text-arc-muted leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mb-20 rounded-2xl border border-umbra-purple/20 bg-umbra-purple/5 p-10 text-center">
        <h2 className="text-2xl font-semibold text-white mb-3">
          Ready to trade?
        </h2>
        <p className="text-arc-muted mb-6">
          Connect your wallet on Arc Testnet, grab some USDC from the faucet, and post your first quote.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/desk"
            className="inline-flex px-8 py-3 rounded-xl bg-umbra-purple hover:bg-umbra-violet transition-colors text-white font-medium"
          >
            Open Trading Desk
          </Link>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-6 py-3 rounded-xl border border-arc-border hover:border-arc-border/80 text-arc-muted hover:text-white transition-colors text-sm"
          >
            Get test tokens
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-arc-border py-8 flex items-center justify-between text-xs text-arc-muted">
        <div>Umbra · OTC on Arc Testnet</div>
        <div>
          <a
            href="https://testnet.arcscan.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Explorer
          </a>
          <span className="mx-2">·</span>
          <a
            href="https://github.com/herrybrown/umbra"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
