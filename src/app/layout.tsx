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

const themeScript = `
  (function () {
    try {
      var theme = localStorage.getItem("umbra-theme");
      if (theme !== "light" && theme !== "dark") theme = "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
