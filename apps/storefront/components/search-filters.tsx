"use client";

import { useRouter } from "next/navigation";
import { SearchableSelect } from "@adb/ui";

const categoryOptions = [
  { value: "", label: "Tüm Kategoriler" },
  { value: "buzdolaplari", label: "Buzdolapları" },
  { value: "camasir-makineleri", label: "Çamaşır Makineleri" },
  { value: "bulasik-makineleri", label: "Bulaşık Makineleri" },
  { value: "klimalar", label: "Klimalar" },
  { value: "ankastre-setler", label: "Ankastre Setler" },
  { value: "kucuk-ev-robot", label: "Küçük Ev & Robot" },
];

export function SearchFilters({
  q,
  category,
}: {
  q: string;
  category: string;
}) {
  const router = useRouter();

  function push(nextQ: string, nextCategory: string) {
    const qs = new URLSearchParams();
    if (nextQ.trim()) qs.set("q", nextQ.trim());
    if (nextCategory) qs.set("category", nextCategory);
    router.push(`/arama${qs.toString() ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        push(String(fd.get("q") || ""), category);
      }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28, alignItems: "center" }}
    >
      <div style={{ minWidth: 220, flex: "0 1 240px" }}>
        <SearchableSelect
          options={categoryOptions}
          value={category}
          onChange={(v) => push(q, v)}
          placeholder="Tüm Kategoriler"
          searchPlaceholder="Kategori ara…"
        />
      </div>
      <input
        className="adb-input"
        name="q"
        defaultValue={q}
        placeholder="Model veya kod ara…"
        style={{ flex: 1, minWidth: 180, height: 44 }}
      />
      <button type="submit" className="adb-btn adb-btn-primary" style={{ height: 44 }}>
        Ara
      </button>
    </form>
  );
}
