"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, EmptyState, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Tab = "ozet" | "faturalar" | "cari" | "fisler" | "kasa";

type Invoice = {
  id: string;
  orderId: string;
  number: string;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  netAmount?: number;
  taxNo?: string;
  status: string;
  eInvoiceStatus?: string;
  eInvoiceUuid?: string;
  pdfUrl: string;
  customerName?: string;
};

type Summary = {
  invoiceCount: number;
  invoiceTotal: number;
  vatCollected: number;
  netSales: number;
  income: number;
  expense: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
  eInvoiceProvider?: string;
};

type CariRow = {
  partyName: string;
  taxNo: string;
  sales: number;
  invoiceCount: number;
  collected: number;
  paid: number;
  balance: number;
};

type LedgerRow = {
  id: string;
  entryDate: string;
  kind: string;
  category: string;
  description: string;
  amount: number;
  partyName: string;
};

type CashAccount = {
  id: string;
  code: string;
  name: string;
  kind: string;
  balance: number;
};

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format((kurus || 0) / 100);
}

function kindLabel(k: string) {
  const map: Record<string, string> = {
    INCOME: "Gelir",
    EXPENSE: "Gider",
    COLLECTION: "Tahsilat",
    PAYMENT: "Ödeme",
  };
  return map[k] || k;
}

