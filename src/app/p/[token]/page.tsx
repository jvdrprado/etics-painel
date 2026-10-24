import { AutoRefresh } from "@/components/autorefresh";
import { Bar, Big, Card, Delta, H2, Label, LinkDeal, PageHeader, Pill, Seletor, Sub, Tabela, Td, Th, Vazio } from "@/components/ui";
import { abertos, atrasado, diasNaEtapa, doGrupo, fupsPorDeal, ganhos, perdidos, placar, somaValor } from "@/lib/calc";
import { GRUPOS, SLA_PRIMEIRO_CONTATO_H, type Grupo } from "@/lib/config";
import { aoVivo, carregar, type Deal, type Fup, type Presenca } from "@/lib/dados";
import { data, dataHora, horaMin, int, moneyK, primeiroNome, tempo } from "@/lib/fmt";
import { agoraUnix, iso, janela, segundosUteis, NOME_ANTERIOR, type Periodo } from "@/lib/periodo";

const OPCOES = { semana: "Semana", mes: "Mês", tri: "Trimestre", sem: "Semestre" };
const NOME_P: Record<string, string> = { semana: "na semana", mes: "no mês", tri: "no trimestre", sem: "no semestre" };

function Situacao({ p, agora }: { p?: Presenca; agora: number }) {
  if (!p) return <Pill>sem dado</Pill>;
  if (p.expediente === "aberto") return <Pill tom="bom">Em expediente{p.desde ? ` desde ${horaMin(p.desde)}` : ""}</Pill>;
  if (p.expediente === "pausa") return <Pill tom="alerta">Em pausa</Pill>;
  if (p.online) return <Pill tom="bom">Online agora</Pill>;
  if (p.expediente === "fechado") return <Pill tom="ruim">Fora{p.visto ? ` · visto há ${tempo(agora - p.visto)}` : ""}</Pill>;
  return <Pill tom={p.visto && agora - p.visto < 3600 ? "alerta" : "ruim"}>{p.visto ? `Visto há ${tempo(agora - p.visto)}` : "Fora"}</Pill>;
}

function ProximoFup({ fs, agora }: { fs?: Fup[]; agora: number }) {
  const f = fs?.[0];
  if (!f) return <Pill tom="ruim">sem próximo passo</Pill>;
  if (atrasado(f, agora)) return <Pill tom="ruim">atrasado há {tempo(agora - f.vence)}</Pill>;
  return <span className="text-muted">{dataHora(f.vence)} · {f.assunto}</span>;
}

/** Tabela de negócios em andamento (propostas ou contratos), do maior valor para o menor. */
function TabelaAndamento({ ds, fups, agora }: { ds: Deal[]; fups: Map<number, Fup[]>; agora: number }) {
  if (!ds.length) return <Vazio>Nenhum negócio nesta fase agora.</Vazio>;
  return (
    <Tabela min={760}>
      <thead>
        <tr><Th>Negócio</Th><Th>Etapa</Th><Th right>Valor</Th><Th right>Na etapa</Th><Th>Próximo FUP</Th><Th>Responsável</Th></tr>
      </thead>
      <tbody>
        {[...ds].sort((a, b) => b.valor - a.valor).map((d) => {
          const dias = diasNaEtapa(d, agora);
          return (
            <tr key={d.id}>
              <Td><LinkDeal href={d.link}>{d.titulo}</LinkDeal></Td>
              <Td className="whitespace-nowrap">{d.etapa}</Td>
              <Td right className="font-semibold">{moneyK(d.valor)}</Td>
              <Td right className={dias > 7 ? "text-bad" : ""}>{dias} d</Td>
              <Td><ProximoFup fs={fups.get(d.id)} agora={agora} /></Td>
              <Td className="whitespace-nowrap">{primeiroNome(d.resp)}</Td>
            </tr>
          );
        })}
      </tbody>
    </Tabela>
  );
}

