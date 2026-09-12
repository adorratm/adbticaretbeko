import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "ADB Ticaret Beko";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #003d82 0%, #0056b3 55%, #0083be 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>Beko Yetkili Satıcı</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>ADB Ticaret</div>
          <div style={{ fontSize: 32, fontWeight: 500, opacity: 0.92, maxWidth: 900 }}>
            Orijinal ürün · Ücretsiz montaj · Resmi garanti
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.85 }}>adbticaret · Türkiye</div>
      </div>
    ),
    { ...size },
  );
}
