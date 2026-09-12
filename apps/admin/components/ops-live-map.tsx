"use client";

import { useEffect, useRef, useState } from "react";

export type OpsMapPoint = {
  id: string;
  lat: number;
  lng: number;
  live?: boolean;
  selected?: boolean;
  label: string;
  popupHtml: string;
};

export type OpsLatLng = { lat: number; lng: number; label?: string };

type Props = {
  points: OpsMapPoint[];
  selectedId?: string | null;
  planned?: OpsLatLng[];
  trail?: OpsLatLng[];
  onReady?: () => void;
  onError?: (message: string) => void;
};

type LatLngLiteral = { lat: number; lng: number };

type GMaps = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  InfoWindow: new (opts: { content: string }) => GInfoWindow;
  LatLngBounds: new () => GLatLngBounds;
  SymbolPath: { CIRCLE: number };
};

type GMap = {
  setCenter: (p: LatLngLiteral) => void;
  setZoom: (z: number) => void;
  fitBounds: (b: GLatLngBounds, padding?: number) => void;
};

type GMarker = {
  setMap: (m: GMap | null) => void;
  addListener: (ev: string, fn: () => void) => void;
};

type GPolyline = { setMap: (m: GMap | null) => void };
type GInfoWindow = { open: (opts: { map: GMap; anchor: GMarker }) => void };
type GLatLngBounds = { extend: (p: LatLngLiteral) => void };

const ISTANBUL = { lat: 41.015, lng: 28.98 };

type GoogleWindow = {
  google?: { maps?: GMaps };
  __adbGoogleMapsPromise?: Promise<GMaps>;
};

function mapsApiKey() {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || "").trim();
}

function loadGoogleMaps(key: string): Promise<GMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as unknown as GoogleWindow;
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (w.__adbGoogleMapsPromise) return w.__adbGoogleMapsPromise;

  w.__adbGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-adb-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => {
        if (w.google?.maps) resolve(w.google.maps);
        else reject(new Error("Google Maps yüklenemedi"));
      });
      existing.addEventListener("error", () => reject(new Error("Google Maps script hatası")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=tr`;
    script.async = true;
    script.defer = true;
    script.dataset.adbGoogleMaps = "1";
    script.onload = () => {
      if (w.google?.maps) resolve(w.google.maps);
      else reject(new Error("Google Maps yüklenemedi"));
    };
    script.onerror = () => reject(new Error("Google Maps script hatası"));
    document.head.appendChild(script);
  });

  return w.__adbGoogleMapsPromise;
}

function markerColor(p: OpsMapPoint) {
  if (p.selected) return "#e85d04";
  if (p.live) return "#0d9f6e";
  return "#0083be";
}

/** Google Maps: planlı rota (kesik) + geçilen yol (düz). */
export function OpsLiveMap({ points, selectedId, planned = [], trail = [], onReady, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markersRef = useRef<GMarker[]>([]);
  const plannedRef = useRef<GPolyline | null>(null);
  const trailRef = useRef<GPolyline | null>(null);
  const mapsRef = useRef<GMaps | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [missingKey, setMissingKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = mapsApiKey();
    if (!key) {
      setMissingKey(true);
      onError?.("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanımlı değil");
      return;
    }
    setMissingKey(false);

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const maps = await loadGoogleMaps(key);
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: ISTANBUL,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;
        setEngineReady(true);
        onReady?.();
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Google Harita açılamadı");
      }
    }

    void init();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      plannedRef.current?.setMap(null);
      trailRef.current?.setMap(null);
      plannedRef.current = null;
      trailRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    for (const p of points) {
      const pos = { lat: p.lat, lng: p.lng };
      const marker = new maps.Marker({
        map,
        position: pos,
        title: p.label,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: p.selected ? 10 : 8,
          fillColor: markerColor(p),
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      const info = new maps.InfoWindow({ content: p.popupHtml });
      marker.addListener("click", () => info.open({ map, anchor: marker }));
      markersRef.current.push(marker);
      bounds.extend(pos);
      hasBounds = true;
    }

    plannedRef.current?.setMap(null);
    plannedRef.current = null;
    if (planned.length >= 2) {
      const path = planned.map((p) => ({ lat: p.lat, lng: p.lng }));
      plannedRef.current = new maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: "#0083be",
        strokeOpacity: 0,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 0.85,
              strokeColor: "#0083be",
              scale: 3,
            },
            offset: "0",
            repeat: "14px",
          },
        ],
      });
      path.forEach((p) => {
        bounds.extend(p);
        hasBounds = true;
      });
    }

    trailRef.current?.setMap(null);
    trailRef.current = null;
    if (trail.length >= 2) {
      const path = trail.map((p) => ({ lat: p.lat, lng: p.lng }));
      trailRef.current = new maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: "#0d9f6e",
        strokeOpacity: 0.95,
        strokeWeight: 5,
      });
      path.forEach((p) => {
        bounds.extend(p);
        hasBounds = true;
      });
    }

    if (hasBounds) {
      if (points.length + planned.length + trail.length <= 1) {
        const only = points[0] || planned[0] || trail[0];
        if (only) map.setCenter({ lat: only.lat, lng: only.lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
    }
  }, [engineReady, points, planned, trail, selectedId]);

  return (
    <div className="adb-ops-map" style={{ width: "100%", height: "100%", minHeight: 420, position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 420 }} />
      {missingKey ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#e8eef2",
            zIndex: 2,
            textAlign: "center",
            fontSize: 13,
            color: "#334155",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: 8 }}>Google Maps API anahtarı gerekli</strong>
            Admin `.env` içine{" "}
            <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
            ekleyip admin’i yeniden başlatın.
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
              Google Cloud → Maps JavaScript API (aylık ücretsiz kotası var)
            </div>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          zIndex: 5,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          pointerEvents: "none",
        }}
      >
        <Legend swatch="#0083be" dashed label="Planlı rota" />
        <Legend swatch="#0d9f6e" label="Geçilen yol" />
        <Legend swatch="#e85d04" label="Seçili" />
      </div>
    </div>
  );
}

function Legend({ swatch, label, dashed }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.95)",
        border: "1px solid rgba(11,42,61,0.12)",
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 11,
        boxShadow: "0 2px 10px rgba(11,42,61,0.1)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 3,
          borderRadius: 2,
          background: dashed ? "transparent" : swatch,
          borderTop: dashed ? `3px dashed ${swatch}` : undefined,
        }}
      />
      {label}
    </div>
  );
}
