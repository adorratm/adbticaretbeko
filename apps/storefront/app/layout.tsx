import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ADB Ticaret Beko | Yetkili Satıcı",
    template: "%s | ADB Ticaret Beko",
  },
  description:
    "Beko yetkili satıcısı ADB Ticaret — orijinal ürün, ücretsiz montaj, resmi garanti ve hızlı teslimat.",
  keywords: ["Beko", "ADB Ticaret", "yetkili satıcı", "beyaz eşya", "ankastre", "klima", "montaj"],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "ADB Ticaret Beko",
    title: "ADB Ticaret Beko | Yetkili Satıcı",
    description: "Orijinal Beko ürünleri, ücretsiz montaj ve resmi garanti.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "ADB Ticaret Beko | Yetkili Satıcı",
    description: "Orijinal Beko ürünleri, ücretsiz montaj ve resmi garanti.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className} style={{ background: "var(--adb-surface)" }}>
        {children}
      </body>
    </html>
  );
}
