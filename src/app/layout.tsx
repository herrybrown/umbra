import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

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
          <main className="pt-16 min-h-screen bg-arc-dark">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
