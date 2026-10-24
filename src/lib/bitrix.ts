import "server-only";

// Cliente da API REST do Bitrix24 por webhook de entrada. Só roda no servidor: o webhook é a chave de acesso.
// BITRIX_WEBHOOK = https://etics.bitrix24.com.br/rest/<usuário>/<código>/

const HOOK = (process.env.BITRIX_WEBHOOK ?? "").replace(/\/*$/, "/");
export const conectado = !!process.env.BITRIX_WEBHOOK;
export const PORTAL = conectado ? new URL(HOOK).origin : "https://etics.bitrix24.com.br";
export const linkDeal = (id: number) => `${PORTAL}/crm/deal/details/${id}/`;

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// Fila global: no máximo 2 chamadas ao mesmo tempo e uma nova a cada 550 ms (o Bitrix libera 2 req/s).
// O volume vem do método batch, que junta até 50 chamadas numa só.
let emAndamento = 0;
let proximaSaida = 0;
const espera: (() => void)[] = [];
async function vez() {
  while (emAndamento >= 2) await new Promise<void>((ok) => espera.push(ok));
  emAndamento++;
  const agora = Date.now();
  const sair = Math.max(agora, proximaSaida);
  proximaSaida = sair + 550;
  if (sair > agora) await dormir(sair - agora);
}
function liberar() {
  emAndamento--;
  espera.shift()?.();
}

type Resposta<T> = { result: T; next?: number; total?: number; error?: string; error_description?: string };

export async function chamar<T>(metodo: string, params: object = {}): Promise<Resposta<T>> {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    await vez();
    let r: Response;
    try {
      r = await fetch(`${HOOK}${metodo}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(params),
        cache: "no-store", // o cache fica no conjunto já calculado (dados.ts)
      });
    } catch {
      await dormir(Math.min(30000, 1500 * 2 ** tentativa));
      continue;
    } finally {
      liberar();
    }
    const j = (await r.json().catch(() => null)) as Resposta<T> | null;
    if (r.status === 503 || r.status >= 500 || j?.error === "QUERY_LIMIT_EXCEEDED") {
      await dormir(Math.min(30000, 1500 * 2 ** tentativa)); // limite de requisições ou instabilidade
      continue;
    }
    if (r.status === 401 || j?.error === "expired_token" || j?.error === "invalid_token")
      throw new Error("Webhook do Bitrix inválido ou revogado (BITRIX_WEBHOOK).");
    if (j?.error) throw new Error(`Bitrix: ${j.error} em ${metodo}${j.error_description ? ` (${j.error_description})` : ""}`);
    if (!r.ok || !j) throw new Error(`Bitrix ${r.status} em ${metodo}`);
    return j;
  }
  throw new Error(`Bitrix não respondeu depois de 8 tentativas (${metodo}).`);
}

/** Parâmetros no formato de query string do PHP (filter[>=DATE]=...&select[0]=ID), usado dentro do batch. */
function qs(o: unknown, prefixo = ""): string[] {
  if (o == null) return [];
  if (typeof o !== "object") return [`${prefixo}=${encodeURIComponent(String(o))}`];
  return Object.entries(o).flatMap(([k, v]) => qs(v, prefixo ? `${prefixo}[${encodeURIComponent(k)}]` : encodeURIComponent(k)));
}

type Lote = { result: Record<string, unknown>; result_error: Record<string, { error_description?: string }> | unknown[] };

/** Várias chamadas de uma vez (até 50 por batch). Devolve o resultado de cada chave; chave com erro volta null. */
export async function lote(cmds: Record<string, [string, object]>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const chaves = Object.keys(cmds);
  for (let i = 0; i < chaves.length; i += 50) {
    const cmd = Object.fromEntries(chaves.slice(i, i + 50).map((k) => [k, `${cmds[k][0]}?${qs(cmds[k][1]).join("&")}`]));
    const b = await chamar<Lote>("batch", { halt: 0, cmd });
    for (const k of chaves.slice(i, i + 50)) out[k] = (b.result.result as Record<string, unknown>)?.[k] ?? null;
  }
  return out;
}

/** Lê todas as páginas de um método .list: a 1ª diz o total, as demais vêm em batch de 50 páginas (2.500 itens por chamada). */
export async function listar<T>(metodo: string, params: object, itens: (r: unknown) => T[] = (r) => (r as T[]) ?? []): Promise<T[]> {
  const p1 = await chamar<unknown>(metodo, { ...params, start: 0 });
  const out = itens(p1.result);
  const total = p1.total ?? out.length;
  const inicios: number[] = [];
  for (let s = 50; s < total; s += 50) inicios.push(s);
  if (!inicios.length) return out;
  const r = await lote(Object.fromEntries(inicios.map((s) => [`p${s}`, [metodo, { ...params, start: s }] as [string, object]])));
  for (const s of inicios) out.push(...itens(r[`p${s}`]));
  return out;
}

// Tipos do que o painel lê (só os campos usados).
export type BEtapa = { STATUS_ID: string; NAME: string; SORT: string; SEMANTICS?: string | null; EXTRA?: { SEMANTICS?: string } };
export type BDeal = Record<string, string | null> & {
  ID: string; TITLE: string; STAGE_ID: string; OPPORTUNITY: string; ASSIGNED_BY_ID: string; SOURCE_ID: string | null;
  DATE_CREATE: string; MOVED_TIME: string | null; LAST_ACTIVITY_TIME: string | null; CLOSED: "Y" | "N";
};
export type BHistorico = { OWNER_ID: string; STAGE_ID: string; CREATED_TIME: string; TYPE_ID: string };
export type BAtividade = {
  ID: string; OWNER_ID: string; RESPONSIBLE_ID: string; AUTHOR_ID: string; CREATED: string; DEADLINE: string | null;
  COMPLETED: "Y" | "N"; SUBJECT: string; TYPE_ID: string; PROVIDER_ID: string; DIRECTION: string;
};
export type BUsuario = { ID: string; NAME: string; LAST_NAME: string; IS_ONLINE?: "Y" | "N"; LAST_ACTIVITY_DATE?: string };
export type BCampo = { type: string; title?: string; formLabel?: string; listLabel?: string; items?: { ID: string; VALUE: string }[] };