export default function MuhasebePage() {
  const api = useMemo(() => createAdminApi(), []);
  const [tab, setTab] = useState<Tab>("ozet");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cari, setCari] = useState<CariRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);

  const [orderId, setOrderId] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [taxNo, setTaxNo] = useState("");

  const [fisKind, setFisKind] = useState<"INCOME" | "EXPENSE" | "COLLECTION" | "PAYMENT">("INCOME");
  const [fisAmount, setFisAmount] = useState("");
  const [fisCategory, setFisCategory] = useState("");
  const [fisDesc, setFisDesc] = useState("");
  const [fisParty, setFisParty] = useState("");
  const [fisCashId, setFisCashId] = useState("");

  const load = useCallback(async () => {
    const [s, inv, c, l, a] = await Promise.all([
      api.accounting.summary(),
      api.accounting.listInvoices(),
      api.accounting.cari(),
      api.accounting.ledger(),
      api.accounting.cashAccounts(),
    ]);
    setSummary(s);
    setInvoices((inv.items || []) as Invoice[]);
    setCari(c.items || []);
    setLedger(l.items || []);
    setAccounts(a.items || []);
    setFisCashId((prev) => prev || a.items?.[0]?.id || "");
  }, [api]);

  useEffect(() => {
    load()
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function createInvoice() {
    const amountTl = Number(orderAmount.replace(",", "."));
    if (!orderId.trim() || !Number.isFinite(amountTl) || amountTl <= 0) {
      setTone("error");
      setMsg("Sipariş ID ve tutar (TL) gerekli");
      return;
    }
    setBusy(true);
    try {
      await api.accounting.createInvoice({
        orderId: orderId.trim(),
        amount: Math.round(amountTl * 100),
        customerName: customerName.trim() || undefined,
        taxNo: taxNo.trim() || undefined,
      });
      setTone("success");
      setMsg("Fatura oluşturuldu");
      setOrderId("");
      setOrderAmount("");
      setCustomerName("");
      setTaxNo("");
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoice(id: string) {
    setBusy(true);
    try {
      await api.accounting.cancelInvoice(id);
      setTone("success");
      setMsg("Fatura iptal edildi");
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createFis() {
    const amountTl = Number(fisAmount.replace(",", "."));
    if (!Number.isFinite(amountTl) || amountTl <= 0) {
      setTone("error");
      setMsg("Tutar (TL) gerekli");
      return;
    }
    setBusy(true);
    try {
      await api.accounting.createLedger({
        kind: fisKind,
        amount: Math.round(amountTl * 100),
        category: fisCategory.trim(),
        description: fisDesc.trim(),
        partyName: fisParty.trim(),
        cashAccountId: fisCashId || undefined,
      });
      setTone("success");
      setMsg("Fiş kaydedildi");
      setFisAmount("");
      setFisDesc("");
      setFisParty("");
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "ozet", label: "Özet" },
    { id: "faturalar", label: "Faturalar" },
    { id: "cari", label: "Cari" },
    { id: "fisler", label: "Gelir / Gider" },
    { id: "kasa", label: "Kasa / Banka" },
  ];

  return (
    <AdminShell title="Ön Muhasebe">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Fatura, cari, gelir-gider ve kasa/banka — e-Fatura provider: {summary?.eInvoiceProvider || "stub"}
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="adb-btn adb-btn-tertiary"
            onClick={() => setTab(t.id)}
            style={{
              height: 36,
              borderColor: tab === t.id ? "var(--adb-primary)" : undefined,
              background: tab === t.id ? "rgba(0,86,179,0.08)" : undefined,
              fontWeight: tab === t.id ? 700 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState title="Yükleniyor…" />
      ) : tab === "ozet" && summary ? (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {[
            { label: "Satış faturaları", value: String(summary.invoiceCount) },
            { label: "Brüt satış", value: formatTRY(summary.invoiceTotal) },
            { label: "Net satış", value: formatTRY(summary.netSales) },
            { label: "Hesaplanan KDV", value: formatTRY(summary.vatCollected) },
            { label: "Gelir (fiş)", value: formatTRY(summary.income) },
            { label: "Gider (fiş)", value: formatTRY(summary.expense) },
            { label: "Net (gelir−gider)", value: formatTRY(summary.profit) },
            { label: "Kasa", value: formatTRY(summary.cashBalance) },
            { label: "Banka", value: formatTRY(summary.bankBalance) },
          ].map((k) => (
            <div key={k.label} className="adb-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--adb-muted)", fontWeight: 700 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "faturalar" ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)" }}>
          <div className="adb-card" style={{ overflow: "hidden", minWidth: 0 }}>
            <div className="admin-table-wrap">
              {invoices.length === 0 ? (
                <EmptyState title="Fatura yok" description="Sağdan sipariş faturası oluşturun veya ödeme sonrası otomatik oluşsun." />
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                  <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                    <tr>
                      <th style={{ padding: 12 }}>No</th>
                      <th style={{ padding: 12 }}>Müşteri</th>
                      <th style={{ padding: 12 }}>Net / KDV</th>
                      <th style={{ padding: 12 }}>Toplam</th>
                      <th style={{ padding: 12 }}>Durum</th>
                      <th style={{ padding: 12 }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                        <td style={{ padding: 12, fontWeight: 700 }}>{inv.number}</td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          {inv.customerName || "—"}
                          <br />
                          <span style={{ color: "var(--adb-muted)" }}>#{inv.orderId.slice(0, 8)}</span>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          {formatTRY(inv.netAmount ?? 0)}
                          <br />
                          <span style={{ color: "var(--adb-muted)" }}>
                            KDV %{inv.taxRate ?? 20}: {formatTRY(inv.taxAmount ?? 0)}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>{formatTRY(inv.amount)}</td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          {inv.status}
                          <br />
                          <span style={{ color: "var(--adb-muted)" }}>{inv.eInvoiceStatus}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <a href={inv.pdfUrl || `/api/v1/accounting/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                              <Button type="button" variant="tertiary" style={{ height: 32, fontSize: 12 }}>
                                PDF
                              </Button>
                            </a>
                            {inv.status !== "CANCELLED" ? (
                              <Button
                                type="button"
                                variant="tertiary"
                                style={{ height: 32, fontSize: 12 }}
                                disabled={busy}
                                onClick={() => cancelInvoice(inv.id)}
                              >
                                İptal
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <form
            className="adb-card"
            style={{ padding: 14, display: "grid", gap: 10, height: "fit-content", minWidth: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              createInvoice();
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15 }}>Siparişten fatura</h3>
            <Field label="Sipariş ID">
              <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="UUID" />
            </Field>
            <Field label="Tutar (TL, KDV dahil)">
              <Input value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Müşteri">
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>
            <Field label="VKN / TCKN">
              <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>
              Fatura oluştur
            </Button>
          </form>
        </div>
      ) : null}

      {tab === "cari" ? (
        <div className="adb-card" style={{ overflow: "hidden" }}>
          <div className="admin-table-wrap">
            {cari.length === 0 ? (
              <EmptyState title="Cari yok" description="Fatura kesildikçe müşteri carileri burada oluşur." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Cari</th>
                    <th style={{ padding: 12 }}>VKN</th>
                    <th style={{ padding: 12 }}>Satış</th>
                    <th style={{ padding: 12 }}>Tahsilat</th>
                    <th style={{ padding: 12 }}>Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {cari.map((row) => (
                    <tr key={`${row.partyName}-${row.taxNo}`} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                      <td style={{ padding: 12, fontWeight: 650 }}>
                        {row.partyName}
                        <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>{row.invoiceCount} fatura</div>
                      </td>
                      <td style={{ padding: 12 }}>{row.taxNo || "—"}</td>
                      <td style={{ padding: 12 }}>{formatTRY(row.sales)}</td>
                      <td style={{ padding: 12 }}>{formatTRY(row.collected)}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: row.balance > 0 ? "var(--adb-error)" : undefined }}>
                        {formatTRY(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {tab === "fisler" ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)" }}>
          <div className="adb-card" style={{ overflow: "hidden", minWidth: 0 }}>
            <div className="admin-table-wrap">
              {ledger.length === 0 ? (
                <EmptyState title="Fiş yok" />
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                    <tr>
                      <th style={{ padding: 12 }}>Tarih</th>
                      <th style={{ padding: 12 }}>Tür</th>
                      <th style={{ padding: 12 }}>Açıklama</th>
                      <th style={{ padding: 12 }}>Cari</th>
                      <th style={{ padding: 12 }}>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                        <td style={{ padding: 12 }}>{row.entryDate}</td>
                        <td style={{ padding: 12 }}>{kindLabel(row.kind)}</td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          {row.description || row.category || "—"}
                        </td>
                        <td style={{ padding: 12 }}>{row.partyName || "—"}</td>
                        <td style={{ padding: 12, fontWeight: 700 }}>{formatTRY(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <form
            className="adb-card"
            style={{ padding: 14, display: "grid", gap: 10, height: "fit-content", minWidth: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              createFis();
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15 }}>Yeni fiş</h3>
            <Field label="Tür">
              <SearchableSelect
                options={[
                  { value: "INCOME", label: "Gelir" },
                  { value: "EXPENSE", label: "Gider" },
                  { value: "COLLECTION", label: "Tahsilat (cari)" },
                  { value: "PAYMENT", label: "Ödeme (cari)" },
                ]}
                value={fisKind}
                onChange={(v) => setFisKind(v as typeof fisKind)}
              />
            </Field>
            <Field label="Tutar (TL)">
              <Input value={fisAmount} onChange={(e) => setFisAmount(e.target.value)} />
            </Field>
            <Field label="Kategori">
              <Input value={fisCategory} onChange={(e) => setFisCategory(e.target.value)} placeholder="Kira, nakliye…" />
            </Field>
            <Field label="Açıklama">
              <Input value={fisDesc} onChange={(e) => setFisDesc(e.target.value)} />
            </Field>
            <Field label="Cari adı">
              <Input value={fisParty} onChange={(e) => setFisParty(e.target.value)} />
            </Field>
            <Field label="Kasa / banka">
              <SearchableSelect
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${formatTRY(a.balance)})`,
                  searchText: `${a.code} ${a.name}`,
                }))}
                value={fisCashId}
                onChange={setFisCashId}
                clearable
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Kaydet
            </Button>
          </form>
        </div>
      ) : null}

      {tab === "kasa" ? (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {accounts.length === 0 ? (
            <EmptyState title="Hesap yok" />
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="adb-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--adb-muted)" }}>
                  {a.kind === "BANK" ? "BANKA" : "KASA"} · {a.code}
                </div>
                <div style={{ fontSize: 16, fontWeight: 750, marginTop: 4 }}>{a.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>{formatTRY(a.balance)}</div>
              </div>
            ))
          )}
          <div className="adb-card" style={{ padding: 16, gridColumn: "1 / -1" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--adb-muted)" }}>
              Kasa/banka bakiyesi, gelir-gider fişlerinde hesap seçildiğinde otomatik güncellenir. Tahsilat → artar, gider/ödeme → azalır.
            </p>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
