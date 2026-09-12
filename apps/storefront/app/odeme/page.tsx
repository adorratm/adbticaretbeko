"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, SearchableSelect } from "@adb/ui";
import {
  getStoreAccessToken,
  getStoreUser,
  parseApiError,
  type Cart,
  type CustomerAddress,
  type CustomerProfile,
} from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";
import {
  clearCartId,
  createStoreApi,
  formatTRY,
  getCartId,
} from "../../lib/store-api";

type Step = 1 | 2 | 3;

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [cart, setCart] = useState<Cart | null>(null);
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressId, setAddressId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [email, setEmail] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [billingSame, setBillingSame] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingLine1, setBillingLine1] = useState("");
  const [billingDistrict, setBillingDistrict] = useState("");
  const [billingCity, setBillingCity] = useState("İstanbul");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ orderId: string; paymentId?: string; total: number } | null>(
    null,
  );

  const [loggedIn, setLoggedIn] = useState(false);

  const selected = useMemo(
    () => addresses.find((a) => a.id === addressId),
    [addresses, addressId],
  );

  useEffect(() => {
    setLoggedIn(!!getStoreAccessToken());
  }, []);

  useEffect(() => {
    const api = createStoreApi();
    const cartId = getCartId();
    if (!cartId) return;
    api.cart.get(cartId).then(setCart).catch(() => undefined);
    api.checkout
      .preview(cartId)
      .then((p) => setTotal(p.total))
      .catch(() => undefined);

    if (!getStoreAccessToken()) return;
    const user = getStoreUser();
    api.customers
      .me()
      .catch(() =>
        api.customers.ensure({
          email: user?.email,
          firstName: "Müşteri",
          lastName: "-",
        }),
      )
      .then(async (p) => {
        setProfile(p);
        setName(`${p.firstName} ${p.lastName}`.trim());
        setPhone(p.phone || "");
        setEmail(p.email || user?.email || "");
        const addr = await api.customers.listAddresses();
        setAddresses(addr.items);
        const def = addr.items.find((a) => a.isDefault) || addr.items[0];
        if (def) {
          setAddressId(def.id);
          setLine1(def.line1);
          setDistrict(def.district);
          setCity(def.city);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!email) {
      const u = getStoreUser();
      if (u?.email) setEmail(u.email);
    }
  }, [email]);

  useEffect(() => {
    if (!selected) return;
    setLine1(selected.line1);
    setDistrict(selected.district);
    setCity(selected.city);
  }, [selected]);

  const itemCount = cart?.items.reduce((a, i) => a + i.qty, 0) ?? 0;
  const empty = !cart || cart.items.length === 0;

  async function placeOrder() {
    const cartId = getCartId();
    if (!cartId) return;
    setBusy(true);
    setMsg("");
    try {
      const api = createStoreApi();
      const order = await api.checkout.create(cartId, {
        customerId: profile?.id,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        district,
        addressLine: line1,
        city,
        billingName: billingSame ? name : billingName || name,
        taxNo: taxNo || undefined,
        billingAddress: billingSame
          ? [line1, `${district} / ${city}`].filter(Boolean).join(", ")
          : [billingLine1, `${billingDistrict} / ${billingCity}`].filter(Boolean).join(", "),
        paymentMethod,
        couponCode: cart?.couponCode,
      });
      const paymentId = order.payment?.id;
      const checkoutUrl = order.payment?.checkoutUrl;
      if (checkoutUrl) {
        clearCartId();
        window.location.href = checkoutUrl;
        return;
      }
      if (paymentId) {
        try {
          await api.payments.simulateSuccess(paymentId);
        } catch {
          /* mock optional */
        }
      }
      clearCartId();
      setResult({
        orderId: order.id,
        paymentId,
        total: order.total,
      });
      setStep(3);
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StorefrontShell cartCount={itemCount}>
      <main className="adb-container" style={{ padding: "32px 24px 64px" }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
          Checkout
        </p>
        <h1 style={{ margin: "6px 0 8px" }}>Ödeme</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { n: 1 as Step, label: "Adres" },
            { n: 2 as Step, label: "Ödeme" },
            { n: 3 as Step, label: "Sonuç" },
          ].map((s) => (
            <div
              key={s.n}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                background: step === s.n ? "var(--adb-primary-container)" : "var(--adb-surface-low)",
                color: step === s.n ? "#fff" : "var(--adb-muted)",
              }}
            >
              {s.n}. {s.label}
            </div>
          ))}
        </div>

        {empty && step !== 3 ? (
          <div className="adb-card" style={{ padding: 28, textAlign: "center" }}>
            <p>Sepet boş.</p>
            <Link href="/sepet" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
              Sepete dön
            </Link>
          </div>
        ) : (
          <div
            className="adb-checkout-grid"
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.7fr)",
              alignItems: "start",
            }}
          >
            <div className="adb-card" style={{ padding: 22 }}>
              {msg ? (
                <Alert tone="error" style={{ marginBottom: 12 }}>
                  {msg}
                </Alert>
              ) : null}

              {step === 1 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Teslimat bilgileri</h2>
                  {!loggedIn ? (
                    <Alert tone="info">
                      Kayıtlı adresleriniz için{" "}
                      <Link href="/auth/login?next=/odeme" style={{ fontWeight: 700 }}>
                        giriş yapın
                      </Link>
                      . Misafir olarak da devam edebilirsiniz.
                    </Alert>
                  ) : null}
                  {addresses.length > 0 ? (
                    <Field label="Kayıtlı adres">
                      <SearchableSelect
                        options={addresses.map((a) => ({
                          value: a.id,
                          label: `${a.title} — ${a.district}/${a.city}`,
                          searchText: `${a.title} ${a.line1} ${a.district} ${a.city}`,
                        }))}
                        value={addressId}
                        onChange={setAddressId}
                        placeholder="Adres seçin"
                        searchPlaceholder="Adres ara…"
                      />
                    </Field>
                  ) : null}
                  <Field label="Ad Soyad">
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </Field>
                  <Field label="Telefon">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </Field>
                  <Field label="E-posta">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fatura@ornek.com" />
                  </Field>
                  <Field label="Adres">
                    <Input value={line1} onChange={(e) => setLine1(e.target.value)} required />
                  </Field>
                  <div className="adb-form-2col" style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                    <Field label="İlçe">
                      <Input value={district} onChange={(e) => setDistrict(e.target.value)} required />
                    </Field>
                    <Field label="İl">
                      <Input value={city} onChange={(e) => setCity(e.target.value)} required />
                    </Field>
                  </div>
                  <Field label="VKN / TCKN (fatura, opsiyonel)">
                    <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} placeholder="11 veya 10 haneli" />
                  </Field>
                  <label className="adb-check">
                    <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
                    <span className="adb-check-box" aria-hidden />
                    <span>Fatura adresim teslimat adresimle aynı</span>
                  </label>
                  {!billingSame ? (
                    <div
                      className="adb-animate-in"
                      style={{
                        display: "grid",
                        gap: 12,
                        padding: 16,
                        background: "var(--adb-surface)",
                        border: "1px solid var(--adb-border-subtle)",
                        borderRadius: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 15, fontFamily: "var(--adb-font-display)" }}>Fatura adresi</h3>
                      <Field label="Fatura ünvanı / Ad soyad">
                        <Input value={billingName} onChange={(e) => setBillingName(e.target.value)} required={!billingSame} placeholder="Şirket veya kişi adı" />
                      </Field>
                      <Field label="Fatura adresi">
                        <Input value={billingLine1} onChange={(e) => setBillingLine1(e.target.value)} required={!billingSame} />
                      </Field>
                      <div className="adb-form-2col" style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                        <Field label="İlçe">
                          <Input value={billingDistrict} onChange={(e) => setBillingDistrict(e.target.value)} required={!billingSame} />
                        </Field>
                        <Field label="İl">
                          <Input value={billingCity} onChange={(e) => setBillingCity(e.target.value)} required={!billingSame} />
                        </Field>
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button
                      onClick={() => {
                        if (!name.trim() || !phone.trim() || !line1.trim() || !district.trim()) {
                          setMsg("Teslimat adres alanlarını doldurun");
                          return;
                        }
                        if (!billingSame && (!billingName.trim() || !billingLine1.trim() || !billingDistrict.trim())) {
                          setMsg("Fatura adresi alanlarını doldurun");
                          return;
                        }
                        setMsg("");
                        setStep(2);
                      }}
                    >
                      Ödemeye geç
                    </Button>
                    <Link href="/sepet" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                      Sepete dön
                    </Link>
                    {loggedIn ? (
                      <Link href="/hesabim/adresler" style={{ alignSelf: "center", fontSize: 13, fontWeight: 600 }}>
                        Adreslerimi yönet
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Ödeme yöntemi</h2>
                  <Field label="Yöntem">
                    <SearchableSelect
                      options={[
                        { value: "CARD", label: "Kredi / banka kartı (mock)" },
                        { value: "TRANSFER", label: "Havale / EFT" },
                        { value: "DOOR", label: "Kapıda ödeme" },
                      ]}
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                    />
                  </Field>
                  <Alert tone="info">
                    Geliştirme ortamında ödeme mock ile tamamlanır; gerçek PSP entegrasyonu Phase 3.
                  </Alert>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button disabled={busy} onClick={placeOrder}>
                      {busy ? "Sipariş oluşturuluyor…" : "Siparişi onayla"}
                    </Button>
                    <button type="button" className="adb-btn adb-btn-tertiary" onClick={() => setStep(1)}>
                      Geri
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 3 && result ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 42, color: "#065f46" }}>
                    check_circle
                  </span>
                  <h2 style={{ margin: 0 }}>Siparişiniz alındı</h2>
                  <p style={{ color: "var(--adb-muted)", margin: 0 }}>
                    Sipariş no: <code>{result.orderId}</code>
                    {result.paymentId ? (
                      <>
                        <br />
                        Ödeme: <code>{result.paymentId}</code>
                      </>
                    ) : null}
                  </p>
                  <p style={{ fontWeight: 700 }}>{formatTRY(result.total)}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href="/hesabim/siparisler" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
                      Siparişlerim
                    </Link>
                    <Button onClick={() => router.push(`/odeme/sonuc?orderId=${result.orderId}&paymentId=${result.paymentId || ""}`)}>
                      Sonuç sayfası
                    </Button>
                    <Link href="/" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                      Ana sayfa
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="adb-card" style={{ padding: 18 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Özet</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {(cart?.items || []).map((it) => (
                  <li key={it.variantId} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span>
                      {it.name} × {it.qty}
                    </span>
                    <strong>{formatTRY(it.unitPrice * it.qty)}</strong>
                  </li>
                ))}
              </ul>
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--adb-border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 800,
                }}
              >
                <span>Toplam</span>
                <span>{formatTRY(total)}</span>
              </div>
            </aside>
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}
