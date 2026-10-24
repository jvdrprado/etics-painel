import { Bar, Big, Card, Delta, H2, Label, PageHeader, Seletor, Sub, Tabela, Td, Th, Vazio } from "@/components/ui";
import { contar, conversao, criados, ganhos, mediana, perdidos, placar, type Placar } from "@/lib/calc";
import { INICIO_HISTORICO, nomeGrupo } from "@/lib/config";
import { carregar } from "@/lib/dados";
import { int, moneyK, pct } from "@/lib/fmt";
import { agoraUnix, baldes, iso, janela, NOME_ANTERIOR, type Periodo } from "@/lib/periodo";

const OPCOES = { semana: "Semana", mes: "Mês", tri: "Trimestre", sem: "Semestre" };
const NOME_P: Record<string, string> = { semana: "na semana", mes: "no mês", tri: "no trimestre", sem: "no semestre" };

const ITENS: { k: keyof Placar; rot: string; dinheiro?: boolean; inverso?: boolean }[] = [
  { k: "leads", rot: "Leads novos" },
  { k: "reunioes", rot: "Chegaram a reunião" },
  { k: "propostas", rot: "Propostas enviadas" },
  { k: "contratos", rot: "Contratos" },
  { k: "receita", rot: "Vendido", dinheiro: true },
  { k: "perdidos", rot: "Vendas perdidas", inverso: true },
];

/** Lista com barra: rótulo, quantidade, participação e (opcional) valor. */
function Ranking({ itens, total, valor }: { itens: { k: string; n: number; v: number }[]; total: number; valor?: boolean }) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  return (
    <div className="space-y-3">
      {itens.map((i) => (
        <div key={i.k}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.k}</span>
            <span className="tnum shrink-0">
              <b>{int(i.n)}</b> <span className="text-muted">· {pct(i.n / Math.max(1, total))}{valor && i.v ? ` · ${moneyK(i.v)}` : ""}</span>
            </span>
          </div>
          <div className="mt-1.5"><Bar v={i.n / max} /></div>
        </div>
      ))}
    </div>
  );
}

