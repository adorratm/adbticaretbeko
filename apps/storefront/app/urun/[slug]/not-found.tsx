import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>Ürün bulunamadı</h1>
      <p style={{ color: "#5c574f", marginBottom: 24 }}>
        Aradığınız ürün mevcut değil veya kaldırılmış olabilir.
      </p>
      <Link href="/" style={{ color: "#c45c26" }}>
        Mağazaya dön
      </Link>
    </main>
  );
}
