import type { CollectionRoute, ProductionBatch } from '../../app/bosData';
import { getSustainabilityKpis } from './domainInsights';

type SustainabilityPanelProps = {
  collections: CollectionRoute[];
  batches: ProductionBatch[];
};

export function SustainabilityPanel({ collections, batches }: SustainabilityPanelProps) {
  const kpis = getSustainabilityKpis(collections, batches);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-lime-700">Sustainability</p>
        <h2 className="text-2xl font-semibold text-slate-950">Impact evidence</h2>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {kpis.map(kpi => (
          <article key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{kpi.value}</p>
            <p className="mt-2 text-sm text-slate-600">{kpi.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
