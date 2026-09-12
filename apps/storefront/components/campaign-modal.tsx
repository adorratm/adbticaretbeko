"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@adb/api-client";
import { Button } from "@adb/ui";

type Campaign = {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  showModal?: boolean;
};

const SEEN_KEY = "adb_campaign_modal_seen";

export function CampaignModalHost() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const api = useMemo(() => createApiClient({ baseUrl: "" }), []);

  useEffect(() => {
    let cancelled = false;
    api.promotions
      .listCampaigns(true)
      .then((r) => {
        if (cancelled) return;
        const modalOnes = (r.items || []).filter((c) => c.showModal && c.active !== false);
        const next = modalOnes[0] as Campaign | undefined;
        if (!next) return;
        try {
          const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[];
          if (seen.includes(next.id)) return;
        } catch {
          /* show */
        }
        setCampaign(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api.promotions]);

  function dismiss() {
    if (campaign) {
      try {
        const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[];
        localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, campaign.id])]));
      } catch {
        /* ignore */
      }
    }
    setCampaign(null);
  }

  if (!campaign) return null;

  return (
    <div className="adb-campaign-modal" role="dialog" aria-modal="true" aria-label={campaign.title}>
      <button type="button" className="adb-campaign-modal-backdrop" aria-label="Kapat" onClick={dismiss} />
      <div className="adb-campaign-modal-panel adb-animate-in">
        {campaign.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.imageUrl} alt="" className="adb-campaign-modal-img" />
        ) : (
          <div className="adb-campaign-modal-img adb-campaign-modal-img-fallback" />
        )}
        <div style={{ padding: "20px 22px 22px" }}>
          {campaign.subtitle ? (
            <div className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 6 }}>
              {campaign.subtitle}
            </div>
          ) : null}
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{campaign.title}</h2>
          <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.55 }}>{campaign.body}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            {campaign.ctaHref ? (
              <Link href={campaign.ctaHref} className="adb-btn adb-btn-primary" onClick={dismiss} style={{ textDecoration: "none" }}>
                {campaign.ctaLabel || "İncele"}
              </Link>
            ) : null}
            <Button type="button" variant="tertiary" onClick={dismiss}>
              Sonra
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
