import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADB Ticaret Beko | Yetkili Satıcı",
    short_name: "ADB Beko",
    description: "Beko yetkili satıcısı — orijinal ürün, ücretsiz montaj, resmi garanti.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#0056b3",
    lang: "tr",
    dir: "ltr",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
