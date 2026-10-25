import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { GbsMark } from "@/components/gbs-mark";
import { LEGAL, LEGAL_PENDING } from "@/lib/legal";

/** Layout de documento público (Termos, Privacidade). */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link to="/" aria-label="GBS">
            <GbsMark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-[12px] font-medium text-clay">
          Versão {LEGAL.version} · vigente desde {LEGAL.effectiveDate}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight">{title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>
        {LEGAL_PENDING && (
          <p className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Documento em finalização: os dados cadastrais do responsável (CNPJ, endereço e contato)
            serão publicados em breve.
          </p>
        )}
        <article className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
          {children}
        </article>
        <footer className="mt-16 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/termos" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <span className="ml-auto">
            {LEGAL.companyName}
            {LEGAL.cnpj ? ` · CNPJ ${LEGAL.cnpj}` : ""}
          </span>
        </footer>
      </main>
    </div>
  );
}
