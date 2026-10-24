import "server-only";
import { unstable_cache } from "next/cache";
import { chamar, conectado, linkDeal, listar, lote, type BAtividade, type BCampo, type BDeal, type BEtapa, type BHistorico, type BUsuario } from "./bitrix";
import { ETAPA_AUTOMATICA, FUNIL, grupoDaEtapa, INICIO_HISTORICO, type Grupo } from "./config";
import { demoAoVivo, demoBase } from "./demo";
import { iso, soma } from "./periodo";

export type Etapa = { id: string; nome: string; ordem: number; grupo: Grupo; auto: boolean };

export type Deal = {
  id: number;
  titulo: string;
  link: string;
  etapaId: string;
  etapa: string;
  ordem: number;
  grupo: Grupo;
  valor: number;
  respId: number;
  resp: string;
  fonte: string;
  criado: number;
  movido: number; // entrou na etapa atual
  ultimaAtividade: number | null;
  fechado: number | null; // ganho ou perdido: quando entrou na etapa final
  motivo: string | null; // motivo de perda
  perdeuEm: Grupo | null; // grupo em que estava antes de ir para Perdidos
  primeiroContato: number | null; // saiu de "Aguardando contato" por ação de pessoa
  entradas: Partial<Record<Grupo, number>>; // 1ª entrada em cada grupo (dentro do histórico lido)
};

/** Atividade com prazo no Bitrix (tarefa, ligação, reunião, "a fazer"): o FUP. */
export type Fup = { id: number; deal: number; respId: number; vence: number; assunto: string; feito: boolean };

export type Base = {
  etapas: Etapa[];
  deals: Deal[];
  fupsAbertos: Fup[];
  pessoas: { id: number; nome: string }[];
  campoMotivo: string | null;
  atualizado: number;
  demo: boolean;
};

export type Presenca = { id: number; nome: string; online: boolean; visto: number | null; expediente: "aberto" | "pausa" | "fechado" | null; desde: number | null };
export type AoVivo = { presenca: Presenca[]; fupsHoje: Fup[]; acoesHoje: Record<number, number>; atualizado: number };

const t = (s?: string | null) => (s ? Math.floor(Date.parse(s) / 1000) : null);
const inicioDia = (d: string) => `${d}T00:00:00-03:00`;
/** Bitrix usa prazo vazio ou muito distante para atividade sem data. */
const prazoValido = (s: string | null) => !!s && Number(s.slice(0, 4)) < 2090;

/** Sem fonte no Bitrix, usa a origem que o formulário põe no fim do título ("Nome | Perfil | Meta Ads", "|google"). */
function fonteDoTitulo(titulo: string) {
  const fim = (titulo ?? "").split("|").at(-1)!.toLowerCase();
  if (/meta|facebook|instagram/.test(fim)) return "Meta Ads (pelo título)";
  if (/google/.test(fim)) return "Google (pelo título)";
  if (/whatsapp/i.test(titulo ?? "")) return "WhatsApp (pelo título)";
  return "Sem fonte";
}

const fup = (a: BAtividade): Fup => ({
  id: Number(a.ID), deal: Number(a.OWNER_ID), respId: Number(a.RESPONSIBLE_ID), vence: t(a.DEADLINE)!, assunto: a.SUBJECT || "Atividade", feito: a.COMPLETED === "Y",
});
const CAMPOS_ATIV = ["ID", "OWNER_ID", "RESPONSIBLE_ID", "AUTHOR_ID", "CREATED", "DEADLINE", "COMPLETED", "SUBJECT", "TYPE_ID", "PROVIDER_ID"];

