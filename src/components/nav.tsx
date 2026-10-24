"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "", label: "Visão Geral", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/cadencia", label: "Cadência", icon: "M3 12h4l2-5 4 10 2-5h6" },
  { href: "/macros", label: "Macros", icon: "M3 3v18h18M7 14l3-3 3 3 5-6" },
];

export function Nav({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {ITENS.map((i) => {
        const href = base + i.href;
        const ativo = path === href;
        return (
          <Link
            key={i.label}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              ativo ? "bg-ink font-semibold text-white" : "text-foreground/85 hover:bg-surface"
            }`}
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 fill-none stroke-current ${ativo ? "text-accent" : ""}`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={i.icon} />
            </svg>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
