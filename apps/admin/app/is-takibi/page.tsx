"use client";

import { Suspense } from "react";
import IsTakibiClient from "./is-takibi-client";

export default function IsTakibiPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Yukleniyor...</div>}>
      <IsTakibiClient />
    </Suspense>
  );
}
