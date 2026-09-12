import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-store",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ADB Ticaret Beko Yetkili Satıcısı",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  brand: { "@type": "Brand", name: "Beko" },
  areaServed: { "@type": "Country", name: "Turkey" },
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ADB Ticaret Beko",
  url: siteUrl,
  inLanguage: "tr-TR",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/arama?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ADB Ticaret Beko | Yetkili Satıcı",
    template: "%s | ADB Ticaret Beko",
  },
  description:
    "Beko yetkili satıcısı ADB Ticaret — orijinal ürün, ücretsiz montaj, resmi garanti ve hızlı teslimat.",
  keywords: ["Beko", "ADB Ticaret", "yetkili satıcı", "beyaz eşya", "ankastre", "klima", "montaj"],
  applicationName: "ADB Ticaret Beko",
  authors: [{ name: "ADB Ticaret" }],
  creator: "ADB Ticaret",
  publisher: "ADB Ticaret",
  category: "shopping",
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
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
    languages: { "tr-TR": "/", tr: "/" },
  },
  other: {
    "geo.region": "TR",
    "geo.placename": "Türkiye",
  },
  appleWebApp: {
    capable: true,
    title: "ADB Beko",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${manrope.variable} ${outfit.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      <body className={manrope.className} style={{ background: "var(--adb-surface)" }}>
        {children}
      </body>
    </html>
  );
}
