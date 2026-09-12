import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth/", "/hesabim/", "/odeme", "/sepet", "/api/"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/urun/", "/kategori/", "/kampanyalar", "/llms.txt"],
        disallow: ["/auth/", "/hesabim/", "/odeme", "/sepet"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/urun/", "/kategori/", "/llms.txt"],
        disallow: ["/auth/", "/hesabim/", "/odeme", "/sepet"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
