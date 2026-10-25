/**
 * O Supabase devolve no máximo 1.000 linhas por consulta — sem erro, só corta.
 * Saldos de estoque e totais financeiros calculados com a lista cortada ficam
 * errados em silêncio. Use `fetchAll` em toda leitura que alimenta somas.
 *
 *   const { data, error } = await fetchAll(() =>
 *     supabase.from("stock_movements").select("...").eq("organization_id", org),
 *   );
 */
const PAGE = 1000;

type Page<T> = { data: T[] | null; error: unknown };
type Pageable<T> = {
  order: (column: string, opts?: { ascending?: boolean }) => Pageable<T>;
  range: (from: number, to: number) => PromiseLike<Page<T>>;
};

export async function fetchAll<T>(
  build: () => Pageable<T>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // Ordenação estável por id garante que nenhuma linha se repita ou suma entre páginas.
    const { data, error } = await build()
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { data: rows, error: error as { message: string } };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { data: rows, error: null };
}
