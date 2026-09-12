"use client";

import { Badge, ProductGallery } from "@adb/ui";

const FALLBACK = [
  {
    src: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80",
    label: "Ön Yüz",
  },
  {
    src: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=1200&q=80",
    label: "İç Hacim",
  },
  {
    src: "https://images.unsplash.com/photo-1556911220-bff31c812dce?auto=format&fit=crop&w=1200&q=80",
    label: "Mutfak",
  },
  {
    src: "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?auto=format&fit=crop&w=1200&q=80",
    label: "Detay",
  },
];

export function PdpGallery({
  dealerCode,
  images,
}: {
  dealerCode: string;
  images?: Array<{ url: string; alt?: string }>;
}) {
  const gallery =
    images && images.length > 0
      ? images.map((img, i) => ({ src: img.url, label: img.alt || `Görsel ${i + 1}` }))
      : FALLBACK;

  return (
    <ProductGallery
      images={gallery}
      badges={
        <>
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <span className="adb-badge adb-badge-dealer">Bayi #{dealerCode}</span>
          </div>
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <Badge tone="energy-b">ENERJİ: B</Badge>
          </div>
        </>
      }
    />
  );
}
