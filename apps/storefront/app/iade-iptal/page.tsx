import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function IadeIptalPage() {
  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "36px 24px 64px", maxWidth: 820 }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
          Destek
        </p>
        <h1 className="adb-headline" style={{ marginTop: 8 }}>
          İade & İptal Koşulları
        </h1>
        <div style={{ color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.7, display: "grid", gap: 14 }}>
          <p>
            Cayma hakkı, mesafeli satışta yasal süreler içinde kullanılabilir. Ambalajı açılmış, kurulumu yapılmış veya
            özel ölçü/isteğe göre hazırlanan ürünlerde istisnalar uygulanabilir.
          </p>
          <p>
            İptal ve iade taleplerinizi hesabınızdaki siparişler üzerinden veya müşteri hizmetleri kanallarımızdan
            iletebilirsiniz. Detaylı sözleşme metni için <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</Link>.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
