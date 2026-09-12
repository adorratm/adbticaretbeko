import type { ReactNode } from "react";

export function ProductCard({
  href,
  imageUrl,
  sku,
  title,
  priceLabel,
  listPriceLabel,
  energyClass,
  features,
  promoLabel = "Stokta Var",
  action,
  className,
}: {
  href: string;
  imageUrl?: string;
  sku: string;
  title: string;
  priceLabel?: string;
  listPriceLabel?: string;
  energyClass?: string;
  features?: string[];
  promoLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  const energyTone =
    energyClass === "A"
      ? "adb-badge adb-badge-energy-a"
      : energyClass === "B"
        ? "adb-badge adb-badge-energy-b"
        : energyClass === "C"
          ? "adb-badge adb-badge-energy-c"
          : energyClass
            ? "adb-badge adb-badge-energy-d"
            : "";

  return (
    <article
      className={["adb-card adb-animate-in", className].filter(Boolean).join(" ")}
      style={{ overflow: "hidden", display: "flex", flexDirection: "column", padding: 14 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "rgba(16,185,129,0.15)",
            color: "#065f46",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {promoLabel}
        </span>
        {energyClass ? (
          <span className={energyTone}>ENERJİ: {energyClass}</span>
        ) : null}
      </div>
      <a href={href} style={{ textDecoration: "none", color: "inherit", display: "block", flex: 1 }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "1",
            background: "var(--adb-surface-low)",
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain", transition: "transform 0.25s ease" }}
            />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-outline)" }}>
              kitchen
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--adb-outline)", fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" }}>
          {sku}
        </div>
        <h3
          style={{
            margin: "4px 0 8px",
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.35,
            minHeight: "2.7em",
            color: "var(--adb-on-surface)",
          }}
        >
          {title}
        </h3>
        {features?.length ? (
          <ul style={{ margin: "0 0 10px", padding: 0, listStyle: "none", color: "var(--adb-muted)", fontSize: 12 }}>
            {features.slice(0, 3).map((f) => (
              <li key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--adb-primary-container)" }}>
                  check_circle
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          {listPriceLabel ? (
            <div style={{ fontSize: 12, color: "var(--adb-outline)", textDecoration: "line-through" }}>{listPriceLabel}</div>
          ) : null}
          {priceLabel ? (
            <>
              <div className="adb-price">{priceLabel}</div>
              <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>(KDV Dahil)</div>
            </>
          ) : null}
        </div>
      </a>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </article>
  );
}
