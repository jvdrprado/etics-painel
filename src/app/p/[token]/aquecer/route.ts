import { aoVivo, carregar } from "@/lib/dados";

// Chamado pelo robô do GitHub a cada 10 min: mantém os dados do Bitrix no cache,
// para quem abrir o painel nunca pegar a leitura completa.
export const maxDuration = 300;

export async function GET(_: Request, { params }: RouteContext<"/p/[token]/aquecer">) {
  const { token } = await params;
  if (!process.env.PAINEL_TOKEN || token !== process.env.PAINEL_TOKEN) return new Response(null, { status: 404 });
  const t0 = Date.now();
  const base = await carregar();
  const t1 = Date.now();
  await aoVivo();
  return Response.json({
    ok: true, demo: base.demo, negocios: base.deals.length, baseAtualizadaEm: new Date(base.atualizado * 1000).toISOString(), base_ms: t1 - t0, total_ms: Date.now() - t0,
  });
}
