"use client";

import { useState } from "react";

/** Botão que copia um texto pronto (cobrança, pauta) para colar no WhatsApp. */
export function Copiar({ texto, rotulo = "Copiar", className = "" }: { texto: string; rotulo?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch {}
      }}
      className={`rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white ${className}`}
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}
