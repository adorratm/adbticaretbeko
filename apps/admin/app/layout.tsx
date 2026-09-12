import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AdminProviders } from "../components/admin-providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: "ADB Admin | Beko Bayi Portalı",
  description: "ADB Ticaret yönetim paneli",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className} style={{ background: "var(--adb-surface)" }}>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
