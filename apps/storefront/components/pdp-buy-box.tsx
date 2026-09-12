"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@adb/ui";
import { AddToCartButton } from "./add-to-cart-button";

type Variant = { id: string; sku: string; name: string };

export function PdpBuyBox({
  productId,
  sku,
  name,
  unitPrice,
  variants,
}: {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  variants?: Variant[];
}) {
  const list = useMemo(() => variants ?? [], [variants]);
  const [selected, setSelected] = useState(list[0]?.id || productId);
  const current = list.find((v) => v.id === selected);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {list.length > 1 ? (
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>Varyant</span>
          <SearchableSelect
            options={list.map((v) => ({
              value: v.id,
              label: `${v.name} (${v.sku})`,
              searchText: `${v.name} ${v.sku}`,
            }))}
            value={selected}
            onChange={setSelected}
            searchPlaceholder="Varyant ara…"
          />
        </label>
      ) : null}
      <AddToCartButton
        productId={productId}
        variantId={selected}
        sku={current?.sku || sku}
        name={current?.name || name}
        unitPrice={unitPrice}
      />
    </div>
  );
}
