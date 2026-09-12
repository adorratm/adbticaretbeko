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
  promoLabel = "Stokta",
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
      className={["adb-product-card adb-animate-in", className].filter(Boolean).join(" ")}
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--adb-border-subtle)",
        borderRadius: "var(--adb-radius-lg)",
        transition: "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease",
      }}
    >
      <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "1",
            background: "linear-gradient(180deg, #f7fafc 0%, #eef3f7 100%)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {promoLabel ? (
            <span
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 1,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.02em",
                background: "var(--adb-primary)",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: 2,
              }}
            >
              {promoLabel}
            </span>
          ) : null}
          {energyClass ? (
            <span className={energyTone} style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}>
              {energyClass}
            </span>
          ) : null}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              className="adb-product-card-img"
              style={{ maxWidth: "78%", maxHeight: "78%", objectFit: "contain", transition: "transform 0.35s ease" }}
            />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-outline)" }}>
              kitchen
            </span>
          )}
        </div>
        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--adb-outline)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
            {sku}
          </div>
          <h3
            style={{
              margin: "6px 0 10px",
              fontSize: 15,
              fontWeight: 650,
              lineHeight: 1.35,
              minHeight: "2.7em",
              color: "var(--adb-on-surface)",
              fontFamily: "var(--adb-font-display)",
            }}
          >
            {title}
          </h3>
          {features?.length ? (
            <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", color: "var(--adb-muted)", fontSize: 12 }}>
              {features.slice(0, 2).map((f) => (
                <li key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ color: "var(--adb-primary)", fontWeight: 700 }}>·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ marginTop: "auto" }}>
            {listPriceLabel ? (
              <div style={{ fontSize: 12, color: "var(--adb-outline)", textDecoration: "line-through" }}>{listPriceLabel}</div>
            ) : null}
            {priceLabel ? (
              <>
                <div className="adb-price" style={{ color: "var(--adb-primary-deep)", fontFamily: "var(--adb-font-display)" }}>
                  {priceLabel}
                </div>
                <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>KDV dahil</div>
              </>
            ) : null}
          </div>
        </div>
      </a>
      {action ? <div style={{ padding: "0 16px 16px" }}>{action}</div> : null}
    </article>
  );
}
