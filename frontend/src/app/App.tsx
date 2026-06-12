import type React from 'react';
import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, ChevronRight, LogOut, Search } from 'lucide-react';
import { CollectionPanel, FacilityPanel, InfrastructurePanel, MaintenancePanel, SustainabilityPanel } from '../features/bos';
import { config } from '../lib/config';
import { useBosStore, type BosState } from './bosData';
import { departments, defaultDepartment, type DepartmentId } from './navigation';

const money = (value: number) => `KES ${value.toLocaleString('en-KE')}`;
const kg = (value: number) => `${value.toLocaleString('en-KE')} kg`;
const labelize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

export function App() {
  const [active, setActive] = useState<DepartmentId>(defaultDepartment);
  const [query, setQuery] = useState('');
  const { state, actions } = useBosStore();
  const filteredDepartments = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? departments.filter(item => item.label.toLowerCase().includes(value)) : departments;
  }, [query]);
  const activeDepartment = departments.find(item => item.id === active) || departments[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-80 flex-col border-r border-slate-200 bg-white/95 shadow-sm backdrop-blur md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <img src="/eden-recyclers-logo.jpg" alt="Eden Recyclers" className="h-12 w-auto object-contain" />
        </div>
        <div className="px-4 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find department"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Departments">
          {filteredDepartments.map(item => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition motion-safe:hover:-translate-y-0.5 ${
                  isActive ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <ChevronRight className={`h-4 w-4 transition ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Runtime</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{config.isConfigured ? 'Supabase connected' : 'Local preview mode'}</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen md:ml-80">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-5 md:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Eden Recyclers BOS</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">{activeDepartment.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="icon-btn" type="button" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
              <button className="icon-btn" type="button" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6 md:px-8">
          <Hero active={active} state={state} />
          <Metrics active={active} state={state} />
          <DepartmentWorkspace active={active} state={state} actions={actions} />
        </div>
      </main>
    </div>
  );
}

function Hero({ active, state }: { active: DepartmentId; state: BosState }) {
  const blocked = state.orders.filter(item => item.status === 'stock_blocked').length;
  const low = state.rawMaterials.filter(item => item.quantity_kg <= item.reorder_threshold_kg).length;
  const copy: Partial<Record<DepartmentId, [string, string]>> = {
    inventory: ['Resolve stock before sales confirmation.', 'Finished goods, raw materials, reorder rules, reservations, and stock movements are now handled in React state.'],
    production: ['Batch lifecycle is actionable.', 'Material request, issue, line work, QC, completion, and finished stock credit can be advanced from this workspace.'],
    sales: ['No stock, no confirmed sale.', 'Orders can be checked against finished stock before invoice or dispatch work proceeds.'],
    finance: ['Payment state remains auditable.', 'Payments update invoice balances and append payment records rather than deleting history.']
  };
  const [title, body] = copy[active] || ['Production-grade React migration active.', 'The current BOS outline is preserved while workflows move into typed React components and a Supabase-ready data layer.'];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-emerald-700">{title}</p>
          <p className="mt-2 text-base leading-7 text-slate-600">{body}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <div className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" />Live blockers</div>
          <p className="mt-1 max-w-sm text-sm">{blocked} blocked order(s), {low} low material line(s). Existing HTML remains available until live Supabase cutover.</p>
        </div>
      </div>
    </section>
  );
}

function Metrics({ active, state }: { active: DepartmentId; state: BosState }) {
  const lowMaterials = state.rawMaterials.filter(item => item.quantity_kg <= item.reorder_threshold_kg);
  const blockedOrders = state.orders.filter(item => item.status === 'stock_blocked');
  const openTasks = state.tasks.filter(item => item.status !== 'completed');
  const activeBatches = state.batches.filter(item => !['completed', 'rejected'].includes(item.status));
  const outstanding = state.invoices.reduce((sum, item) => sum + Math.max(0, item.amount - item.paid_amount), 0);
  const common = {
    overview: [['Open Actions', String(openTasks.length), 'Tasks across departments'], ['Blocked Orders', String(blockedOrders.length), 'Need stock or production action'], ['Outstanding', money(outstanding), 'Customer balances']],
    collection: [['Active Routes', String(state.collections.filter(item => item.status !== 'received').length), 'Routes not received'], ['Expected Weight', kg(state.collections.reduce((sum, item) => sum + item.weight_kg, 0)), 'Scheduled volume'], ['Raw Receipts', String(state.collections.filter(item => item.status === 'received').length), 'Posted to ledger']],
    inventory: [['Finished Stock', kg(state.products.reduce((sum, item) => sum + item.quantity_kg, 0)), 'Sellable stock'], ['Low Materials', String(lowMaterials.length), 'Below threshold'], ['Ledger Sources', 'Live', 'Movements are recorded']],
    production: [['Active Batches', String(activeBatches.length), 'Before completion'], ['QC Pending', String(state.batches.filter(item => item.status === 'qc_pending').length), 'Need QC record'], ['Output Ready', kg(state.batches.reduce((sum, item) => sum + item.output_qty_kg, 0)), 'Credited output']],
    sales: [['Orders', String(state.orders.length), 'Customer demand'], ['Blocked', String(blockedOrders.length), 'Cannot invoice or dispatch'], ['Revenue', money(state.invoices.reduce((sum, item) => sum + item.paid_amount, 0)), 'Collected payments']],
    finance: [['Invoices', String(state.invoices.length), 'Customer invoices'], ['Outstanding', money(outstanding), 'Unpaid balance'], ['Paid', money(state.invoices.reduce((sum, item) => sum + item.paid_amount, 0)), 'Recorded payments']]
  } as Partial<Record<DepartmentId, string[][]>>;
  const rows = common[active] || [['Exceptions', String(blockedOrders.length + lowMaterials.length), 'Cross-department blockers'], ['Tasks', String(openTasks.length), 'Action owners'], ['Readiness', 'React', 'Migrated workspace']];
  return <section className="grid gap-4 md:grid-cols-3">{rows.map(([label, value, note]) => <Metric key={label} label={label} value={value} note={note} />)}</section>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-2 text-sm text-slate-600">{note}</p></article>;
}

function DepartmentWorkspace({ active, state, actions }: { active: DepartmentId; state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  if (active === 'collection') return <CollectionPanel routes={state.collections} onReceiveRoute={actions.receiveCollection} />;
  if (active === 'facility') return <FacilityPanel products={state.products} rawMaterials={state.rawMaterials} batches={state.batches} tasks={state.tasks} />;
  if (active === 'maintenance') return <MaintenancePanel tasks={state.tasks} batches={state.batches} onCompleteTask={actions.completeTask} />;
  if (active === 'sustainability') return <SustainabilityPanel collections={state.collections} batches={state.batches} />;
  if (active === 'infrastructure') return <InfrastructurePanel tasks={state.tasks} auditEvents={state.auditEvents} collections={state.collections} onCompleteTask={actions.completeTask} />;
  if (active === 'inventory') return <InventoryWorkspace state={state} actions={actions} />;
  if (active === 'production') return <ProductionWorkspace state={state} actions={actions} />;
  if (active === 'sales') return <SalesWorkspace state={state} actions={actions} />;
  if (active === 'crm') return <CrmWorkspace state={state} actions={actions} />;
  if (active === 'finance') return <FinanceWorkspace state={state} actions={actions} />;
  if (active === 'hr') return <TaskWorkspace title="HR Staffing Control" department="HR" state={state} actions={actions} />;
  return <OverviewWorkspace state={state} actions={actions} />;
}

function InventoryWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  return <TwoColumn leftTitle="Finished Products" rightTitle="Raw Materials & Reorder" left={state.products.map(product => <Row key={product.id} title={product.name} meta={`${product.sku} | ${kg(product.quantity_kg)} available`} tone={product.quantity_kg <= product.low_stock_threshold ? 'danger' : 'normal'}><button onClick={() => actions.adjustStock(product.id, 100, 'manual-react-adjustment')} className="btn-secondary">Add 100kg</button><button onClick={() => actions.adjustStock(product.id, -50, 'manual-react-reserve')} className="btn-primary">Reserve 50kg</button></Row>)} right={state.rawMaterials.map(material => <Row key={material.id} title={material.name} meta={`${kg(material.quantity_kg)} | Threshold ${kg(material.reorder_threshold_kg)} | ${material.supplier_name}`} tone={material.quantity_kg <= material.reorder_threshold_kg ? 'warn' : 'normal'}><button onClick={() => actions.log(`Reorder queued for ${material.name}`, 'Procurement')} className="btn-primary">Queue Reorder</button></Row>)} />;
}

function ProductionWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  const materialTasks = state.tasks.filter(task => task.department === 'Inventory');
  return <TwoColumn leftTitle="Production Batch Flow" rightTitle="Material Requests To Inventory" left={state.batches.map(batch => <Row key={batch.id} title={`${batch.product_name} | ${batch.batch_code}`} meta={`${kg(batch.target_qty_kg)} target | ${labelize(batch.status)} | Owner: ${batch.owner}`} tone={batch.status === 'qc_pending' ? 'warn' : 'normal'}><button onClick={() => actions.advanceBatch(batch.id)} className="btn-primary">Advance Stage</button></Row>)} right={[<div key="create" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-bold text-emerald-950">Start EKO Shoe Polish flow</h3><p className="mt-2 text-sm text-emerald-800">Creates a production batch and an Inventory material issue task.</p><button onClick={() => actions.createProductionRequest('EKO Shoe Polish', 50)} className="btn-primary mt-4">Request Materials</button></div>, ...materialTasks.map(task => <Row key={task.id} title={task.title} meta={`${task.owner} | ${labelize(task.status)}`} tone="normal"><button onClick={() => actions.completeTask(task.id)} className="btn-secondary">Mark Done</button></Row>)]} />;
}

function SalesWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  return <TwoColumn leftTitle="Orders" rightTitle="Invoice Readiness" left={state.orders.map(order => <Row key={order.id} title={`${order.order_number} | ${order.customer_name}`} meta={`${money(order.total_ksh)} | ${labelize(order.status)}`} tone={order.status === 'stock_blocked' ? 'danger' : 'normal'}><button onClick={() => actions.reserveOrder(order.id)} className="btn-primary">Check Stock</button></Row>)} right={state.invoices.map(invoice => <Row key={invoice.id} title={`${invoice.invoice_number} | ${invoice.customer_name}`} meta={`${money(invoice.paid_amount)} / ${money(invoice.amount)} | ${labelize(invoice.status)}`} tone={invoice.status === 'paid' ? 'normal' : 'warn'}><button onClick={() => actions.recordPayment(invoice.id, Math.min(10000, invoice.amount - invoice.paid_amount))} className="btn-secondary">Record Payment</button></Row>)} />;
}

function FinanceWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  return <TwoColumn leftTitle="Immutable Payment View" rightTitle="Reconciliation & Audit" left={state.invoices.map(invoice => <Row key={invoice.id} title={invoice.invoice_number} meta={`${invoice.customer_name} | Balance ${money(invoice.amount - invoice.paid_amount)}`} tone={invoice.status === 'paid' ? 'normal' : 'warn'}><button onClick={() => actions.recordPayment(invoice.id, invoice.amount - invoice.paid_amount)} className="btn-primary">Settle Balance</button></Row>)} right={state.auditEvents.slice(0, 6).map(event => <Row key={event.id} title={event.department} meta={event.message} tone="normal" />)} />;
}

function CrmWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  return <TwoColumn leftTitle="Customer Opportunities" rightTitle="CRM Actions" left={state.orders.map(order => <Row key={order.id} title={order.customer_name} meta={`${order.order_number} | ${labelize(order.status)}`} tone={order.status === 'stock_blocked' ? 'danger' : 'normal'}><button onClick={() => actions.reserveOrder(order.id)} className="btn-primary">Validate Demand</button></Row>)} right={state.tasks.filter(task => ['Sales', 'Production', 'Finance'].includes(task.department)).map(task => <Row key={task.id} title={task.title} meta={`${task.department} | ${task.owner}`} tone={task.priority === 'high' ? 'warn' : 'normal'}><button onClick={() => actions.completeTask(task.id)} className="btn-secondary">Close</button></Row>)} />;
}

function TaskWorkspace({ title, department, state, actions }: { title: string; department: string; state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  const rows = state.tasks.filter(task => task.department === department);
  return <TwoColumn leftTitle={title} rightTitle="Recent Audit Events" left={(rows.length ? rows : state.tasks).map(task => <Row key={task.id} title={task.title} meta={`${task.department} | ${task.owner} | ${labelize(task.status)}`} tone={task.priority === 'high' ? 'warn' : 'normal'}><button onClick={() => actions.completeTask(task.id)} className="btn-primary">Complete</button></Row>)} right={state.auditEvents.slice(0, 6).map(event => <Row key={event.id} title={event.department} meta={event.message} tone="normal" />)} />;
}

function OverviewWorkspace({ state, actions }: { state: BosState; actions: ReturnType<typeof useBosStore>['actions'] }) {
  return <TwoColumn leftTitle="Action Workflows" rightTitle="Department Handoffs" left={state.tasks.slice(0, 6).map(task => <Row key={task.id} title={task.title} meta={`${task.department} | ${task.owner} | ${labelize(task.status)}`} tone={task.priority === 'high' ? 'warn' : 'normal'}><button onClick={() => actions.completeTask(task.id)} className="btn-primary">Resolve</button></Row>)} right={state.auditEvents.slice(0, 6).map(event => <Row key={event.id} title={event.department} meta={event.message} tone="normal" />)} />;
}

function TwoColumn({ leftTitle, rightTitle, left, right }: { leftTitle: string; rightTitle: string; left: React.ReactNode[]; right: React.ReactNode[] }) {
  return <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"><Panel title={leftTitle}>{left.length ? left : <Empty />}</Panel><Panel title={rightTitle} eyebrow="Department Handoffs">{right.length ? right : <Empty />}</Panel></section>;
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5">{eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">{eyebrow}</p> : null}<h2 className="text-base font-bold text-slate-950">{title}</h2></div><div className="space-y-3 p-4">{children}</div></div>;
}

function Row({ title, meta, tone = 'normal', children }: { title: string; meta: string; tone?: 'normal' | 'warn' | 'danger'; children?: React.ReactNode }) {
  const toneClass = tone === 'danger' ? 'border-red-200 bg-red-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50';
  return <div className={`rounded-xl border p-4 transition motion-safe:hover:-translate-y-0.5 ${toneClass}`}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-1 text-sm text-slate-600">{meta}</p></div>{children ? <div className="flex flex-wrap gap-2">{children}</div> : null}</div></div>;
}

function Empty() {
  return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No active items.</div>;
}
