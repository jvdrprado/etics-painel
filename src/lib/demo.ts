import "server-only";
import { ETAPA_AUTOMATICA, grupoDaEtapa, INICIO_HISTORICO, type Grupo } from "./config";
import type { AoVivo, Base, Deal, Etapa, Fup } from "./dados";
import { iso, ts } from "./periodo";

// Dados de exemplo enquanto o BITRIX_WEBHOOK não está configurado. As etapas são as do "Funil de Vendas" da ETICS;
// negócios, valores e pessoas são inventados (a tela avisa).

const ETAPAS = [
  "Aguardando contato", "Whatsapp Template Enviado", "1º Contato", "1º Contato - Tentativa 2", "1º Contato - Tentativa 3",
  "Sondagem: Coleta de Info", "Sondagem - Tentativa 1", "Sondagem - Tentativa 2", "Diagnóstico / Coleta de Informações",
  "Análise / Reunião", "Proposta Enviada", "Proposta Enviada FU 1", "Proposta Enviada FU 2",
  "Elaborar / Enviar Contrato", "Contrato enviado", "Contrato enviado FU 1", "Ganho", "Perdidos",
];
const PESSOAS = [{ id: 11, nome: "Vendedora Exemplo A" }, { id: 12, nome: "Vendedor Exemplo B" }];
const FONTES = ["Fale Fácil Chat - WhatsApp", "Formulário de CRM", "Meta Ads", "Por Indicação", "Advogado Parceiro"];
const MOTIVOS = ["Sem retorno do cliente", "Preço", "Fechou com outro perito", "Sem caso no momento", "Fora do perfil", "Lead duplicado"];
const NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Eliane", "Fábio", "Gisele", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sandra", "Thiago", "Vanessa", "Walter"];
const SOBRENOMES = ["Silva", "Souza", "Costa", "Pereira", "Almeida", "Ferraz", "Moura", "Rocha", "Prado", "Teixeira", "Lima", "Barros"];
const PERFIS = ["Advogado(a)", "Advogado(a) Criminalista", "Familiar", "Escritório"];

function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoBase(): Base {
  const agora = Math.floor(Date.now() / 1000);
  const r = aleatorio(Number(iso(agora).replaceAll("-", "")));
  const um = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const etapas: Etapa[] = ETAPAS.map((nome, i) => {
    const sem = nome === "Ganho" ? "S" : nome === "Perdidos" ? "F" : null;
    return { id: `C1:${i}`, nome, ordem: i, grupo: grupoDaEtapa(nome, sem), auto: ETAPA_AUTOMATICA.test(nome) };
  });
  const abertas = etapas.filter((e) => e.grupo !== "ganho" && e.grupo !== "perdido");
  const ganho = etapas.find((e) => e.grupo === "ganho")!;
  const perdido = etapas.find((e) => e.grupo === "perdido")!;
  const ini = ts(INICIO_HISTORICO);
  // Até onde o negócio chega no funil (índice em `abertas`), antes de ganhar ou perder.
  const alvo = () => { const x = r(); return x < 0.45 ? 4 + Math.floor(r() * 5) : x < 0.65 ? 9 : x < 0.8 ? 10 + Math.floor(r() * 3) : 13 + Math.floor(r() * 3); };

  const deals: Deal[] = [];
  const fupsAbertos: Fup[] = [];
  for (let i = 0; i < 620; i++) {
    const criado = Math.floor(agora - (agora - ini) * Math.pow(r(), 1.6));
    const p = um(PESSOAS);
    const nome = `${r() < 0.5 ? "Dr(a). " : ""}${um(NOMES)} ${um(SOBRENOMES)}`;
    const meta = alvo();
    const historia: { t: number; e: Etapa }[] = [{ t: criado, e: abertas[0] }];
    let tt = criado, k = 0;
    while (k < meta) {
      tt += Math.floor((k === 0 ? 0.05 + r() * 1.6 : 0.3 + r() * 4) * 86400);
      if (tt > agora) break;
      k++;
      historia.push({ t: tt, e: abertas[k] });
    }
    let fim = historia.at(-1)!;
    const idade = (agora - fim.t) / 86400;
    if (k === meta && k >= 13 && r() < 0.65 && idade > 2) historia.push((fim = { t: fim.t + Math.floor((1 + r() * 6) * 86400), e: ganho }));
    else if (idade > 12 && r() < 0.8) historia.push((fim = { t: Math.min(agora - 3600, fim.t + Math.floor((3 + r() * 10) * 86400)), e: perdido }));
    const e = fim.e;
    const entradas: Partial<Record<Grupo, number>> = {};
    for (const x of historia) entradas[x.e.grupo] ??= x.t;
    const valor = historia.some((x) => x.e.grupo === "proposta" || x.e.grupo === "contrato") ? Math.round(15 + r() * 105) * 1000 : 0;
    const final = e.grupo === "ganho" || e.grupo === "perdido";
    const id = 10000 + i;
    deals.push({
      id,
      titulo: `${nome} | ${um(PERFIS)} | ${um(["Meta Ads", "Google", "Site", "Indicação"])}`,
      link: `https://etics.bitrix24.com.br/crm/deal/details/${id}/`,
      etapaId: e.id,
      etapa: e.nome,
      ordem: e.ordem,
      grupo: e.grupo,
      valor,
      respId: p.id,
      resp: p.nome,
      fonte: um(FONTES),
      criado,
      movido: fim.t,
      ultimaAtividade: final ? fim.t : Math.min(agora, fim.t + Math.floor(r() * (agora - fim.t))),
      fechado: final ? fim.t : null,
      motivo: e.grupo === "perdido" ? (r() < 0.85 ? um(MOTIVOS) : null) : null,
      perdeuEm: e.grupo === "perdido" ? historia.at(-2)!.e.grupo : null,
      primeiroContato: historia.find((x) => x.e.grupo !== "novo" && !x.e.auto)?.t ?? null,
      entradas,
    });
    if (!final && e.grupo !== "novo" && r() < 0.75)
      fupsAbertos.push({ id: 90000 + i, deal: id, respId: p.id, vence: agora + Math.floor((-5 + r() * 8) * 86400), assunto: um(["Retornar contato", "Cobrar documentos", "Follow-up da proposta", "Confirmar reunião", "Enviar contrato"]), feito: false });
  }
  return { etapas, deals, fupsAbertos, pessoas: PESSOAS, campoMotivo: "UF_CRM_MOTIVO_PERDA", atualizado: agora, demo: true };
}

export function demoAoVivo(base: Base): AoVivo {
  const agora = Math.floor(Date.now() / 1000);
  const hoje = iso(agora);
  const r = aleatorio(Number(hoje.replaceAll("-", "")) + 7);
  const fupsHoje = base.fupsAbertos.filter((f) => iso(f.vence) === hoje);
  for (const [i, d] of base.deals.filter((d) => d.fechado == null).slice(0, 9).entries())
    fupsHoje.push({ id: 80000 + i, deal: d.id, respId: d.respId, vence: ts(hoje) + 10 * 3600 + i * 1800, assunto: "Follow-up", feito: true });
  return {
    presenca: [
      { ...base.pessoas[0], online: true, visto: agora - 120, expediente: "aberto", desde: ts(hoje) + 8 * 3600 + 12 * 60 },
      { ...base.pessoas[1], online: false, visto: agora - 3 * 3600, expediente: "fechado", desde: null },
    ],
    fupsHoje,
    acoesHoje: { [base.pessoas[0].id]: 14 + Math.floor(r() * 10), [base.pessoas[1].id]: Math.floor(r() * 6) },
    atualizado: agora,
  };
}
