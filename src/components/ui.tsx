import Link from "next/link";

// Visual minimalista: superfícies sem borda, rótulos discretos, números em destaque.

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl bg-surface p-5 sm:p-6 ${className}`}>{children}</div>;
}
export const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{children}</div>
);
export const Big = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`tnum mt-1.5 text-[28px] font-semibold leading-tight ${className}`}>{children}</div>
);
export const Sub = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mt-1 text-[13px] text-muted ${className}`}>{children}</div>
);

/** Barra horizontal simples (0 a 1). */
export function Bar({ v, color = "var(--ink)" }: { v: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-line">
      <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} />
    </div>
  );
}

export const H2 = ({ children, sub, right }: { children: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-4 mt-12 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold">{children}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
    </div>
    {right}
  </div>
);

/** Variação contra o período anterior até o mesmo ponto. `inverso`: subir é ruim (perdas). */
export function Delta({ atual, antes, inverso }: { atual: number; antes: number; inverso?: boolean }) {
  if (!antes) return atual ? <span className="text-muted">sem base anterior</span> : null;
  const v = atual / antes - 1;
  const bom = inverso ? v <= 0 : v >= 0;
  return (
    <span className={bom ? "text-ok" : "text-bad"}>
      {v >= 0 ? "↑" : "↓"} {`${Math.abs(v * 100).toFixed(0)}%`}
    </span>
  );
}

export function PageHeader({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export const Pill = ({ children, tom }: { children: React.ReactNode; tom?: "bom" | "ruim" | "alerta" | "marca" }) => {
  const c =
    tom === "bom" ? "bg-ok/10 text-ok" : tom === "ruim" ? "bg-bad/10 text-bad" : tom === "alerta" ? "bg-warn/10 text-warn" : tom === "marca" ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-muted";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
};

export const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted ${right ? "text-right" : "text-left"}`}>{children}</th>
);
export const Td = ({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) => (
  <td className={`border-t border-line px-3 py-2.5 align-top ${right ? "tnum whitespace-nowrap text-right" : ""} ${className}`}>{children}</td>
);

/** Tabela com rolagem horizontal própria (a página nunca rola de lado). */
export const Tabela = ({ children, min = 640 }: { children: React.ReactNode; min?: number }) => (
  <div className="overflow-x-auto rounded-2xl bg-surface">
    <table className="w-full text-sm" style={{ minWidth: min }}>{children}</table>
  </div>
);

/** Nome do negócio com link para abrir no Bitrix. */
export const LinkDeal = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-medium underline decoration-line decoration-2 underline-offset-4 hover:decoration-accent">
    {children}
  </a>
);

/** Seletor de período por link (?p=). */
export function Seletor({ base, atual, opcoes, extra = {} }: { base: string; atual: string; opcoes: Record<string, string>; extra?: Record<string, string> }) {
  return (
    <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1">
      {Object.entries(opcoes).map(([k, rot]) => (
        <Link
          key={k}
          href={`${base}?${new URLSearchParams({ ...extra, p: k })}`}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${k === atual ? "bg-ink font-semibold text-white" : "text-muted hover:text-foreground"}`}
        >
          {rot}
        </Link>
      ))}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-surface px-5 py-8 text-center text-sm text-muted">{children}</div>;
}
