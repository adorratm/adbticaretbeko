import type { MetadataRoute } from "next";
import { createApiClient } from "@adb/api-client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const categories = [
  "buzdolaplari",
  "camasir-makineleri",
  "bulasik-makineleri",
  "klimalar",
  "ankastre-setler",
  "kucuk-ev-robot",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/kampanyalar",
    "/kategori",
    "/takas",
    "/ceyiz",
    "/arama",
    "/kargo-takip",
    ...categories.map((c) => `/kategori/${c}`),
  ].map((path) => ({
    url: `${siteUrl}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const api = createApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    });
    const res = await api.products.list();
    productRoutes = (res.items || []).map((p) => ({
      url: `${siteUrl}/urun/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    productRoutes = [];
  }

  return [...staticRoutes, ...productRoutes];
}
