import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet-context";

export const metadata: Metadata = {
  title: "Lucent — The amount is the only secret",
  description:
    "Confidential payments on Stellar. Sender and receiver are public; only the amount is encrypted, proven with zero-knowledge and verified natively on-chain.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-void font-sans text-text-primary antialiased">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
