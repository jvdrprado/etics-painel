"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recarrega os dados da página (sem piscar) a cada `segundos`, enquanto a aba estiver visível. */
export function AutoRefresh({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