export default async function VisaoGeral({ searchParams }: PageProps<"/p/[token]">) {
  const sp = await searchParams;
  const p = (typeof sp.p === "string" && sp.p in OPCOES ? sp.p : "mes") as Periodo;
  const [b, vivo] = await Promise.all([carregar(), aoVivo()]);
  const agora = agoraUnix();
  const hoje = iso(agora);
  const j = janela(p, hoje);
  const atual = placar(b, j.de, j.ate);
  const antes = placar(b, j.antDe, j.antMesmoPonto);
  const fups = fupsPorDeal(b);
  const abertosAgora = abertos(b);

  const novos = doGrupo(b, "novo").sort((x, y) => x.criado - y.criado);
  const propostas = doGrupo(b, "proposta");
  const contratos = doGrupo(b, "contrato");
  const vendas = ganhos(b, j.de, j.ate).sort((x, y) => y.fechado! - x.fechado!);
  const perdas = perdidos(b, j.de, j.ate);
  const maisAntigo = novos[0];
  const esperaAntigo = maisAntigo ? segundosUteis(maisAntigo.criado, agora) : 0;

  // Funil agora: grupos abertos pelo estoque atual; ganho e perdido pelo período escolhido.
  const linhas: { g: Grupo; nome: string; n: number; v: number; etapas: { nome: string; n: number }[] }[] = GRUPOS.map((g) => {
    const ds = g.id === "ganho" ? vendas : g.id === "perdido" ? perdas : abertosAgora.filter((d) => d.grupo === g.id);
    const etapas = b.etapas.filter((e) => e.grupo === g.id).map((e) => ({ nome: e.nome, n: ds.filter((d) => d.etapaId === e.id).length }));
    return { g: g.id, nome: g.nome, n: ds.length, v: somaValor(ds), etapas };
  });
  const maxN = Math.max(1, ...linhas.map((l) => l.n));

  // Time: só quem tem negócio no funil.
  const presenca = new Map(vivo.presenca.map((x) => [x.id, x]));
  const time = b.pessoas.map((pe) => {
    const meus = abertosAgora.filter((d) => d.respId === pe.id);
    const fh = vivo.fupsHoje.filter((f) => f.respId === pe.id);
    const vend = vendas.filter((d) => d.respId === pe.id);
    return {
      ...pe,
      novos: meus.filter((d) => d.grupo === "novo").length,
      cadencia: meus.filter((d) => d.grupo === "cadencia").length,
      reuniao: meus.filter((d) => d.grupo === "reuniao").length,
      propostas: meus.filter((d) => d.grupo === "proposta"),
      contratos: meus.filter((d) => d.grupo === "contrato"),
      fupHoje: fh.length,
      fupFeito: fh.filter((f) => f.feito).length,
      atrasados: b.fupsAbertos.filter((f) => f.respId === pe.id && atrasado(f, agora)).length,
      acoes: vivo.acoesHoje[pe.id] ?? 0,
      vendido: somaValor(vend),
      vendas: vend.length,
    };
  });

  return (
    <div>
      <AutoRefresh segundos={60} />
      <PageHeader kicker="Visão Geral" title="Funil de Vendas" right={<Seletor base="" atual={p} opcoes={OPCOES} />} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Label>Vendido {NOME_P[p]}</Label>
          <Big>{moneyK(atual.receita)}</Big>
          <Sub>
            {int(atual.ganhos)} {atual.ganhos === 1 ? "venda" : "vendas"} · <Delta atual={atual.receita} antes={antes.receita} /> <span>vs {NOME_ANTERIOR[p]}</span>
          </Sub>
        </Card>
        <Card>
          <Label>Propostas na mesa</Label>
          <Big>{moneyK(somaValor(propostas))}</Big>
          <Sub>{int(propostas.length)} propostas · {int(propostas.filter((d) => /fu/i.test(d.etapa)).length)} em follow-up</Sub>
        </Card>
        <Card>
          <Label>Contratos em andamento</Label>
          <Big>{moneyK(somaValor(contratos))}</Big>
          <Sub>{int(contratos.length)} contratos para elaborar, enviados ou em follow-up</Sub>
        </Card>
        <Card className={esperaAntigo > SLA_PRIMEIRO_CONTATO_H * 3600 ? "ring-2 ring-accent/40" : ""}>
          <Label>Novos aguardando contato</Label>
          <Big className={novos.length ? "text-accent-strong" : ""}>{int(novos.length)}</Big>
          <Sub>{maisAntigo ? `o mais antigo espera há ${tempo(esperaAntigo)} úteis` : "ninguém esperando"}</Sub>
        </Card>
      </div>

      <H2 sub={`Novos a contratos: quantos estão em cada fase agora. Ganhas e perdidas: ${NOME_P[p]}.`}>Funil agora</H2>
      <Card>
        <div className="space-y-4">
          {linhas.map((l) => (
            <div key={l.g} className="grid gap-x-4 gap-y-1 sm:grid-cols-[160px_1fr_150px] sm:items-center">
              <div className="text-sm font-semibold">{l.nome}</div>
              <div className="min-w-0">
                <Bar v={l.n / maxN} color={l.g === "perdido" ? "var(--faint)" : l.g === "ganho" || l.g === "novo" ? "var(--accent)" : "var(--ink)"} />
                <div className="mt-1 truncate text-xs text-muted">{l.etapas.filter((e) => e.n).map((e) => `${e.nome} ${e.n}`).join(" · ") || "nenhum"}</div>
              </div>
              <div className="tnum text-sm sm:text-right">
                <b>{int(l.n)}</b>
                {l.v > 0 && <span className="text-muted"> · {moneyK(l.v)}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <H2 sub="Expediente e acesso pelo Bitrix, ações e FUPs de hoje e o que cada um tem no funil agora.">Time agora</H2>
      <Tabela min={980}>
        <thead>
          <tr>
            <Th>Pessoa</Th><Th>Situação</Th><Th right>Ações hoje</Th><Th right>FUP hoje</Th><Th right>FUP atrasado</Th>
            <Th right>Novos</Th><Th right>Cadência</Th><Th right>Reunião</Th><Th right>Propostas</Th><Th right>Contratos</Th><Th right>Vendido {NOME_P[p]}</Th>
          </tr>
        </thead>
        <tbody>
          {time.map((x) => (
            <tr key={x.id}>
              <Td className="whitespace-nowrap font-medium">{x.nome}</Td>
              <Td><Situacao p={presenca.get(x.id)} agora={agora} /></Td>
              <Td right className={x.acoes ? "" : "text-bad"}>{int(x.acoes)}</Td>
              <Td right>{x.fupHoje ? `${x.fupFeito} de ${x.fupHoje}` : "-"}</Td>
              <Td right className={x.atrasados ? "font-semibold text-bad" : ""}>{int(x.atrasados)}</Td>
              <Td right className={x.novos ? "font-semibold text-accent-strong" : ""}>{int(x.novos)}</Td>
              <Td right>{int(x.cadencia)}</Td>
              <Td right>{int(x.reuniao)}</Td>
              <Td right>{int(x.propostas.length)} <span className="text-muted">· {moneyK(somaValor(x.propostas))}</span></Td>
              <Td right>{int(x.contratos.length)} <span className="text-muted">· {moneyK(somaValor(x.contratos))}</span></Td>
              <Td right className="font-semibold">{moneyK(x.vendido)}</Td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <H2 sub={`Em "Aguardando contato", do mais antigo para o mais novo. Meta: primeiro contato em até ${SLA_PRIMEIRO_CONTATO_H} h úteis.`}>
        Novos leads ({int(novos.length)})
      </H2>
      {novos.length ? (
        <Tabela min={720}>
          <thead>
            <tr><Th>Lead</Th><Th>Fonte</Th><Th>Chegou</Th><Th right>Esperando</Th><Th>Responsável</Th></tr>
          </thead>
          <tbody>
            {novos.map((d) => {
              const s = segundosUteis(d.criado, agora);
              return (
                <tr key={d.id}>
                  <Td><LinkDeal href={d.link}>{d.titulo}</LinkDeal></Td>
                  <Td className="text-muted">{d.fonte}</Td>
                  <Td className="whitespace-nowrap">{dataHora(d.criado)}</Td>
                  <Td right>
                    <Pill tom={s > SLA_PRIMEIRO_CONTATO_H * 3600 ? "ruim" : s > 3600 ? "alerta" : "bom"}>{tempo(s)}</Pill>
                  </Td>
                  <Td className="whitespace-nowrap">{primeiroNome(d.resp)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      ) : (
        <Vazio>Nenhum lead aguardando contato.</Vazio>
      )}

      <H2 sub="Proposta Enviada, FU 1 e FU 2, do maior valor para o menor.">Propostas na mesa ({int(propostas.length)} · {moneyK(somaValor(propostas))})</H2>
      <TabelaAndamento ds={propostas} fups={fups} agora={agora} />

      <H2 sub="Elaborar / enviar contrato, contrato enviado e follow-up.">Contratos ({int(contratos.length)} · {moneyK(somaValor(contratos))})</H2>
      <TabelaAndamento ds={contratos} fups={fups} agora={agora} />

      <H2 sub={`Negócios que foram para Ganho ${NOME_P[p]}.`}>Vendas ganhas ({int(vendas.length)} · {moneyK(somaValor(vendas))})</H2>
      {vendas.length ? (
        <Tabela>
          <thead>
            <tr><Th>Negócio</Th><Th right>Valor</Th><Th>Fechou em</Th><Th>Fonte</Th><Th>Responsável</Th></tr>
          </thead>
          <tbody>
            {vendas.map((d) => (
              <tr key={d.id}>
                <Td><LinkDeal href={d.link}>{d.titulo}</LinkDeal></Td>
                <Td right className="font-semibold">{moneyK(d.valor)}</Td>
                <Td>{data(d.fechado!)}</Td>
                <Td className="text-muted">{d.fonte}</Td>
                <Td className="whitespace-nowrap">{primeiroNome(d.resp)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      ) : (
        <Vazio>Nenhuma venda ganha {NOME_P[p]} ainda.</Vazio>
      )}
    </div>
  );
}
