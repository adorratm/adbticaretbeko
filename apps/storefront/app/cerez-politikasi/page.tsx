import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function CerezPolitikasiPage() {
  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(28vh, 240px)" }}>
          <div
            className="adb-page-hero-media"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80)",
            }}
            aria-hidden
          />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#7dd3fc" }}>
              Yasal
            </p>
            <h1 style={{ margin: "6px 0 0", color: "#fff", fontFamily: "var(--adb-font-display)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 700 }}>
              Çerez Politikası
            </h1>
          </div>
        </section>
        <div className="adb-container adb-animate-in" style={{ padding: "36px 24px 72px", maxWidth: 860, color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.75, display: "grid", gap: 16 }}>
          <p>
            Bu politika, ADB Ticaret web sitesinde kullanılan çerezlerin türlerini, amaçlarını ve yönetim seçeneklerini açıklar.
          </p>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Çerez türleri</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <strong style={{ color: "var(--adb-on-surface)" }}>Zorunlu:</strong> oturum, sepet, güvenlik ve temel site işlevleri
            </li>
            <li>
              <strong style={{ color: "var(--adb-on-surface)" }}>İşlevsel:</strong> dil/şube tercihleri, form hatırlama
            </li>
            <li>
              <strong style={{ color: "var(--adb-on-surface)" }}>Analitik (opsiyonel):</strong> sayfa performansını ve kullanım istatistiklerini ölçme
            </li>
            <li>
              <strong style={{ color: "var(--adb-on-surface)" }}>Pazarlama (opsiyonel):</strong> kampanya kişiselleştirme — yalnızca onay ile
            </li>
          </ul>
          <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: 0 }}>Yönetim</h2>
          <p>
            İlk ziyarette çıkan bildirimden tercihlerinizi güncelleyebilirsiniz. Tarayıcı ayarlarından çerezleri silebilirsiniz;
            zorunlu çerezler olmadan sepet ve giriş düzgün çalışmayabilir.
          </p>
          <p>
            Kişisel veriler için <Link href="/kvkk">KVKK Aydınlatma Metni</Link>.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
