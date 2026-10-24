import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { carregar } from "@/lib/dados";
import { dataHora } from "@/lib/fmt";

export const maxDuration = 300; // a 1ª leitura do Bitrix sem cache pode levar alguns segundos (o robô de aquecimento evita isso)

// O código na URL é a única "senha": sem ele, nenhuma aba abre.
export default async function PainelLayout({ children, params }: LayoutProps<"/p/[token]">) {
  const { token } = await params;
  if (!process.env.PAINEL_TOKEN || token !== process.env.PAINEL_TOKEN) notFound();
  const base = await carregar();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:py-6">
          <Logo className="h-8 w-auto lg:h-9" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted lg:mt-3">Painel comercial</div>
        </div>
        <Nav base={`/p/${token}`} />
        <div className="hidden px-5 py-5 text-xs leading-relaxed text-muted lg:mt-auto lg:block">
          Bitrix24 · Funil de Vendas
          <br />
          Atualizado {dataHora(base.atualizado)}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        {base.demo && (
          <div className="mb-6 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
            <b>Dados de exemplo.</b> As etapas são as do funil da ETICS, mas os negócios são inventados. Os dados reais entram quando o webhook do Bitrix
            (BITRIX_WEBHOOK) for configurado.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
