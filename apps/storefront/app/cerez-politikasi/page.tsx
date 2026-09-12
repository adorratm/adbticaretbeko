import Link from "next/link";
import { StorefrontShell } from "../../components/site-shell";

export default function CerezPolitikasiPage() {
  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "36px 24px 64px", maxWidth: 820 }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
          Yasal
        </p>
        <h1 className="adb-headline" style={{ marginTop: 8 }}>
          Çerez Politikası
        </h1>
        <div style={{ color: "var(--adb-muted)", fontSize: 15, lineHeight: 1.7, display: "grid", gap: 14 }}>
          <p>
            Sitemizde oturum, güvenlik ve temel işlevler için zorunlu çerezler; deneyim ölçümü için ise isteğe bağlı
            analitik çerezler kullanılabilir.
          </p>
          <p>
            Tercihinizi sayfa altındaki çerez bildirimi üzerinden yönetebilirsiniz. Zorunlu çerezler olmadan alışveriş
            sepeti ve giriş oturumu düzgün çalışmayabilir.
          </p>
          <p>
            Kişisel verilerin işlenmesi hakkında ayrıntılar için <Link href="/kvkk">KVKK Aydınlatma Metni</Link>’ne bakın.
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
