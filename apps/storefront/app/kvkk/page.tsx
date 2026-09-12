import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

function LegalLayout({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(28vh, 240px)" }}>
          <div
            className="adb-page-hero-media"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80)",
            }}
            aria-hidden
          />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#7dd3fc" }}>
              {eyebrow}
            </p>
            <h1
              style={{
                margin: "6px 0 0",
                color: "#fff",
                fontFamily: "var(--adb-font-display)",
                fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                fontWeight: 700,
              }}
            >
              {title}
            </h1>
          </div>
        </section>
        <div className="adb-container adb-animate-in" style={{ padding: "36px 24px 72px", maxWidth: 860 }}>
          <div style={{ color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.75, display: "grid", gap: 16 }}>{children}</div>
          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/kvkk" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
              KVKK
            </Link>
            <Link href="/cerez-politikasi" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
              Çerez
            </Link>
            <Link href="/mesafeli-satis" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
              Mesafeli satış
            </Link>
            <Link href="/iade-iptal" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
              İade & iptal
            </Link>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}

export default function KvkkPage() {
  return (
    <LegalLayout eyebrow="Yasal · 6698 sayılı Kanun" title="KVKK Aydınlatma Metni">
      <p>
        <strong style={{ color: "var(--adb-on-surface)" }}>Veri sorumlusu:</strong> ADB Ticaret (Beko yetkili satıcısı).
        İşbu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) md. 10 uyarınca hazırlanmıştır.
      </p>
      <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: "8px 0 0" }}>
        İşlenen kişisel veriler
      </h2>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Kimlik: ad, soyad, TCKN (fatura gerektiğinde)</li>
        <li>İletişim: telefon, e-posta, teslimat/fatura adresi</li>
        <li>Müşteri işlem: sipariş, ödeme yöntemi (kart bilgisi saklanmaz; PSP üzerinden), takas/çeyiz talepleri</li>
        <li>İşlem güvenliği: IP, oturum ve çerez kayıtları</li>
      </ul>
      <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: "8px 0 0" }}>
        Amaçlar ve hukuki sebepler
      </h2>
      <p>
        Verileriniz; sözleşmenin kurulması/ifası, faturalama, stok-sevkiyat-montaj koordinasyonu, müşteri destek,
        yasal yükümlülükler, meşru menfaat kapsamında güvenlik ve dolandırıcılık önleme amaçlarıyla işlenir.
      </p>
      <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: "8px 0 0" }}>
        Aktarım
      </h2>
      <p>
        Gerekli ölçüde kargo/lojistik, yetkili servis (Beko / Arçelik A.Ş. ağı), ödeme kuruluşu, muhasebe ve bulut
        altyapı sağlayıcılarıyla paylaşılabilir. Yurt dışına aktarım yalnızca yeterli koruma ve açık rıza/uygun
        güvencelerle yapılır.
      </p>
      <h2 style={{ color: "var(--adb-on-surface)", fontFamily: "var(--adb-font-display)", fontSize: 20, margin: "8px 0 0" }}>
        Saklama ve haklarınız
      </h2>
      <p>
        Veriler, ilgili mevzuattaki zamanaşımı ve defter tutma süreleri boyunca saklanır; süre bitiminde silinir,
        yok edilir veya anonimleştirilir. KVKK md. 11 kapsamında bilgi talep etme, düzeltme, silme, itiraz ve
        Kişisel Verileri Koruma Kurulu’na başvuru haklarınız vardır. Başvurularınızı mağaza iletişim kanallarımızdan
        iletebilirsiniz.
      </p>
      <p>
        Çerez tercihleri için <Link href="/cerez-politikasi">Çerez Politikası</Link>, sözleşme için{" "}
        <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</Link> sayfalarını inceleyin.
      </p>
    </LegalLayout>
  );
}
