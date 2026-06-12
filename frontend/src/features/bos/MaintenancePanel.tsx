import type { ProductionBatch, StaffTask } from '../../app/bosData';
import { getMaintenanceInsights } from './domainInsights';

type MaintenancePanelProps = {
  tasks: StaffTask[];
  batches: ProductionBatch[];
  onCompleteTask?: (taskId: string) => void;
};

export function MaintenancePanel({ tasks, batches, onCompleteTask }: MaintenancePanelProps) {
  const insights = getMaintenanceInsights(tasks, batches);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-orange-700">Maintenance</p>
        <h2 className="text-2xl font-semibold text-slate-950">Work order control</h2>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Open work" value={String(insights.open.length)} />
        <Metric label="High priority" value={String(insights.highPriority.length)} />
        <Metric label="Downtime risk" value={insights.downtimeRisk} />
      </div>

      <div className="grid gap-3">
        {insights.open.map(task => (
          <article key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{task.title}</h3>
                <p className="text-sm text-slate-600">{task.owner} / {task.priority}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{task.status}</span>
            </div>
            {onCompleteTask ? (
              <button
                className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                type="button"
                onClick={() => onCompleteTask(task.id)}
              >
                Complete task
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
