import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function KvkkPage() {
  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "36px 24px 64px", maxWidth: 820 }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
          Yasal
        </p>
        <h1 className="adb-headline" style={{ marginTop: 8 }}>
          KVKK Aydınlatma Metni
        </h1>
        <div style={{ color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.7, display: "grid", gap: 14 }}>
          <p>
            ADB Ticaret olarak 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerinizi; sipariş
            süreçleri, montaj/servis koordinasyonu, faturalama, müşteri destek ve yasal yükümlülüklerin yerine getirilmesi
            amaçlarıyla işleriz.
          </p>
          <p>
            Toplanan veriler (kimlik, iletişim, sipariş ve teslimat bilgileri) yalnızca yetkili personel ve hizmet
            sağlayıcılarla, sözleşmenin ifası ve meşru menfaat kapsamında paylaşılabilir.
          </p>
          <p>
            Haklarınız: bilgi talep etme, düzeltme, silme, işlemeyi kısıtlama ve Kişisel Verileri Koruma Kurulu’na başvuru.
            Talepleriniz için iletişim kanallarımızı kullanabilirsiniz.
          </p>
          <p>
            Ayrıca <Link href="/cerez-politikasi">Çerez Politikası</Link> ve{" "}
            <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</Link> sayfalarını inceleyebilirsiniz.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
