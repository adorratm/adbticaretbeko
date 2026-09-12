"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";
import { useAdminBranch } from "../../components/admin-branch";
import { ProductSearchField } from "../../components/product-search-field";

type Warehouse = { id: string; name: string; code: string; city: string };
type ByWh = {
  warehouseCode: string;
  warehouseName: string;
  available: number;
  reserved: number;
  saleable: number;
};

export default function StokPage() {
  const { branchCode } = useAdminBranch();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variantId, setVariantId] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [byWarehouse, setByWarehouse] = useState<ByWh[]>([]);
  const [fromWarehouse, setFromWarehouse] = useState("MAIN");
  const [toWarehouse, setToWarehouse] = useState("BESIKTAS");
  const [qty, setQty] = useState("1");
  const [adjustWh, setAdjustWh] = useState("MAIN");
  const [adjustQty, setAdjustQty] = useState("10");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => createAdminApi(), []);

  useEffect(() => {
    api.warehouses
      .list()
      .then((r) => setWarehouses(r.items))
      .catch(() => undefined);
  }, [api]);

  useEffect(() => {
    if (!branchCode) return;
    setToWarehouse(branchCode);
    setAdjustWh(branchCode === "MAIN" ? "MAIN" : branchCode);
  }, [branchCode]);

  async function lookup(id = variantId) {
    if (!id) return;
    try {
      const res = await api.inventory.get(id);
      setByWarehouse(res.byWarehouse || []);
      setTone("success");
      setMsg(`Toplam satılabilir: ${res.saleable}`);
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
      setByWarehouse([]);
    }
  }

  async function transfer() {
    if (!variantId) return;
    setBusy(true);
    try {
      await api.inventory.transfer({
        variantId,
        fromWarehouse,
        toWarehouse,
        qty: Number(qty),
      });
      setTone("success");
      setMsg("Transfer tamam");
      setConfirmTransfer(false);
      await lookup();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId) {
      setTone("error");
      setMsg("Önce ürün seçin");
      return;
    }
    try {
      await api.inventory.adjust(variantId, Number(adjustQty), adjustWh);
      setTone("success");
      setMsg(`Stok ayarlandı (${adjustWh})`);
      await lookup();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    }
  }

  return (
    <AdminShell title="Şube Stok">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Multi-şube stok görüntüleme, ayar ve transfer — ürünü ad / SKU ile arayın (Elasticsearch)
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div className="adb-card" style={{ padding: 16, display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Şubeler</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {warehouses.map((w) => (
              <li key={w.id}>
                <strong>{w.code}</strong> — {w.name} ({w.city})
              </li>
            ))}
          </ul>
        </div>
        <div className="adb-card" style={{ padding: 16, display: "grid", gap: 8, overflow: "visible", position: "relative", zIndex: 2 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Stok sorgula</h2>
          <Field label="Ürün ara">
            <ProductSearchField
              valueId={variantId}
              valueLabel={productLabel}
              onSelect={(hit) => {
                if (!hit) {
                  setVariantId("");
                  setProductLabel("");
                  setByWarehouse([]);
                  return;
                }
                setVariantId(hit.id);
                setProductLabel(`${hit.name} (${hit.sku})`);
                lookup(hit.id);
              }}
            />
          </Field>
          <Button type="button" onClick={() => lookup()} disabled={!variantId}>
            Yenile
          </Button>
          {byWarehouse.length > 0 ? (
            <div className="admin-table-wrap">
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "6px 0" }}>Şube</th>
                    <th>Satılabilir</th>
                  </tr>
                </thead>
                <tbody>
                  {byWarehouse.map((b) => (
                    <tr key={b.warehouseCode}>
                      <td style={{ padding: "6px 0" }}>
                        {b.warehouseName} ({b.warehouseCode})
                      </td>
                      <td>{b.saleable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <form className="adb-card" style={{ padding: 16, display: "grid", gap: 8 }} onSubmit={adjust}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Stok ayarla</h2>
          <SearchableSelect
            options={warehouses.map((w) => ({
              value: w.code,
              label: w.name,
              searchText: `${w.name} ${w.code}`,
            }))}
            value={adjustWh}
            onChange={setAdjustWh}
            placeholder="Depo seçin"
            searchPlaceholder="Depo ara…"
          />
          <Input value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          <Button type="submit" disabled={!variantId}>
            Kaydet
          </Button>
        </form>
        <form
          className="adb-card"
          style={{ padding: 16, display: "grid", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!variantId) {
              setTone("error");
              setMsg("Önce ürün seçin");
              return;
            }
            setConfirmTransfer(true);
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>Şubeler arası transfer</h2>
          <SearchableSelect
            options={warehouses.map((w) => ({
              value: w.code,
              label: `Kaynak: ${w.name}`,
              searchText: `${w.name} ${w.code}`,
            }))}
            value={fromWarehouse}
            onChange={setFromWarehouse}
            placeholder="Kaynak depo"
          />
          <SearchableSelect
            options={warehouses.map((w) => ({
              value: w.code,
              label: `Hedef: ${w.name}`,
              searchText: `${w.name} ${w.code}`,
            }))}
            value={toWarehouse}
            onChange={setToWarehouse}
            placeholder="Hedef depo"
          />
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          <Button type="submit" disabled={!variantId}>
            Transfer et
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmTransfer}
        title="Transferi onayla?"
        description={
          <>
            {qty} adet stok <strong>{fromWarehouse}</strong> → <strong>{toWarehouse}</strong> aktarılacak
            {productLabel ? (
              <>
                {" "}
                (<em>{productLabel}</em>)
              </>
            ) : null}
            .
          </>
        }
        confirmLabel="Transfer et"
        tone="primary"
        loading={busy}
        onCancel={() => !busy && setConfirmTransfer(false)}
        onConfirm={transfer}
      />
    </AdminShell>
  );
}
