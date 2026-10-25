import { type CSSProperties } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { BRL, NUM } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SpeakerHeroData = {
  saldoAtual: number;
  aReceber: number;
  recebido: number;
  adiantamentosAbertos: number;
  lucroMes: number;
  lucroAno: number;
  receitaBruta: number;
  custosTotais: number;
  margem: number;
  totalEmpresas: number;
  totalPalestras: number;
  pessoasImpactadas: number;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return m ? `${MONTHS[Number(m) - 1]}/${y.slice(2)}` : ym;
};

/**
 * Resumo da área do palestrante em linguagem simples:
 * quanto tem de saldo, quanto vai entrar e como os ganhos evoluem.
 */
export function SpeakerHero({
  k,
  series,
}: {
  k: SpeakerHeroData;
  /** Ganho do palestrante por mês (YYYY-MM). */
  series: { month: string; speaker: number }[];
}) {
  const data = series.slice(-12).map((s) => ({ ...s, label: monthLabel(s.month) }));
  const last = data.at(-1)?.speaker ?? 0;
  const prev = data.at(-2)?.speaker ?? 0;
  const delta = prev > 0 ? (last - prev) / prev : null;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] bg-ink text-ink-foreground shadow-[0_30px_80px_-40px_oklch(0.2_0.02_60/0.6)]">
        <div
          aria-hidden
          className="absolute -top-40 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
        />
        <div className="relative grid gap-8 p-8 md:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="reveal flex items-center gap-2 text-[12px] font-medium text-ink-foreground/70">
                Seu saldo hoje
                <span
                  title="Sua parte nas palestras já fechadas, menos o que já foi pago a você e os adiantamentos ainda em aberto."
                  className="cursor-help"
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              </div>
              <div
                className={cn(
                  "reveal mt-3 font-display text-[3.4rem] leading-none md:text-[4.2rem]",
                  k.saldoAtual < 0 && "text-rose-300",
                )}
                style={{ "--i": 1 } as CSSProperties}
              >
                <CountUp value={k.saldoAtual} format={(n) => BRL.format(n)} />
              </div>
              {delta !== null && (
                <div
                  className="reveal mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs"
                  style={{ "--i": 2 } as CSSProperties}
                >
                  {delta >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-300" />
                  )}
                  {Math.abs(Math.round(delta * 100))}% {delta >= 0 ? "a mais" : "a menos"} que no
                  mês anterior
                </div>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-3">
              <HeroFigure
                i={3}
                label="Vai entrar"
                hint="Estimativa das palestras ainda não fechadas"
                value={k.aReceber}
              />
              <HeroFigure
                i={4}
                label="Já recebido"
                hint="Pagamentos feitos a você"
                value={k.recebido}
              />
              <HeroFigure
                i={5}
                label="Adiantamentos"
                hint="Valores adiantados ainda não descontados"
                value={k.adiantamentosAbertos}
              />
            </dl>
          </div>

          <div
            className="reveal min-h-[220px] rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            style={{ "--i": 3 } as CSSProperties}
          >
            <div className="mb-2 flex items-baseline justify-between text-xs text-ink-foreground/70">
              <span>Seus ganhos por mês</span>
              <span>
                Ano:{" "}
                <span className="font-medium text-ink-foreground">{BRL.format(k.lucroAno)}</span>
              </span>
            </div>
            {data.length === 0 ? (
              <p className="grid h-[180px] place-items-center text-sm text-ink-foreground/50">
                Feche uma palestra para ver a evolução.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speakerArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--clay)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--clay)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 12, right: 12 }}
                    tick={{ fill: "currentColor", fontSize: 10, opacity: 0.55 }}
                  />
                  <Tooltip
                    cursor={{ stroke: "oklch(1 0 0 / 0.2)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [BRL.format(v), "Seu ganho"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="speaker"
                    stroke="var(--clay)"
                    strokeWidth={2}
                    fill="url(#speakerArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        <Mini label="Ganho no mês" value={BRL.format(k.lucroMes)} />
        <Mini
          label="Margem das palestras"
          value={`${(k.margem * 100).toFixed(0)}%`}
          hint={`Receita ${BRL.format(k.receitaBruta)} · custos ${BRL.format(k.custosTotais)}`}
        />
        <Mini
          label="Palestras fechadas"
          value={NUM.format(k.totalPalestras)}
          hint={`${NUM.format(k.totalEmpresas)} empresas atendidas`}
        />
        <Mini label="Pessoas impactadas" value={NUM.format(k.pessoasImpactadas)} />
      </div>
    </div>
  );
}

function HeroFigure({
  label,
  hint,
  value,
  i,
}: {
  label: string;
  hint: string;
  value: number;
  i: number;
}) {
  return (
    <div
      className="reveal rounded-2xl border border-white/10 bg-white/[0.06] p-4"
      style={{ "--i": i } as CSSProperties}
      title={hint}
    >
      <dt className="text-[11px] text-ink-foreground/60">{label}</dt>
      <dd className="mt-2 font-display text-xl leading-none tabular-nums md:text-2xl">
        {BRL.format(value)}
      </dd>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
