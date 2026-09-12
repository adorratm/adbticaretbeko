"use client";

import { Field, Input } from "@adb/ui";

export function LeadForm() {
  return (
    <form style={{ display: "grid", gap: 12 }} onSubmit={(e) => e.preventDefault()}>
      <Field label="Ad Soyad" hint="Danışmanımız bu isimle hitap eder">
        <Input name="name" placeholder="Örn. Ayşe Yılmaz" required />
      </Field>
      <Field label="Telefon" hint="WhatsApp veya arama için">
        <Input name="phone" type="tel" placeholder="05xx xxx xx xx" required />
      </Field>
      <label className="adb-check">
        <input type="checkbox" required />
        <span className="adb-check-box" aria-hidden />
        <span>KVKK aydınlatma metnini okudum, 15 dakika içinde aranmayı kabul ediyorum.</span>
      </label>
      <button type="submit" className="adb-btn adb-btn-primary">
        Beni Ara
      </button>
    </form>
  );
}