export default async function Macros({ searchParams }: PageProps<"/p/[token]/macros">) {
  const sp = await searchParams;
  const p = (typeof sp.p === "string" && sp.p in OPCOES ? sp.p : "mes") as Periodo;
  const b = await carregar();
  const agora = agoraUnix();
  const hoje = iso(agora);
  const j = janela(p, hoje);
  const atual = placar(b, j.de, j.ate);
  const antes = placar(b, j.antDe, j.antMesmoPonto);
  const vendas = ganhos(b, j.de, j.ate);
  const perdas = perdidos(b, j.de, j.ate);
  const leads = criados(b, j.de, j.ate);
  const ticket = vendas.length ? atual.receita / vendas.length : null;
  const ciclo = mediana(vendas.map((d) => (d.fechado! - d.criado) / 86400));

  const conv = [
    { rot: "Lead → reunião", ...conversao(b, "novo", "reuniao", j.de, j.ate) },
    { rot: "Reunião → proposta", ...conversao(b, "reuniao", "proposta", j.de, j.ate) },
    { rot: "Proposta → contrato", ...conversao(b, "proposta", "contrato", j.de, j.ate) },
    { rot: "Contrato → venda", ...conversao(b, "contrato", "ganho", j.de, j.ate) },
  ];

  const evolucao = baldes(p, hoje, INICIO_HISTORICO).map((x) => ({ ...x, ...placar(b, x.de, x.ate) }));
  const maxReceita = Math.max(1, ...evolucao.map((e) => e.receita));

  const motivos = contar(perdas, (d) => d.motivo ?? "Sem motivo preenchido");
  const ondePerdeu = contar(perdas, (d) => (d.perdeuEm ? nomeGrupo(d.perdeuEm) : "Sem histórico da etapa"));
  const fontesLeads = contar(leads, (d) => d.fonte);
  const vendasFonte = new Map(contar(vendas, (d) => d.fonte, (d) => d.valor).map((x) => [x.k, x]));
  const porPessoa = contar(vendas, (d) => d.resp, (d) => d.valor).sort((a, c) => c.v - a.v);

  return (
    <div>
      <PageHeader kicker="Macros" title="Resultado e conversão" right={<Seletor base="" atual={p} opcoes={OPCOES} />} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {ITENS.map((i) => (
          <Card key={i.k}>
            <Label>{i.rot} {NOME_P[p]}</Label>
            <Big>{i.dinheiro ? moneyK(atual[i.k]) : int(atual[i.k])}</Big>
            <Sub>
              <Delta atual={atual[i.k]} antes={antes[i.k]} inverso={i.inverso} /> <span>vs {NOME_ANTERIOR[p]} ({i.dinheiro ? moneyK(antes[i.k]) : int(antes[i.k])})</span>
              {i.k === "receita" && <span className="block">{int(atual.ganhos)} vendas</span>}
            </Sub>
          </Card>
        ))}
      </div>

      <H2 sub={`Dos negócios que entraram em cada fase ${NOME_P[p]}, quantos já chegaram à seguinte (pular etapa conta como passar). O período recente ainda está amadurecendo.`}>Conversão</H2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {conv.map((c) => (
          <Card key={c.rot}>
            <Label>{c.rot}</Label>
            <Big>{pct(c.v)}</Big>
            <Sub>{int(c.ok)} de {int(c.base)}</Sub>
          </Card>
        ))}
        <Card>
          <Label>Ticket médio</Label>
          <Big>{moneyK(ticket)}</Big>
          <Sub>das vendas ganhas {NOME_P[p]}</Sub>
        </Card>
        <Card>
          <Label>Ciclo de venda</Label>
          <Big>{ciclo == null ? "-" : `${Math.round(ciclo)} d`}</Big>
          <Sub>mediana do lead criado até o ganho</Sub>
        </Card>
      </div>

      <H2 sub={`Desde ${INICIO_HISTORICO.split("-").reverse().join("/")}, por ${OPCOES[p as keyof typeof OPCOES].toLowerCase()}.`}>Evolução</H2>
      <Tabela min={860}>
        <thead>
          <tr><Th>Período</Th><Th right>Leads</Th><Th right>Reuniões</Th><Th right>Propostas</Th><Th right>Contratos</Th><Th right>Vendas</Th><Th>Vendido</Th><Th right>Perdidas</Th></tr>
        </thead>
        <tbody>
          {[...evolucao].reverse().map((e) => (
            <tr key={e.de}>
              <Td className="whitespace-nowrap font-medium">{e.rot}</Td>
              <Td right>{int(e.leads)}</Td>
              <Td right>{int(e.reunioes)}</Td>
              <Td right>{int(e.propostas)}</Td>
              <Td right>{int(e.contratos)}</Td>
              <Td right>{int(e.ganhos)}</Td>
              <Td className="w-[28%]">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><Bar v={e.receita / maxReceita} color="var(--accent)" /></div>
                  <span className="tnum w-20 text-right font-semibold">{moneyK(e.receita)}</span>
                </div>
              </Td>
              <Td right className="text-muted">{int(e.perdidos)}</Td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <H2 sub={`${int(perdas.length)} negócios foram para Perdidos ${NOME_P[p]}.`}>Motivos de perda</H2>
      {perdas.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <Label>Por motivo</Label>
            <div className="mt-4"><Ranking itens={motivos} total={perdas.length} /></div>
            {!b.campoMotivo && (
              <Sub className="mt-4">Não achei no Bitrix um campo de motivo de perda. Se ele tiver outro nome, informe o código do campo em BITRIX_CAMPO_MOTIVO.</Sub>
            )}
          </Card>
          <Card>
            <Label>Em que fase estava quando perdeu</Label>
            <div className="mt-4"><Ranking itens={ondePerdeu} total={perdas.length} /></div>
          </Card>
        </div>
      ) : (
        <Vazio>Nenhuma venda perdida {NOME_P[p]}.</Vazio>
      )}

      <H2 sub={`De onde vieram os leads ${NOME_P[p]} e as vendas ganhas no mesmo período.`}>Fontes</H2>
      {fontesLeads.length || vendasFonte.size ? (
        <Tabela>
          <thead>
            <tr><Th>Fonte</Th><Th right>Leads</Th><Th right>Participação</Th><Th right>Vendas</Th><Th right>Vendido</Th></tr>
          </thead>
          <tbody>
            {[...new Set([...fontesLeads.map((f) => f.k), ...vendasFonte.keys()])].map((k) => {
              const l = fontesLeads.find((f) => f.k === k)?.n ?? 0;
              const v = vendasFonte.get(k);
              return (
                <tr key={k}>
                  <Td className="font-medium">{k}</Td>
                  <Td right>{int(l)}</Td>
                  <Td right className="text-muted">{pct(l / Math.max(1, leads.length))}</Td>
                  <Td right>{int(v?.n ?? 0)}</Td>
                  <Td right className="font-semibold">{moneyK(v?.v ?? 0)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      ) : (
        <Vazio>Sem leads {NOME_P[p]}.</Vazio>
      )}

      <H2 sub={`Vendas ganhas ${NOME_P[p]} por responsável.`}>Vendas por pessoa</H2>
      {porPessoa.length ? (
        <Card>
          <div className="space-y-3">
            {porPessoa.map((x) => (
              <div key={x.k}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{x.k}</span>
                  <span className="tnum"><b>{moneyK(x.v)}</b> <span className="text-muted">· {int(x.n)} vendas · ticket {moneyK(x.v / x.n)}</span></span>
                </div>
                <div className="mt-1.5"><Bar v={x.v / Math.max(1, porPessoa[0].v)} color="var(--accent)" /></div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Vazio>Nenhuma venda ganha {NOME_P[p]}.</Vazio>
      )}
    </div>
  );
}
