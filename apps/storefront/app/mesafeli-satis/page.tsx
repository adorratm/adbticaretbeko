import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function MesafeliSatisPage() {
  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(28vh, 240px)" }}>
          <div
            className="adb-page-hero-media"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80)",
            }}
            aria-hidden
          />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#7dd3fc" }}>
              Yasal
            </p>
            <h1 style={{ margin: "6px 0 0", color: "#fff", fontFamily: "var(--adb-font-display)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 700 }}>
              Mesafeli Satış Sözleşmesi
            </h1>
          </div>
        </section>
        <div className="adb-container adb-animate-in" style={{ padding: "36px 24px 72px", maxWidth: 860, color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.75, display: "grid", gap: 16 }}>
          <p>
            Bu sözleşme, ADB Ticaret (“Satıcı”) ile elektronik ortamda sipariş veren “Alıcı” arasında, 6502 sayılı Kanun ve
            Mesafeli Sözleşmeler Yönetmeliği hükümlerine uygun olarak kurulur.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Konu</h2>
          <p>
            Satıcının internet sitesinde yer alan ürünlerin satışı, teslimatı ve varsa yetkili servis montajı ile ilgili
            hak ve yükümlülükler.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Sipariş ve ödeme</h2>
          <p>
            Alıcı, ürün özellikleri, fiyat (KDV dahil), teslimat/montaj ve ödeme bilgilerini sipariş özeti ekranında
            onaylamadan önce görür. Ödeme; kart, havale veya kapıda ödeme seçenekleriyle tamamlanabilir.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Teslimat ve montaj</h2>
          <p>
            Ürünler stok durumuna göre aynı gün veya planlı sevk edilir. Beyaz eşya/klima gibi ürünlerde ücretsiz yetkili
            servis montajı kampanya koşullarına göre dahildir; servis randevusu SMS ile bildirilir.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Cayma</h2>
          <p>
            Cayma ve iade koşulları için <Link href="/iade-iptal">İade & İptal</Link> sayfasını inceleyiniz. Ambalajı
            açılmış, kurulumu yapılmış ürünlerde yasal istisnalar uygulanabilir.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
