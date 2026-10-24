import { AutoRefresh } from "@/components/autorefresh";
import { Copiar } from "@/components/copiar";
import { Bar, Big, Card, H2, Label, LinkDeal, PageHeader, Pill, Sub, Tabela, Td, Th, Vazio } from "@/components/ui";
import { abertos, atrasado, criados, diasNaEtapa, diasSemToque, fupsPorDeal, horasPrimeiroContato, mediana, parado, primeiroContato } from "@/lib/calc";
import { PRAZO_ETAPA, SLA_PRIMEIRO_CONTATO_H } from "@/lib/config";
import { aoVivo, carregar, type Deal, type Fup } from "@/lib/dados";
import { dataHora, int, pct, primeiroNome, tempo } from "@/lib/fmt";
import { agoraUnix, iso, segundosUteis, soma } from "@/lib/periodo";

const horas = (h: number | null) => (h == null ? "-" : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0).replace(".", ",")} h`);

/** Texto pronto para o WhatsApp: o que a pessoa precisa resolver hoje, com o link de cada negócio. */
function pauta(nome: string, atrasados: { d: Deal; f: Fup }[], parados: Deal[], novos: Deal[], agora: number) {
  const linhas = [`Bom dia, ${primeiroNome(nome)}! Pauta de hoje no Bitrix:`];
  const bloco = (titulo: string, itens: string[]) => {
    if (!itens.length) return;
    linhas.push("", `*${titulo}*`, ...itens.slice(0, 10));
    if (itens.length > 10) linhas.push(`e mais ${itens.length - 10}`);
  };
  bloco("Novos aguardando contato", novos.map((d) => `• ${d.titulo} (há ${tempo(segundosUteis(d.criado, agora))})\n${d.link}`));
  bloco("FUPs atrasados", atrasados.map(({ d, f }) => `• ${d.titulo}: ${f.assunto} (venceu ${dataHora(f.vence)})\n${d.link}`));
  bloco("Parados na cadência", parados.map((d) => `• ${d.titulo} (${d.etapa}, ${diasSemToque(d, agora)} dias sem toque)\n${d.link}`));
  linhas.push("", "Me avisa quando atualizar no Bitrix.");
  return linhas.join("\n");
}

export default async function Cadencia() {
  const [b, vivo] = await Promise.all([carregar(), aoVivo()]);
  const agora = agoraUnix();
  const hoje = iso(agora);
  const abertosAgora = abertos(b);
  const fups = fupsPorDeal(b);
  const deal = new Map(b.deals.map((d) => [d.id, d]));
  const emAndamento = abertosAgora.filter((d) => d.grupo !== "novo");
  const parados = emAndamento.filter((d) => parado(d, agora)).sort((x, y) => diasSemToque(y, agora) - diasSemToque(x, agora));
  const semPasso = emAndamento.filter((d) => !fups.get(d.id)?.length);
  const fupsAtrasados = b.fupsAbertos.filter((f) => atrasado(f, agora) && deal.get(f.deal)?.fechado == null);

  // 1º contato: leads criados nos últimos 30 dias.
  const recentes = criados(b, soma(hoje, -29), hoje);
  const pc = primeiroContato(recentes, agora);

  const etapas = b.etapas
    .filter((e) => e.grupo !== "ganho" && e.grupo !== "perdido")
    .map((e) => {
      const ds = abertosAgora.filter((d) => d.etapaId === e.id);
      return {
        ...e,
        n: ds.length,
        media: ds.length ? ds.reduce((s, d) => s + diasNaEtapa(d, agora), 0) / ds.length : 0,
        parados: ds.filter((d) => parado(d, agora)).length,
        semFup: ds.filter((d) => d.grupo !== "novo" && !fups.get(d.id)?.length).length,
      };
    });
  const maxN = Math.max(1, ...etapas.map((e) => e.n));

  const time = b.pessoas.map((p) => {
    const fh = vivo.fupsHoje.filter((f) => f.respId === p.id);
    const atr = fupsAtrasados.filter((f) => f.respId === p.id).map((f) => ({ f, d: deal.get(f.deal)! }));
    const par = parados.filter((d) => d.respId === p.id);
    const nov = abertosAgora.filter((d) => d.respId === p.id && d.grupo === "novo").sort((x, y) => x.criado - y.criado);
    const meus = recentes.filter((d) => d.respId === p.id);
    return {
      ...p, fupHoje: fh.length, fupFeito: fh.filter((f) => f.feito).length, atrasados: atr, parados: par, novos: nov,
      pc: primeiroContato(meus, agora), mediana: mediana(meus.map(horasPrimeiroContato).filter((h): h is number => h != null)),
    };
  });

  return (
    <div>
      <AutoRefresh segundos={60} />
      <PageHeader kicker="Cadência" title="Quem está sendo tocado" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Label>1º contato em {SLA_PRIMEIRO_CONTATO_H} h úteis</Label>
          <Big className={pc.pct != null && pc.pct < 0.8 ? "text-bad" : "text-ok"}>{pct(pc.pct)}</Big>
          <Sub>{int(pc.noPrazo)} de {int(pc.base)} leads dos últimos 30 dias · mediana {horas(pc.mediana)} · meta 80%</Sub>
        </Card>
        <Card>
          <Label>Parados na cadência</Label>
          <Big className={parados.length ? "text-bad" : ""}>{int(parados.length)}</Big>
          <Sub>de {int(emAndamento.length)} em andamento, sem toque além do prazo da etapa</Sub>
        </Card>
        <Card>
          <Label>FUPs atrasados</Label>
          <Big className={fupsAtrasados.length ? "text-bad" : ""}>{int(fupsAtrasados.length)}</Big>
          <Sub>atividades com prazo vencido e não concluídas</Sub>
        </Card>
        <Card>
          <Label>Sem próximo passo</Label>
          <Big className={semPasso.length ? "text-warn" : ""}>{int(semPasso.length)}</Big>
          <Sub>negócios em andamento sem nenhuma atividade agendada</Sub>
        </Card>
      </div>

      <H2 sub="FUPs com prazo hoje e a pauta pronta de cada pessoa para mandar no WhatsApp.">FUP de hoje</H2>
      <Tabela min={860}>
        <thead>
          <tr><Th>Pessoa</Th><Th right>FUP hoje</Th><Th right>Atrasados</Th><Th right>Parados</Th><Th right>Novos esperando</Th><Th right>1º contato 24 h</Th><Th right>Mediana</Th><Th /></tr>
        </thead>
        <tbody>
          {time.map((x) => (
            <tr key={x.id}>
              <Td className="whitespace-nowrap font-medium">{x.nome}</Td>
              <Td right>{x.fupHoje ? <span className={x.fupFeito < x.fupHoje ? "" : "text-ok"}>{x.fupFeito} de {x.fupHoje}</span> : "-"}</Td>
              <Td right className={x.atrasados.length ? "font-semibold text-bad" : ""}>{int(x.atrasados.length)}</Td>
              <Td right className={x.parados.length ? "font-semibold text-bad" : ""}>{int(x.parados.length)}</Td>
              <Td right className={x.novos.length ? "font-semibold text-accent-strong" : ""}>{int(x.novos.length)}</Td>
              <Td right>{pct(x.pc.pct)}</Td>
              <Td right>{horas(x.mediana)}</Td>
              <Td right>
                {x.atrasados.length + x.parados.length + x.novos.length > 0 && <Copiar rotulo="Copiar pauta" texto={pauta(x.nome, x.atrasados, x.parados, x.novos, agora)} />}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <H2 sub="Cada etapa do funil aberto: quantos estão nela, há quanto tempo em média e quantos passaram do prazo sem toque.">Etapas da cadência</H2>
      <Tabela min={820}>
        <thead>
          <tr><Th>Etapa</Th><Th>Negócios</Th><Th right>Média na etapa</Th><Th right>Prazo</Th><Th right>Parados</Th><Th right>Sem FUP</Th></tr>
        </thead>
        <tbody>
          {etapas.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap font-medium">{e.nome}</Td>
              <Td className="w-[32%]">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><Bar v={e.n / maxN} color={e.grupo === "novo" ? "var(--accent)" : "var(--ink)"} /></div>
                  <span className="tnum w-8 text-right font-semibold">{e.n}</span>
                </div>
              </Td>
              <Td right>{e.n ? `${e.media.toFixed(1).replace(".", ",")} d` : "-"}</Td>
              <Td right className="text-muted">{e.grupo === "novo" ? `${SLA_PRIMEIRO_CONTATO_H} h` : `${PRAZO_ETAPA[e.grupo]} d úteis`}</Td>
              <Td right className={e.parados ? "font-semibold text-bad" : ""}>{e.grupo === "novo" ? "-" : int(e.parados)}</Td>
              <Td right className={e.semFup ? "text-warn" : ""}>{e.grupo === "novo" ? "-" : int(e.semFup)}</Td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <H2 sub="Sem toque (atividade ou mudança de etapa) há mais dias úteis do que o prazo da etapa. Do mais esquecido para o mais recente.">
        Precisa de toque ({int(parados.length)})
      </H2>
      {parados.length ? (
        <Tabela min={860}>
          <thead>
            <tr><Th>Negócio</Th><Th>Etapa</Th><Th right>Sem toque</Th><Th right>Na etapa</Th><Th>Próximo FUP</Th><Th>Responsável</Th></tr>
          </thead>
          <tbody>
            {parados.map((d) => {
              const f = fups.get(d.id)?.[0];
              return (
                <tr key={d.id}>
                  <Td><LinkDeal href={d.link}>{d.titulo}</LinkDeal></Td>
                  <Td className="whitespace-nowrap">{d.etapa}</Td>
                  <Td right><Pill tom="ruim">{diasSemToque(d, agora)} d úteis</Pill></Td>
                  <Td right>{diasNaEtapa(d, agora)} d</Td>
                  <Td>
                    {!f ? <Pill tom="ruim">sem próximo passo</Pill> : atrasado(f, agora) ? <Pill tom="ruim">atrasado há {tempo(agora - f.vence)}</Pill> : <span className="text-muted">{dataHora(f.vence)}</span>}
                  </Td>
                  <Td className="whitespace-nowrap">{primeiroNome(d.resp)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      ) : (
        <Vazio>Ninguém parado: todo negócio em andamento teve toque dentro do prazo.</Vazio>
      )}

      <H2 sub="Atividades abertas com prazo vencido, da mais antiga para a mais nova.">FUPs atrasados ({int(fupsAtrasados.length)})</H2>
      {fupsAtrasados.length ? (
        <Tabela min={760}>
          <thead>
            <tr><Th>Negócio</Th><Th>Atividade</Th><Th>Venceu</Th><Th>Etapa</Th><Th>Responsável</Th></tr>
          </thead>
          <tbody>
            {fupsAtrasados.sort((x, y) => x.vence - y.vence).map((f) => {
              const d = deal.get(f.deal)!;
              return (
                <tr key={f.id}>
                  <Td><LinkDeal href={d.link}>{d.titulo}</LinkDeal></Td>
                  <Td>{f.assunto}</Td>
                  <Td className="whitespace-nowrap text-bad">{dataHora(f.vence)}</Td>
                  <Td className="whitespace-nowrap">{d.etapa}</Td>
                  <Td className="whitespace-nowrap">{primeiroNome(b.pessoas.find((p) => p.id === f.respId)?.nome ?? d.resp)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      ) : (
        <Vazio>Nenhum FUP atrasado.</Vazio>
      )}
    </div>
  );
}
