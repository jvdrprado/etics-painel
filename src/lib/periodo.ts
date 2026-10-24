
// Datas no fuso de São Paulo, como texto AAAA-MM-DD (evita surpresa de fuso no servidor da Vercel).
export const TZ = "America/Sao_Paulo";
export const DIA = 86400;
export const iso = (t: number) => new Date(t * 1000).toLocaleDateString("sv-SE", { timeZone: TZ });
export const ts = (d: string) => new Date(d + "T00:00:00-03:00").getTime() / 1000;
export const dow = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();
export const soma = (d: string, n: number) => new Date(new Date(d + "T12:00:00Z").getTime() + n * DIA * 1000).toISOString().slice(0, 10);
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const ehUtil = (d: string) => dow(d) !== 0 && dow(d) !== 6;

export function diasUteis(de: string, ate: string) {
  let n = 0;
  for (let d = de; d <= ate; d = soma(d, 1)) if (ehUtil(d)) n++;
  return n;
}
export const segunda = (d: string) => soma(d, -((dow(d) + 6) % 7));
export const inicioMes = (d: string) => d.slice(0, 8) + "01";
export function fimMes(d: string) {
  const [a, m] = d.split("-").map(Number);
  return soma(m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`, -1);
}
/** Trimestre e semestre do calendário (o ciclo jul–jun cai certinho neles). */
export const inicioTri = (d: string) => `${d.slice(0, 4)}-${String(Math.floor((Number(d.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
export const inicioSem = (d: string) => `${d.slice(0, 4)}-${Number(d.slice(5, 7)) <= 6 ? "01" : "07"}-01`;
const mesesDepois = (d: string, n: number) => {
  const [a, m] = d.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
};

export type Periodo = "dia" | "semana" | "mes" | "tri" | "sem";
export const PERIODOS: Record<Periodo, string> = { dia: "Dia", semana: "Semana", mes: "Mês", tri: "Trimestre", sem: "Semestre" };
export const NOME_ANTERIOR: Record<Periodo, string> = { dia: "ontem", semana: "semana passada", mes: "mês passado", tri: "trimestre passado", sem: "semestre passado" };

/** Período corrente até hoje e o anterior até o mesmo ponto (comparação justa) e inteiro. */
export function janela(p: Periodo, hoje: string) {
  const [de, fim, ant] =
    p === "dia" ? [hoje, hoje, soma(hoje, -1)]
    : p === "semana" ? [segunda(hoje), soma(segunda(hoje), 6), soma(segunda(hoje), -7)]
    : p === "mes" ? [inicioMes(hoje), fimMes(hoje), mesesDepois(inicioMes(hoje), -1)]
    : p === "tri" ? [inicioTri(hoje), soma(mesesDepois(inicioTri(hoje), 3), -1), mesesDepois(inicioTri(hoje), -3)]
    : [inicioSem(hoje), soma(mesesDepois(inicioSem(hoje), 6), -1), mesesDepois(inicioSem(hoje), -6)];
  const decorridos = Math.round((ts(hoje) - ts(de)) / DIA);
  const antFim = soma(de, -1);
  return { de, ate: hoje, fim, antDe: ant, antMesmoPonto: soma(ant, decorridos) > antFim ? antFim : soma(ant, decorridos), antFim };
}

/** Baldes para a evolução: os últimos N dias, semanas, meses, trimestres ou semestres até hoje. */
export function baldes(p: Periodo, hoje: string, desde: string): { rot: string; de: string; ate: string }[] {
  const cap = (d: string) => (d > hoje ? hoje : d);
  if (p === "dia") return Array.from({ length: 30 }, (_, i) => soma(hoje, i - 29)).map((d) => ({ rot: ddmm(d), de: d, ate: d }));
  if (p === "semana") return Array.from({ length: 12 }, (_, i) => soma(segunda(hoje), -7 * (11 - i))).map((s) => ({ rot: ddmm(s), de: s, ate: cap(soma(s, 6)) }));
  const passo = p === "mes" ? 1 : p === "tri" ? 3 : 6;
  const ini = p === "mes" ? inicioMes(desde) : p === "tri" ? inicioTri(desde) : inicioSem(desde);
  const out: { rot: string; de: string; ate: string }[] = [];
  for (let m = ini; m <= hoje; m = mesesDepois(m, passo)) {
    const mm = Number(m.slice(5, 7)), aa = m.slice(2, 4);
    const rot = p === "mes" ? `${m.slice(5, 7)}/${aa}` : p === "tri" ? `T${Math.floor((mm - 1) / 3) + 1}/${aa}` : `S${mm <= 6 ? 1 : 2}/${aa}`;
    out.push({ rot, de: m, ate: cap(soma(mesesDepois(m, passo), -1)) });
  }
  return out;
}


/** Segundos entre `de` e `ate` (unix, s) sem contar sábado e domingo (dias no horário de Brasília, UTC-3).
 *  Lead que entra no fim de semana começa a contar na segunda 0h. */
export function segundosUteis(de: number, ate: number) {
  const BRT = 3 * 3600;
  let t = de, total = 0;
  while (t < ate) {
    const fimDia = Math.floor((t - BRT) / 86400) * 86400 + 86400 + BRT; // próxima meia-noite de Brasília
    const ate2 = Math.min(ate, fimDia);
    const sem = new Date((t - BRT) * 1000).getUTCDay();
    if (sem !== 0 && sem !== 6) total += ate2 - t;
    t = ate2;
  }
  return total;
}

/** Agora, em segundos unix (fora do componente, para a regra de pureza do React). */
export const agoraUnix = () => Math.floor(Date.now() / 1000);
