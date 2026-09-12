import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function IadeIptalPage() {
  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(28vh, 240px)" }}>
          <div
            className="adb-page-hero-media"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1600&q=80)",
            }}
            aria-hidden
          />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#7dd3fc" }}>
              Destek
            </p>
            <h1 style={{ margin: "6px 0 0", color: "#fff", fontFamily: "var(--adb-font-display)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 700 }}>
              İade & İptal Koşulları
            </h1>
          </div>
        </section>
        <div className="adb-container adb-animate-in" style={{ padding: "36px 24px 72px", maxWidth: 860, color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.75, display: "grid", gap: 16 }}>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Sipariş iptali</h2>
          <p>
            Ürün sevk edilmeden önce Hesabım → Siparişler üzerinden veya müşteri hizmetlerinden iptal talebi oluşturabilirsiniz.
            Ödeme iadesi, kullanılan yönteme göre 1–10 iş günü içinde yansır.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Cayma hakkı</h2>
          <p>
            Mesafeli satışta yasal süre içinde cayma hakkı kullanılabilir. Ürünün tekrar satılabilir durumda, orijinal
            ambalajında ve aksesuarlarıyla iade edilmesi gerekir.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>İstisnalar</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Kurulumu / montajı tamamlanmış beyaz eşya ve klimalar</li>
            <li>Ambalajı bozulmuş, hijyen koşulları bozulmuş ürünler</li>
            <li>Özel sipariş / ölçüye göre hazırlanan setler</li>
          </ul>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Nasıl başvurulur?</h2>
          <p>
            Hesabınızdaki sipariş detayından “İade talebi” veya mağaza WhatsApp / çağrı hattı. Detaylı sözleşme:{" "}
            <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</Link>.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
