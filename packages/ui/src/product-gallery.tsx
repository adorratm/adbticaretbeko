"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

export type GalleryImage = {
  src: string;
  label: string;
};

export function ProductGallery({
  images,
  badges,
  className,
}: {
  images: GalleryImage[];
  badges?: ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [mounted, setMounted] = useState(false);
  const current = images[active] || images[0];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setActive((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setActive((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, images.length]);

  if (!current) return null;

  const overlay =
    lightbox && mounted
      ? createPortal(
          <div className="adb-lightbox" role="dialog" aria-modal="true" aria-label="Ürün görseli">
            <button type="button" className="adb-lightbox-backdrop" aria-label="Kapat" onClick={() => setLightbox(false)} />
            <div className="adb-lightbox-panel adb-animate-fade">
              <button type="button" className="adb-lightbox-close" onClick={() => setLightbox(false)} aria-label="Kapat">
                ×
              </button>
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="adb-lightbox-nav adb-lightbox-prev"
                    disabled={active <= 0}
                    onClick={() => setActive((i) => Math.max(i - 1, 0))}
                    aria-label="Önceki"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="adb-lightbox-nav adb-lightbox-next"
                    disabled={active >= images.length - 1}
                    onClick={() => setActive((i) => Math.min(i + 1, images.length - 1))}
                    aria-label="Sonraki"
                  >
                    ›
                  </button>
                </>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.src} alt={current.label} className="adb-lightbox-img" />
              <div className="adb-lightbox-caption">
                {current.label} · {active + 1}/{images.length}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn(className)}>
      <button type="button" className="adb-gallery-main adb-gallery-zoomable" onClick={() => setLightbox(true)} aria-label="Görseli büyüt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.label} />
        <span className="adb-gallery-zoom-hint">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            zoom_in
          </span>
          Büyüt
        </span>
        {badges}
      </button>
      <div className="adb-gallery-thumbs">
        {images.map((img, i) => (
          <button
            key={`${img.src}-${img.label}-${i}`}
            type="button"
            className="adb-gallery-thumb"
            data-active={i === active}
            onClick={() => setActive(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.label} />
            <span>{img.label}</span>
          </button>
        ))}
      </div>
      {overlay}
    </div>
  );
}
