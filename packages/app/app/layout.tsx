import type { Metadata } from "next";
import "./globals.css";
import { ProductNav } from "./nav";
import { WalletProvider } from "@/lib/wallet-context";

export const metadata: Metadata = {
  title: "Lucent — confidential payments on Stellar",
  description:
    "Confidential payments on Stellar: shielded balances, private transfers, confidential payroll and escrow, with cryptographic auditability and selective disclosure. Testnet.",
};

// Lucent is dark-only. Force the dark palette before first paint.
const themeInit = `document.documentElement.classList.add('dark');`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <WalletProvider>
          <ProductNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
