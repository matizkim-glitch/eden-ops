import type { BosState, StaffTask } from '../../app/bosData';
import { getInfrastructureKpis } from './domainInsights';

type InfrastructurePanelProps = Pick<BosState, 'tasks' | 'auditEvents' | 'collections'> & {
  onCompleteTask?: (taskId: string) => void;
};

export function InfrastructurePanel({ tasks, auditEvents, collections, onCompleteTask }: InfrastructurePanelProps) {
  const kpis = getInfrastructureKpis({ tasks, auditEvents, collections });
  const checks = getInfrastructureChecks(tasks);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-700">Infrastructure</p>
        <h2 className="text-2xl font-semibold text-slate-950">Operational systems</h2>
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

      <div className="grid gap-3">
        {checks.map(task => (
          <article key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{task.title}</h3>
                <p className="text-sm text-slate-600">{task.department} / {task.owner}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{task.status}</span>
            </div>
            {task.status !== 'completed' && onCompleteTask ? (
              <button
                className="mt-4 rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800"
                type="button"
                onClick={() => onCompleteTask(task.id)}
              >
                Mark checked
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function getInfrastructureChecks(tasks: StaffTask[]) {
  return tasks.filter(task => ['Infrastructure', 'Operations', 'Maintenance'].includes(task.department));
}
