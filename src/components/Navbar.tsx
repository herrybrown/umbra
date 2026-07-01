"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "./ConnectWallet";
import { UmbraLogo } from "./UmbraLogo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/desk", label: "Trading Desk" },
  { href: "/audit", label: "Audit" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-arc-border bg-arc-dark/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <UmbraLogo size={28} />
            <span className="font-semibold text-white tracking-tight">Umbra</span>
            <span className="text-[10px] text-arc-muted font-mono border border-arc-border rounded px-1">
              testnet
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname.startsWith(href)
                    ? "text-white bg-arc-border"
                    : "text-arc-muted hover:text-white hover:bg-arc-border/50"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md text-sm text-arc-muted hover:text-white hover:bg-arc-border/50 transition-colors"
          >
            Faucet
          </a>
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