async function lerBitrix(): Promise<Base> {
  const desde = inicioDia(INICIO_HISTORICO);
  const [etapasR, camposR, fontesR, usuarios] = await Promise.all([
    chamar<BEtapa[]>("crm.status.list", { filter: { ENTITY_ID: FUNIL ? `DEAL_STAGE_${FUNIL}` : "DEAL_STAGE" }, order: { SORT: "ASC" } }),
    chamar<Record<string, BCampo>>("crm.deal.fields"),
    chamar<BEtapa[]>("crm.status.list", { filter: { ENTITY_ID: "SOURCE" } }),
    listar<BUsuario>("user.get", { FILTER: { ACTIVE: true } }),
  ]);

  const etapas: Etapa[] = etapasR.result.map((e, i) => {
    const sem = e.SEMANTICS ?? (e.EXTRA?.SEMANTICS === "success" ? "S" : e.EXTRA?.SEMANTICS === "failure" ? "F" : null);
    const s = sem === "S" || /:WON$/.test(e.STATUS_ID) ? "S" : sem === "F" || /:LOSE$/.test(e.STATUS_ID) ? "F" : null;
    return { id: e.STATUS_ID, nome: e.NAME, ordem: i, grupo: grupoDaEtapa(e.NAME, s), auto: ETAPA_AUTOMATICA.test(e.NAME) };
  });
  const etapa = new Map(etapas.map((e) => [e.id, e]));
  const fontes = new Map(fontesR.result.map((f) => [f.STATUS_ID, f.NAME]));
  const nomes = new Map(usuarios.map((u) => [Number(u.ID), `${u.NAME ?? ""} ${u.LAST_NAME ?? ""}`.trim() || `Usuário ${u.ID}`]));

  // Motivo de perda: campos personalizados com "motivo" ou "perda" no nome (ou os de BITRIX_CAMPO_MOTIVO, separados por vírgula).
  // Na ETICS há dois "Motivo da perda?": a lista (usada primeiro) e um texto antigo (usado se a lista estiver vazia).
  const campos = camposR.result;
  const camposMotivo = process.env.BITRIX_CAMPO_MOTIVO
    ? process.env.BITRIX_CAMPO_MOTIVO.split(",").map((s) => s.trim())
    : Object.entries(campos)
        .filter(([k, c]) => k.startsWith("UF_") && /motivo|perd/i.test(`${c.title} ${c.formLabel} ${c.listLabel}`))
        .sort(([, a], [, b]) => Number(b.type === "enumeration") - Number(a.type === "enumeration"))
        .map(([k]) => k);
  const motivoDe = (d: BDeal) => {
    for (const campo of camposMotivo) {
      const opcoes = new Map((campos[campo]?.items ?? []).map((i) => [i.ID, i.VALUE]));
      const v = d[campo] as unknown;
      const vs = (Array.isArray(v) ? v : [v]).filter((x) => x != null && String(x).trim() !== "" && x !== false).map((x) => opcoes.get(String(x)) ?? String(x).trim());
      if (vs.length) return vs.join(", ");
    }
    return null;
  };
  const campoMotivo = camposMotivo[0] ?? null;

  // O Bitrix ignora o filtro de data do stagehistory; como o funil começou em jul/2025, lê tudo (uns 13 mil registros em batch).
  const select = ["ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "ASSIGNED_BY_ID", "SOURCE_ID", "DATE_CREATE", "MOVED_TIME", "LAST_ACTIVITY_TIME", "CLOSED", ...camposMotivo];
  const [abertos, fechados, historico, ativAbertas] = await Promise.all([
    listar<BDeal>("crm.deal.list", { filter: { CATEGORY_ID: FUNIL, CLOSED: "N" }, select, order: { ID: "ASC" } }),
    listar<BDeal>("crm.deal.list", { filter: { CATEGORY_ID: FUNIL, CLOSED: "Y", ">=DATE_MODIFY": desde }, select, order: { ID: "ASC" } }),
    listar<BHistorico>(
      "crm.stagehistory.list",
      { entityTypeId: 2, filter: { CATEGORY_ID: FUNIL }, select: ["OWNER_ID", "STAGE_ID", "CREATED_TIME", "TYPE_ID"], order: { ID: "ASC" } },
      (r) => (r as { items?: BHistorico[] } | null)?.items ?? [],
    ),
    listar<BAtividade>("crm.activity.list", { filter: { OWNER_TYPE_ID: 2, COMPLETED: "N" }, select: CAMPOS_ATIV, order: { ID: "ASC" } }),
  ]);

  // Histórico por negócio, em ordem.
  const hist = new Map<number, { t: number; etapa: Etapa }[]>();
  for (const h of historico) {
    const e = etapa.get(h.STAGE_ID);
    if (!e) continue;
    const id = Number(h.OWNER_ID);
    if (!hist.has(id)) hist.set(id, []);
    hist.get(id)!.push({ t: t(h.CREATED_TIME)!, etapa: e });
  }
  for (const l of hist.values()) l.sort((a, b) => a.t - b.t);

  const deals: Deal[] = [];
  for (const d of [...abertos, ...fechados]) {
    const e = etapa.get(d.STAGE_ID);
    if (!e) continue;
    const id = Number(d.ID);
    const h = hist.get(id) ?? [];
    const criado = t(d.DATE_CREATE)!;
    const movido = t(d.MOVED_TIME) ?? h.at(-1)?.t ?? criado;
    const entradas: Partial<Record<Grupo, number>> = {};
    for (const x of h) entradas[x.etapa.grupo] ??= x.t;
    entradas[e.grupo] ??= movido;
    const final = e.grupo === "ganho" || e.grupo === "perdido";
    const antesDaPerda = e.grupo === "perdido" ? h.filter((x) => x.etapa.grupo !== "perdido").at(-1) : undefined;
    deals.push({
      id,
      titulo: d.TITLE || `Negócio ${id}`,
      link: linkDeal(id),
      etapaId: e.id,
      etapa: e.nome,
      ordem: e.ordem,
      grupo: e.grupo,
      valor: Number(d.OPPORTUNITY) || 0,
      respId: Number(d.ASSIGNED_BY_ID),
      resp: nomes.get(Number(d.ASSIGNED_BY_ID)) ?? "Sem responsável",
      fonte: (d.SOURCE_ID && fontes.get(d.SOURCE_ID)) || fonteDoTitulo(d.TITLE),
      criado,
      movido,
      ultimaAtividade: t(d.LAST_ACTIVITY_TIME),
      fechado: final ? movido : null,
      motivo: e.grupo === "perdido" ? motivoDe(d) : null,
      perdeuEm: antesDaPerda?.etapa.grupo ?? null,
      primeiroContato: h.find((x) => x.t > criado + 60 && x.etapa.grupo !== "novo" && !x.etapa.auto)?.t ?? null,
      entradas,
    });
  }

  const ids = new Set(deals.map((d) => d.id));
  const fupsAbertos = ativAbertas.filter((a) => prazoValido(a.DEADLINE) && ids.has(Number(a.OWNER_ID))).map(fup);
  // Time = quem tem negócio aberto ou fechou algo nos últimos 120 dias (some quem saiu do comercial).
  const corte = Date.now() / 1000 - 120 * 86400;
  const naBase = new Set(deals.filter((d) => d.fechado == null || d.fechado >= corte).map((d) => d.respId));
  const pessoas = [...naBase].map((id) => ({ id, nome: nomes.get(id) ?? `Usuário ${id}` })).sort((a, b) => a.nome.localeCompare(b.nome));
  return { etapas, deals, fupsAbertos, pessoas, campoMotivo, atualizado: Math.floor(Date.now() / 1000), demo: false };
}

/** Base completa (negócios, histórico, FUPs abertos) com cache de 5 min. */
export const carregar: () => Promise<Base> = conectado
  ? unstable_cache(lerBitrix, ["etics-base-v3"], { revalidate: 300 })
  : async () => demoBase();

async function lerAoVivo(): Promise<AoVivo> {
  const base = await carregar();
  const hoje = iso(Date.now() / 1000);
  const [fupsHoje, criadasHoje] = await Promise.all([
    listar<BAtividade>("crm.activity.list", {
      filter: { OWNER_TYPE_ID: 2, ">=DEADLINE": inicioDia(hoje), "<DEADLINE": inicioDia(soma(hoje, 1)) },
      select: CAMPOS_ATIV,
      order: { ID: "ASC" },
    }),
    listar<BAtividade>("crm.activity.list", { filter: { OWNER_TYPE_ID: 2, ">=CREATED": inicioDia(hoje) }, select: ["ID", "AUTHOR_ID"], order: { ID: "ASC" } }),
  ]);
  const acoesHoje: Record<number, number> = {};
  for (const a of criadasHoje) acoesHoje[Number(a.AUTHOR_ID)] = (acoesHoje[Number(a.AUTHOR_ID)] ?? 0) + 1;

  // Presença: online/último acesso (user.get) e expediente do ponto do Bitrix (timeman.status, se o webhook tiver a permissão).
  const ids = base.pessoas.map((p) => p.id);
  const [usuarios, ponto] = await Promise.all([
    chamar<BUsuario[]>("user.get", { FILTER: { ID: ids } }).then((r) => r.result).catch(() => [] as BUsuario[]),
    lote(Object.fromEntries(ids.map((id) => [`u${id}`, ["timeman.status", { USER_ID: id }] as [string, object]]))).catch(() => ({}) as Record<string, unknown>),
  ]);
  const u = new Map(usuarios.map((x) => [Number(x.ID), x]));
  const presenca: Presenca[] = base.pessoas.map((p) => {
    const x = u.get(p.id);
    const tm = (ponto as Record<string, { STATUS?: string; TIME_START?: string } | null>)[`u${p.id}`];
    const st = tm?.STATUS;
    return {
      ...p,
      online: x?.IS_ONLINE === "Y",
      visto: t(x?.LAST_ACTIVITY_DATE),
      expediente: st === "OPENED" ? "aberto" : st === "PAUSED" ? "pausa" : st === "CLOSED" || st === "EXPIRED" ? "fechado" : null,
      desde: st === "OPENED" || st === "PAUSED" ? t(tm?.TIME_START) : null,
    };
  });
  return { presenca, fupsHoje: fupsHoje.filter((a) => prazoValido(a.DEADLINE)).map(fup), acoesHoje, atualizado: Math.floor(Date.now() / 1000) };
}

/** Leitura leve do dia (presença, FUPs de hoje, ações de hoje) com cache de 60 s. */
export const aoVivo: () => Promise<AoVivo> = conectado
  ? unstable_cache(lerAoVivo, ["etics-aovivo-v1"], { revalidate: 60 })
  : async () => demoAoVivo(await carregar());
