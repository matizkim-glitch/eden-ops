import type { BosState } from '../../app/bosData';
import { getFacilityZones, getStockPressure } from './domainInsights';

type FacilityPanelProps = Pick<BosState, 'products' | 'rawMaterials' | 'batches' | 'tasks'>;

export function FacilityPanel(props: FacilityPanelProps) {
  const zones = getFacilityZones(props);
  const pressure = getStockPressure(props.products, props.rawMaterials);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Facility</p>
        <h2 className="text-2xl font-semibold text-slate-950">Site readiness map</h2>
      </header>

      <div className="grid gap-3 lg:grid-cols-4">
        {zones.map(zone => (
          <article key={zone.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{zone.name}</h3>
                <p className="text-sm text-slate-600">{zone.owner}</p>
              </div>
              <span className={statusClass(zone.status)}>{zone.status}</span>
            </div>
            <p className="mt-4 text-sm text-slate-700">{zone.detail}</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-950">Storage pressure</h3>
        <p className="mt-2 text-sm text-slate-700">
          {pressure.finishedLow.length} finished product lines and {pressure.materialsLow.length} raw material lines are below operating thresholds.
        </p>
      </div>
    </section>
  );
}

function statusClass(status: 'steady' | 'watch' | 'blocked') {
  const base = 'rounded-full px-3 py-1 text-xs font-medium';
  if (status === 'blocked') return `${base} bg-rose-100 text-rose-700`;
  if (status === 'watch') return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-emerald-100 text-emerald-700`;
}
