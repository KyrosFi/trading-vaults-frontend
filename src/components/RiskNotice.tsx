/** Margin-risk disclaimer shown above the active vaults list. */
export function RiskNotice() {
  return (
    <aside className="mb-10 border-l-2 border-kairos bg-card/60 px-6 py-5">
      <p className="text-lg leading-relaxed">
        Kyros vaults trade spot with margin, routed across multiple venues for optimal execution.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Margin amplifies gains and losses alike. Every vault runs to defined take-profit and
        stop-loss levels.
      </p>
    </aside>
  );
}
