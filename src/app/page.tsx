import { notFound } from "next/navigation";

// A raiz não mostra nada: o painel só abre pelo link com o código (/p/<código>).
export default function Home() {
  notFound();
}
