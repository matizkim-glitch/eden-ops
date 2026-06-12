import type { CollectionRoute } from '../../app/bosData';
import { formatKg, getCollectionInsights } from './domainInsights';

type CollectionPanelProps = {
  routes: CollectionRoute[];
  onReceiveRoute?: (routeId: string) => void;
};

export function CollectionPanel({ routes, onReceiveRoute }: CollectionPanelProps) {
  const insights = getCollectionInsights(routes);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Waste collection</p>
        <h2 className="text-2xl font-semibold text-slate-950">Route intake</h2>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Expected weight" value={formatKg(insights.totalKg)} />
        <Metric label="Pending routes" value={String(insights.pendingCount)} />
        <Metric label="Received routes" value={String(insights.receivedCount)} />
      </div>

      <div className="grid gap-3">
        {routes.map(route => (
          <article key={route.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{route.school_name}</h3>
                <p className="text-sm text-slate-600">{route.zone} / {formatKg(route.weight_kg)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{route.status}</span>
            </div>
            {route.status !== 'received' && onReceiveRoute ? (
              <button
                className="mt-4 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                type="button"
                onClick={() => onReceiveRoute(route.id)}
              >
                Post receipt
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
