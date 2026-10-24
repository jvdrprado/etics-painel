import { ordemGrupo, PRAZO_ETAPA, SLA_PRIMEIRO_CONTATO_H, type Grupo } from "./config";
import type { Base, Deal, Fup } from "./dados";
import { DIA, segundosUteis, ts } from "./periodo";

/** `x` (unix) cai entre os dias `de` e `ate` (AAAA-MM-DD, inclusive)? */
export const dentro = (x: number | null | undefined, de: string, ate: string) => x != null && x >= ts(de) && x < ts(ate) + DIA;

export const abertos = (b: Base) => b.deals.filter((d) => d.fechado == null);
export const doGrupo = (b: Base, g: Grupo) => b.deals.filter((d) => d.grupo === g);
/** Negócios que entraram no grupo pela 1ª vez no intervalo (cada negócio conta uma vez, mesmo indo e voltando). */
export const entraram = (b: Base, g: Grupo, de: string, ate: string) => b.deals.filter((d) => dentro(d.entradas[g], de, ate));
export const ganhos = (b: Base, de: string, ate: string) => b.deals.filter((d) => d.grupo === "ganho" && dentro(d.fechado, de, ate));
export const perdidos = (b: Base, de: string, ate: string) => b.deals.filter((d) => d.grupo === "perdido" && dentro(d.fechado, de, ate));
export const criados = (b: Base, de: string, ate: string) => b.deals.filter((d) => dentro(d.criado, de, ate));
export const somaValor = (ds: Deal[]) => ds.reduce((s, d) => s + d.valor, 0);

export type Placar = { leads: number; reunioes: number; propostas: number; contratos: number; ganhos: number; receita: number; perdidos: number };
export function placar(b: Base, de: string, ate: string): Placar {
  const g = ganhos(b, de, ate);
  return {
    leads: criados(b, de, ate).length,
    reunioes: entraram(b, "reuniao", de, ate).length,
    propostas: entraram(b, "proposta", de, ate).length,
    contratos: entraram(b, "contrato", de, ate).length,
    ganhos: g.length,
    receita: somaValor(g),
    perdidos: perdidos(b, de, ate).length,
  };
}

/** O negócio chegou ao grupo `g` ou além (pulando etapa conta; ganho conta como tendo passado por tudo). */
export const alcancou = (d: Deal, g: Grupo) =>
  d.grupo === "ganho" || Object.keys(d.entradas).some((x) => x !== "perdido" && ordemGrupo(x as Grupo) >= ordemGrupo(g));

/** Coorte: dos que entraram em `de` no intervalo, a fração que chegou a `para` (até hoje). */
export function conversao(b: Base, de: Grupo, para: Grupo, ini: string, fim: string) {
  const base = de === "novo" ? criados(b, ini, fim) : entraram(b, de, ini, fim);
  const ok = base.filter((d) => (para === "ganho" ? d.grupo === "ganho" : alcancou(d, para))).length;
  return { base: base.length, ok, v: base.length ? ok / base.length : null };
}

/** Último sinal de vida do negócio: última atividade ou entrada na etapa, o que for mais recente. */
export const ultimoToque = (d: Deal) => Math.max(d.movido, d.ultimaAtividade ?? 0);
/** Dias úteis desde o último toque. */
export const diasSemToque = (d: Deal, agora: number) => Math.floor(segundosUteis(ultimoToque(d), agora) / DIA);
export const diasNaEtapa = (d: Deal, agora: number) => Math.floor((agora - d.movido) / DIA);
/** Parado na cadência: mais dias úteis sem toque do que o prazo da etapa. */
export const parado = (d: Deal, agora: number) => d.fechado == null && d.grupo !== "novo" && diasSemToque(d, agora) > PRAZO_ETAPA[d.grupo];

/** FUPs abertos por negócio, do mais antigo para o mais novo. */
export function fupsPorDeal(b: Base) {
  const m = new Map<number, Fup[]>();
  for (const f of [...b.fupsAbertos].sort((x, y) => x.vence - y.vence)) {
    if (!m.has(f.deal)) m.set(f.deal, []);
    m.get(f.deal)!.push(f);
  }
  return m;
}
export const atrasado = (f: Fup, agora: number) => !f.feito && f.vence < agora;

/** 1º contato em horas úteis (sábado e domingo fora), ou null se ainda não saiu de "Aguardando contato". */
export const horasPrimeiroContato = (d: Deal) => (d.primeiroContato == null ? null : segundosUteis(d.criado, d.primeiroContato) / 3600);
export function primeiroContato(ds: Deal[], agora: number) {
  // Quem ainda está no prazo e sem contato fica fora da conta.
  const base = ds.filter((d) => d.primeiroContato != null || segundosUteis(d.criado, agora) / 3600 > SLA_PRIMEIRO_CONTATO_H);
  const horas = base.map(horasPrimeiroContato).filter((h): h is number => h != null).sort((a, b) => a - b);
  const noPrazo = horas.filter((h) => h <= SLA_PRIMEIRO_CONTATO_H).length;
  return { base: base.length, noPrazo, pct: base.length ? noPrazo / base.length : null, mediana: horas.length ? horas[Math.floor(horas.length / 2)] : null };
}

export function mediana(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Agrupa e conta, do maior para o menor. */
export function contar<T>(xs: T[], chave: (x: T) => string, valor: (x: T) => number = () => 0) {
  const m = new Map<string, { n: number; v: number }>();
  for (const x of xs) {
    const k = chave(x);
    const a = m.get(k) ?? { n: 0, v: 0 };
    a.n++;
    a.v += valor(x);
    m.set(k, a);
  }
  return [...m.entries()].map(([k, a]) => ({ k, ...a })).sort((a, b) => b.n - a.n || b.v - a.v);
}
