// Regras do funil da ETICS ("Funil de Vendas", categoria 1 do Bitrix). Ajuste aqui, não nas telas.

export const FUNIL = Number(process.env.BITRIX_FUNIL ?? 1);
/** Desde quando o painel lê o histórico de etapas e as atividades (base dos placares e das conversões). */
export const INICIO_HISTORICO = "2025-07-01"; // o Funil de Vendas começou em jul/2025

export type Grupo = "novo" | "cadencia" | "reuniao" | "proposta" | "contrato" | "ganho" | "perdido";

export const GRUPOS: { id: Grupo; nome: string; curto: string }[] = [
  { id: "novo", nome: "Novos leads", curto: "Novos" },
  { id: "cadencia", nome: "Em cadência", curto: "Cadência" },
  { id: "reuniao", nome: "Reunião", curto: "Reunião" },
  { id: "proposta", nome: "Propostas", curto: "Propostas" },
  { id: "contrato", nome: "Contratos", curto: "Contratos" },
  { id: "ganho", nome: "Venda ganha", curto: "Ganhas" },
  { id: "perdido", nome: "Venda perdida", curto: "Perdidas" },
];
export const nomeGrupo = (g: Grupo) => GRUPOS.find((x) => x.id === g)!.nome;
export const ordemGrupo = (g: Grupo) => GRUPOS.findIndex((x) => x.id === g);

/** Etapa → grupo pelo nome. Ganho e perdido vêm da semântica do Bitrix (S e F).
 *  Aguardando contato = novo; Whatsapp Template, 1º Contato, Sondagem e Diagnóstico = cadência;
 *  Análise / Reunião = reunião; Proposta Enviada (e FUs) = propostas; Elaborar/Enviar Contrato e Contrato enviado (e FU) = contratos. */
export function grupoDaEtapa(nome: string, semantica: "S" | "F" | null): Grupo {
  if (semantica === "S") return "ganho";
  if (semantica === "F") return "perdido";
  const n = nome.toLowerCase();
  if (/aguardando/.test(n)) return "novo";
  if (/contrato/.test(n)) return "contrato";
  if (/proposta/.test(n)) return "proposta";
  if (/reuni|an[aá]lise/.test(n)) return "reuniao";
  return "cadencia";
}

/** Etapas movidas por automação: entrar nelas não conta como 1º contato feito por pessoa. */
export const ETAPA_AUTOMATICA = /template/i;

/** Dias na mesma etapa até o negócio contar como "parado na cadência". */
export const PRAZO_ETAPA: Record<Grupo, number> = { novo: 0, cadencia: 2, reuniao: 3, proposta: 3, contrato: 3, ganho: 0, perdido: 0 };

/** Meta do 1º contato: sair de "Aguardando contato" em até 24 h úteis. */
export const SLA_PRIMEIRO_CONTATO_H = 24;
