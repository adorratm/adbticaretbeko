"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export type CampaignSlide = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
};

export function CampaignSlider({ slides }: { slides: CampaignSlide[] }) {
  const list = slides.length > 0 ? slides : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      if (!list.length) return;
      const n = ((next % list.length) + list.length) % list.length;
      setIndex(n);
    },
    [list.length],
  );

  useEffect(() => {
    if (paused || list.length < 2) return;
    const t = setInterval(() => go(index + 1), 5500);
    return () => clearInterval(t);
  }, [go, index, list.length, paused]);

  if (!list.length) return null;

  const slide = list[index]!;

  return (
    <section
      className="adb-campaign-slider"
      aria-roledescription="carousel"
      aria-label="Kampanyalar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        const d = end - start;
        if (Math.abs(d) < 40) return;
        go(d < 0 ? index + 1 : index - 1);
      }}
    >
      <div className="adb-container adb-campaign-slider-head">
        <div>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Kampanyalar
          </p>
          <h2 className="adb-headline-lg" style={{ margin: "4px 0 0", fontFamily: "var(--adb-font-display)" }}>
            Öne çıkan fırsatlar
          </h2>
        </div>
        <Link href="/kampanyalar" className="adb-campaign-slider-all">
          Tüm kampanyalar →
        </Link>
      </div>

      <div className="adb-container">
        <div className="adb-campaign-slider-stage">
          {list.map((s, i) => (
            <article
              key={s.id}
              className={`adb-campaign-slide${i === index ? " is-active" : ""}`}
              aria-hidden={i !== index}
            >
              <div className="adb-campaign-slide-media" style={{ backgroundImage: `url(${s.imageUrl})` }} aria-hidden />
              <div className="adb-campaign-slide-copy">
                {s.subtitle ? <p className="adb-campaign-slide-kicker">{s.subtitle}</p> : null}
                <h3>{s.title}</h3>
                {s.body ? <p>{s.body}</p> : null}
                <Link href={s.ctaHref || "/kampanyalar"} className="adb-btn adb-btn-primary">
                  {s.ctaLabel || "İncele"}
                </Link>
              </div>
            </article>
          ))}

          {list.length > 1 ? (
            <>
              <button
                type="button"
                className="adb-campaign-slider-nav prev"
                aria-label="Önceki kampanya"
                onClick={() => go(index - 1)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                type="button"
                className="adb-campaign-slider-nav next"
                aria-label="Sonraki kampanya"
                onClick={() => go(index + 1)}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </>
          ) : null}
        </div>

        {list.length > 1 ? (
          <div className="adb-campaign-slider-dots" role="tablist" aria-label="Kampanya slaytları">
            {list.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}. kampanya: ${s.title}`}
                className={i === index ? "is-active" : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        ) : null}

        <p className="adb-sr-only" aria-live="polite">
          {slide.title}
        </p>
      </div>
    </section>
  );
}
