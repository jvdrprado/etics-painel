// Aparece na hora do clique (troca de aba ou de filtro) enquanto o servidor monta a página.
export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-accent-soft px-5 py-4 text-sm">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
        <span>Buscando os dados no Bitrix24. Normalmente leva 2 segundos; se o painel ficou muito tempo sem ser aberto, pode levar até 1 minuto.</span>
      </div>
      <div className="animate-pulse">
      <div className="h-3 w-40 rounded bg-surface-2" />
      <div className="mt-3 h-8 w-64 rounded bg-surface-2" />
      <div className="mt-8 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="h-64 rounded-2xl bg-surface" />
        <div className="h-64 rounded-2xl bg-surface" />
      </div>
      <div className="mt-4 h-72 rounded-2xl bg-surface" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="h-36 rounded-2xl bg-surface" />
        <div className="h-36 rounded-2xl bg-surface" />
        <div className="h-36 rounded-2xl bg-surface" />
      </div>
      </div>
    </div>
  );
}
