"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { StorefrontShell } from "../../../components/site-shell";
import { createStoreApi, formatTRY } from "../../../lib/store-api";

function MockPayInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const paymentId = sp.get("paymentId") || "";
  const orderId = sp.get("orderId") || "";
  const amount = Number(sp.get("amount") || 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function approve() {
    if (!paymentId) {
      setMsg("paymentId eksik");
      return;
    }
    setBusy(true);
    try {
      await createStoreApi().payments.simulateSuccess(paymentId);
      router.replace(`/odeme/sonuc?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}`);
    } catch (e) {
      setMsg(parseApiError(e));
      setBusy(false);
    }
  }

  return (
    <StorefrontShell>
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 24px 64px" }}>
        <div className="adb-card" style={{ padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adb-muted)", letterSpacing: "0.04em" }}>
            MOCK PSP · GELİŞTİRME
          </div>
          <h1 style={{ marginTop: 8 }}>Ödeme onayı</h1>
          <p style={{ color: "var(--adb-muted)", fontSize: 14 }}>
            Gerçek iyzico/PayTR anahtarı yokken bu sayfa ödeme başarısını simüle eder. Production’da
            <code> PAYMENT_PROVIDER=iyzico|paytr </code> ve API anahtarları kullanılır.
          </p>
          <div style={{ display: "grid", gap: 8, fontSize: 14, margin: "16px 0" }}>
            <div>
              Sipariş: <code>{orderId || "—"}</code>
            </div>
            <div>
              Ödeme: <code>{paymentId.slice(0, 8) || "—"}…</code>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{amount > 0 ? formatTRY(amount) : "Tutar —"}</div>
          </div>
          {msg ? (
            <Alert tone="error" style={{ marginBottom: 12 }}>
              {msg}
            </Alert>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button type="button" disabled={busy || !paymentId} onClick={approve}>
              {busy ? "Onaylanıyor…" : "Ödemeyi onayla"}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => router.push("/sepet")}
              disabled={busy}
            >
              Vazgeç
            </Button>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor…</div>}>
      <MockPayInner />
    </Suspense>
  );
}
