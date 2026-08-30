import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { WormholeBackground } from "@/components/WormholeBackground";

export const metadata: Metadata = {
  title: "Umbra",
  description:
    "Private OTC trading for USDC and EURC on Arc Testnet. Trade in size without showing your position.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <WormholeBackground />
          <main className="relative z-10 min-h-screen pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
