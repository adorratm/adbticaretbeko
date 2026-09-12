"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@adb/ui";
import { getStoreAccessToken, getStoreUser, parseApiError } from "@adb/api-client";
import { createStoreApi } from "../lib/store-api";
import { useStoreAuth } from "../hooks/use-store-auth";

export function WishlistButton({
  productId,
  productName,
  sku,
  productSlug,
}: {
  productId: string;
  productName: string;
  sku: string;
  productSlug: string;
}) {
  const auth = useStoreAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!getStoreAccessToken()) {
      window.location.href = `/auth/login?next=${encodeURIComponent(`/urun/${productSlug}`)}`;
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const api = createStoreApi();
      const user = getStoreUser();
      const profile = await api.customers.me().catch(() =>
        api.customers.ensure({
          email: user?.email,
          firstName: "Müşteri",
          lastName: "-",
        }),
      );
      await api.wishlist.add(profile.id, {
        productId,
        productName,
        sku,
        productSlug,
      });
      setMsg("Favorilere eklendi");
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  // Auth hazır olana kadar sabit etiket — SSR/client mismatch önlenir
  const label = busy
    ? "Ekleniyor…"
    : !auth.ready
      ? "Favorilere ekle"
      : auth.loggedIn
        ? "Favorilere ekle"
        : "Favori için giriş yap";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Button type="button" variant="tertiary" disabled={busy} onClick={add}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          favorite
        </span>
        {label}
      </Button>
      {msg ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--adb-primary)" }}>
          {msg}{" "}
          {msg.includes("eklendi") ? (
            <Link href="/hesabim/favoriler" style={{ fontWeight: 700 }}>
              Listeye git
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
