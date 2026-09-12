import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function MesafeliSatisPage() {
  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "36px 24px 64px", maxWidth: 820 }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
          Yasal
        </p>
        <h1 className="adb-headline" style={{ marginTop: 8 }}>
          Mesafeli Satış Sözleşmesi
        </h1>
        <div style={{ color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.7, display: "grid", gap: 14 }}>
          <p>
            Bu sözleşme, ADB Ticaret (satıcı) ile elektronik ortamda sipariş veren alıcı arasında, 6502 sayılı Kanun ve
            Mesafeli Sözleşmeler Yönetmeliği hükümlerine uygun olarak kurulur.
          </p>
          <p>
            Ürün özellikleri, fiyat, teslimat/montaj koşulları ve ödeme bilgileri sipariş özeti ekranında onaylanmadan
            önce alıcıya sunulur. Cayma ve iade koşulları için <Link href="/iade-iptal">İade & İptal</Link> sayfasını
            inceleyiniz.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
