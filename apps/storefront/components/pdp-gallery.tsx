"use client";

import { ProductGallery } from "@adb/ui";

const FALLBACK = [
  {
    src: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80",
    label: "Ön yüz",
  },
  {
    src: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=1200&q=80",
    label: "İç hacim",
  },
  {
    src: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
    label: "Yaşam alanı",
  },
  {
    src: "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1200&q=80",
    label: "Detay",
  },
];

export function PdpGallery({
  dealerCode,
  images,
  energyClass,
}: {
  dealerCode: string;
  images?: Array<{ url: string; alt?: string }>;
  energyClass?: string;
}) {
  const gallery =
    images && images.length > 0
      ? images.map((img, i) => ({ src: img.url, label: img.alt || `Görsel ${i + 1}` }))
      : FALLBACK;

  return (
    <div className="adb-pdp-gallery">
      <ProductGallery
        images={gallery}
        badges={
          <>
            {energyClass ? (
              <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2 }}>
                <span
                  style={{
                    display: "inline-block",
                    background: "var(--adb-primary)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "6px 10px",
                    borderRadius: 2,
                  }}
                >
                  Enerji {energyClass}
                </span>
              </div>
            ) : null}
            <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 2 }}>
              <span
                style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.94)",
                  color: "var(--adb-primary-deep)",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "6px 10px",
                  borderRadius: 2,
                }}
              >
                Bayi #{dealerCode}
              </span>
            </div>
          </>
        }
      />
    </div>
  );
}
