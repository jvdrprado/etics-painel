"use client";

// Quando o Bitrix não responde (limite de requisições ou instabilidade), mostra isto em vez de uma tela de erro.
export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="font-display text-2xl font-bold">O Bitrix está demorando para responder</div>
      <p className="mt-3 text-sm text-muted">
        O painel lê o Bitrix24 pela API, que tem limite de consultas por segundo. Espere um minuto e tente de novo: os dados que já estavam carregados voltam na hora.
      </p>
      <button onClick={reset} className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Tentar de novo</button>
    </div>
  );
}
