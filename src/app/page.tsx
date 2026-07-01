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
          OTC trading where your
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-umbra-glow to-umbra-indigo">
            book stays private.
          </span>
        </h1>

        <p className="text-lg text-arc-muted max-w-xl mx-auto mb-10 leading-relaxed">
          Umbra lets institutions trade USDC and EURC in size without
          exposing amounts publicly. Agree on terms privately, settle
          on Arc, give your auditor a key.
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
            Public chains have a position problem
          </h2>
          <p className="text-arc-muted max-w-2xl mx-auto">
            The moment you put a large USDC order on the blockchain, every trader in the market
            sees it. That information moves prices before your trade settles. Umbra keeps
            the size hidden until both sides are already locked in.
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
                "You set the direction and the amount you want to trade. The size stays private. Your counterparty learns the details from you directly.",
              icon: "◈",
              color: "umbra-purple",
            },
            {
              step: "02",
              title: "Agree terms",
              description:
                "The other party accepts your quote and locks in at the rate you both agreed. Neither amount is visible to anyone else on the network.",
              icon: "⟷",
              color: "matched",
            },
            {
              step: "03",
              title: "Settle",
              description:
                "Either party triggers settlement. Both sides are verified and the swap executes. No custody risk, no partial fills.",
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
              title: "Hidden trade sizes",
              description:
                "Amounts are sealed before any public record exists. They only become visible once both parties are locked in. You cannot front-run a number you cannot see.",
            },
            {
              title: "Auditor access",
              description:
                "Trade details are encrypted and stored on the blockchain. Share a view key with your compliance team or regulator and they can read everything: amounts, firm names, timestamps.",
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
                "Post a quote for anyone to take, or send it directly to a specific wallet address. The size stays private until settlement either way.",
            },
            {
              title: "Permanent record",
              description:
                "Every trade is recorded on Arc permanently: the sealed amounts, the settlement, the timestamps. Share the view key with an auditor whenever you need and they can read everything.",
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
