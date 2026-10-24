const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const br1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const money = (v: number | null | undefined) => (v == null ? "-" : brl0.format(v));
export const money2 = (v: number | null | undefined) => (v == null ? "-" : brl2.format(v));
/** R$ compacto, no padrão do comercial: R$ 1,6MM · R$ 350k · abaixo de R$ 10 mil, o valor exato (R$ 1.050). */
export const moneyK = (v: number | null | undefined) => {
  if (v == null) return "-";
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${br1.format(v / 1e6).replace(/,0$/, "")}MM`;
  if (a >= 1e4) return `R$ ${brInt.format(Math.round(v / 1e3))}k`;
  return brl0.format(v);
};
export const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? "-" : `${br1.format(v * 100)}%`);
export const int = (v: number | null | undefined) => (v == null ? "-" : brInt.format(v));
export const vezes = (v: number) => `${br1.format(v)}x`;
export const data = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
export const dataHora = (ts: number) =>
  new Date(ts * 1000).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const primeiroNome = (n: string) => n.split(" ")[0];
/** Tempo decorrido curto: 45 min, 3 h, 2 d. */
export const tempo = (seg: number) => {
  const m = Math.max(0, Math.round(seg / 60));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
};
export const horaMin = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
