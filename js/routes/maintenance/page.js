// js/routes/maintenance/page.js
// Maintenance controller: work orders, assets, technicians, calendar, and department handoffs.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['maintenance_scheduling.html'] = bindMaintenancePage;
  window.bindMaintenancePage = bindMaintenancePage;

  if (document.readyState !== 'loading' && currentPage() === 'maintenance_scheduling.html') {
    window.setTimeout(bindMaintenancePage, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentPage() === 'maintenance_scheduling.html') window.setTimeout(bindMaintenancePage, 0);
    }, { once: true });
  }

  async function bindMaintenancePage() {
    await renderMaintenancePage();
  }

  async function renderMaintenancePage() {
    const model = buildMaintenanceModel();
    const main = document.querySelector('main');
    if (!main) return;
    main.className = 'pt-24 pb-12 px-margin max-w-container-max mx-auto w-full space-y-lg';
    main.innerHTML = template(model);
    bindControls(model);
    document.dispatchEvent(new CustomEvent('eden:content-updated'));
  }

  function buildMaintenanceModel() {
    const machines = readJson('eden_machines', window.productionModule?.MOCK_MACHINES || []);
    const maintenance = readJson('eden_maintenance', window.productionModule?.MOCK_MAINTENANCE || []);
    const tasks = readJson('eden_tasks', window.hrModule?.MOCK_TASKS || []);
    const employees = readJson('eden_employees', window.hrModule?.MOCK_EMPLOYEES || []);
    const batches = readJson('eden_production_batches', window.productionModule?.MOCK_PRODUCTION_BATCHES || []);
    const technicians = employees.filter(item => String(item.department || item.role || '').toLowerCase().includes('maintenance') || String(item.role || '').toLowerCase().includes('technician'));
    const workOrders = mergeWorkOrders(maintenance, tasks, machines);
    const open = workOrders.filter(item => !['completed', 'closed'].includes(String(item.status).toLowerCase()));
    const overdue = open.filter(item => isOverdue(item.scheduled_date || item.due_date));
    const urgent = open.filter(item => ['high', 'urgent', 'emergency'].includes(String(item.priority).toLowerCase()) || ['maintenance', 'offline'].includes(String(machineByName(machines, item.machine_name)?.status).toLowerCase()));
    return { machines, maintenance, tasks, employees, technicians, batches, workOrders, open, overdue, urgent };
  }

  function mergeWorkOrders(maintenance, tasks, machines) {
    const fromMaintenance = maintenance.map(item => ({
      id: item.id,
      source: 'maintenance',
      machine_id: item.machine_id || machineByName(machines, item.machine_name)?.id,
      machine_name: item.machine_name || item.title || 'Facility asset',
      type: item.type || item.maintenance_type || 'preventive',
      status: item.status || 'scheduled',
      priority: item.priority || 'medium',
      scheduled_date: item.scheduled_date || item.due_date,
      technician_name: item.technician_name || 'Unassigned',
      cost_ksh: Number(item.cost_ksh || item.cost || 0),
      notes: item.notes || ''
    }));
    const taskOrders = tasks
      .filter(task => ['Maintenance', 'Facilities'].includes(task.department) && task.status !== 'completed')
      .map(task => ({
        id: task.id,
        source: 'task',
        machine_id: task.machine_id,
        machine_name: task.machine_name || extractMachineName(task.title) || 'Facility task',
        type: 'task',
        status: task.status || 'open',
        priority: task.priority || 'medium',
        scheduled_date: task.due_date || task.created_at,
        technician_name: task.assigned_to_name || 'Maintenance desk',
        cost_ksh: 0,
        notes: task.description || ''
      }));
    const seen = new Set();
    return [...taskOrders, ...fromMaintenance]
      .filter(item => {
        const key = `${item.machine_name}:${item.type}:${item.status}:${item.scheduled_date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => statusRank(a) - statusRank(b) || new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));
  }

  function template(model) {
    return `
      <section class="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm p-lg">
        <div class="absolute inset-0 pointer-events-none opacity-70 bg-[linear-gradient(90deg,rgba(0,108,3,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(0,108,3,0.045)_1px,transparent_1px)] [background-size:26px_26px]"></div>
        <div class="relative flex flex-col lg:flex-row lg:items-center justify-between gap-lg">
          <div class="max-w-2xl">
            <p class="font-label-md text-label-md text-primary uppercase">Maintenance Control</p>
            <h1 class="font-headline-xl text-headline-xl text-on-surface">Maintenance Scheduling</h1>
            <p class="font-body-md text-body-md text-on-surface-variant mt-xs">Plan work orders, clear production blockers, assign technicians, and push part requests to Inventory.</p>
          </div>
          <div class="grid grid-cols-3 gap-sm min-w-[min(100%,360px)]">
            ${miniStat('Open', model.open.length)}
            ${miniStat('Urgent', model.urgent.length)}
            ${miniStat('Assets', model.machines.length)}
          </div>
        </div>
        <div class="relative mt-lg flex flex-wrap gap-sm">
          <button type="button" data-maint-action="new" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">add</span>Ticket</button>
          <button type="button" data-maint-action="parts" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">inventory_2</span>Parts</button>
          <button type="button" data-maint-action="forecast" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">monitoring</span>Forecast</button>
          <button type="button" data-maint-action="export" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">download</span>Export</button>
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-lg items-start">
        <section class="xl:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <div class="flex items-center justify-between mb-md">
            <h2 class="font-headline-sm text-headline-sm">Priority Board</h2>
            <button type="button" data-maint-action="triage" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Triage</button>
          </div>
          <div class="space-y-xs">
            ${handoffs(model).map(item => inboxRow(item)).join('') || emptyBlock('No blockers.')}
          </div>
        </section>

        <section class="xl:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-sm mb-md">
            <h2 class="font-headline-md text-headline-md">Work Orders</h2>
            <div class="flex flex-wrap gap-xs">
              ${['all', 'urgent', 'scheduled', 'completed'].map(filter => `<button type="button" data-maint-filter="${filter}" class="px-sm py-xs rounded-full border border-outline-variant font-label-sm text-label-sm">${formatLabel(filter)}</button>`).join('')}
            </div>
          </div>
          <div data-maint-order-list class="space-y-xs">
            ${model.workOrders.map(orderRow).join('') || emptyBlock('No work orders.')}
          </div>
        </section>

        <aside class="xl:col-span-3 space-y-lg">
          <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
            <div class="flex items-center justify-between mb-md">
              <h3 class="font-headline-sm text-headline-sm">Technicians</h3>
              <button type="button" data-maint-action="new" class="material-symbols-outlined p-xs rounded-full hover:bg-surface-container-high">add</button>
            </div>
            <div class="space-y-xs">${(model.technicians.length ? model.technicians : model.employees.slice(0, 3)).map(techRow).join('')}</div>
          </section>
          <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
            <h3 class="font-headline-sm text-headline-sm mb-md">Analysis</h3>
            ${analysisPanel(model)}
          </section>
        </aside>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <section class="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h3 class="font-headline-sm text-headline-sm mb-md">Asset Health</h3>
          <div class="space-y-xs">${model.machines.map(machineRow).join('')}</div>
        </section>
        <section class="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <div class="flex items-center justify-between mb-md">
            <h3 class="font-headline-sm text-headline-sm">Schedule Board</h3>
            <button type="button" data-maint-action="calendar" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Open</button>
          </div>
          <div class="grid grid-cols-7 gap-xs">${calendarCells(model).join('')}</div>
        </section>
      </section>
      <div class="h-28"></div>
    `;
  }

  function kpi(key, label, value, icon, hint) {
    return `<button type="button" data-maint-kpi="${key}" class="text-left p-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm hover:border-primary transition-all">
      <div class="flex items-center justify-between gap-sm"><span class="font-label-md text-label-md text-on-surface-variant">${label}</span><span class="material-symbols-outlined text-primary">${icon}</span></div>
      <p class="font-headline-lg text-headline-lg text-primary mt-xs">${value}</p>
      <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
    </button>`;
  }

  function miniStat(label, value) {
    return `<button type="button" data-maint-kpi="${label.toLowerCase() === 'assets' ? 'assets' : label.toLowerCase()}" class="p-sm rounded-lg border border-outline-variant bg-white/70 text-left hover:border-primary transition-all">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</span>
      <span class="block font-headline-md text-headline-md text-primary">${value}</span>
    </button>`;
  }

  function orderRow(order) {
    return `<button type="button" data-maint-order="${order.id}" data-maint-status="${String(order.status).toLowerCase()}" data-maint-priority="${String(order.priority).toLowerCase()}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex items-center justify-between gap-md">
      <span class="min-w-0">
        <span class="font-headline-sm text-headline-sm text-on-surface truncate block">${order.machine_name}</span>
        <span class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(order.type)} • ${order.technician_name} • ${formatDate(order.scheduled_date)}</span>
      </span>
      <span class="flex items-center gap-xs shrink-0">${statusBadge(order.status)}<span class="material-symbols-outlined text-primary">chevron_right</span></span>
    </button>`;
  }

  function inboxRow(item) {
    return `<button type="button" data-maint-inbox="${item.type}:${item.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex justify-between gap-md">
      <span class="min-w-0"><span class="font-label-md text-label-md truncate block">${item.title}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${item.meta}</span></span>
      <span class="material-symbols-outlined text-primary">${item.icon}</span>
    </button>`;
  }

  function techRow(employee) {
    const assigned = readJson('eden_maintenance', []).filter(item => item.technician_id === employee.id || item.technician_name === employee.full_name).length;
    return `<button type="button" data-maint-tech="${employee.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex justify-between gap-md">
      <span><span class="font-label-md text-label-md block">${employee.full_name}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${employee.position || employee.role}</span></span>
      <span class="text-primary font-label-md">${assigned}</span>
    </button>`;
  }

  function machineRow(machine) {
    const risk = machine.status === 'maintenance' ? 92 : machine.status === 'offline' ? 100 : 38;
    return `<button type="button" data-maint-machine="${machine.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all">
      <div class="flex justify-between gap-sm"><span class="font-label-md text-label-md">${machine.name}</span>${statusBadge(machine.status)}</div>
      <div class="mt-xs h-2 rounded-full bg-surface-container-highest overflow-hidden"><div class="${risk > 80 ? 'bg-error' : 'bg-primary'} h-full" style="width:${risk}%"></div></div>
      <p class="font-body-sm text-body-sm text-on-surface-variant mt-xs">${machine.location || 'Plant'} • ${Number(machine.capacity_kg_hr || 0)} kg/hr</p>
    </button>`;
  }

  function calendarCells(model) {
    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const iso = date.toISOString().slice(0, 10);
      const count = model.open.filter(item => String(item.scheduled_date || item.due_date || '').slice(0, 10) === iso).length;
      return `<button type="button" data-maint-day="${iso}" class="min-h-16 p-xs rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all text-left">
        <span class="font-label-sm text-label-sm">${date.toLocaleDateString('en-KE', { day: 'numeric' })}</span>
        <span class="block font-headline-sm text-headline-sm ${count ? 'text-primary' : 'text-on-surface-variant'}">${count}</span>
      </button>`;
    });
  }

  function analysisPanel(model) {
    const cost = model.workOrders.reduce((sum, item) => sum + Number(item.cost_ksh || 0), 0);
    const availability = Math.round((model.machines.filter(item => item.status === 'operational').length / Math.max(model.machines.length, 1)) * 100);
    return `<div class="space-y-sm">
      ${metric('Asset Availability', `${availability}%`)}
      ${metric('Open Cost Exposure', money(cost))}
      ${metric('Production Blockers', model.urgent.length)}
      <button type="button" data-maint-action="forecast" class="w-full px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Open Forecast</button>
    </div>`;
  }

  function metric(label, value) {
    return `<div class="p-sm rounded-lg border border-outline-variant bg-surface-container-low flex justify-between gap-md"><span class="text-on-surface-variant">${label}</span><strong>${value}</strong></div>`;
  }

  function handoffs(model) {
    const seen = new Set();
    return [
      ...model.machines.filter(item => item.status === 'maintenance').map(item => ({ type: 'machine', id: item.id, title: `${item.name} blocks Production`, meta: item.location || 'Production hall', icon: 'precision_manufacturing' })),
      ...model.tasks.filter(task => task.source_module === 'facility_map' && task.status !== 'completed').map(item => ({ type: 'task', id: item.id, title: item.title, meta: formatLabel(item.status), icon: 'assignment' })),
      ...model.open.slice(0, 2).map(item => ({ type: 'order', id: item.id, title: item.machine_name, meta: `${formatLabel(item.status)} • ${formatLabel(item.priority)}`, icon: 'build' }))
    ].filter(item => {
      const key = `${item.title}:${item.meta}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }

  function bindControls(model) {
    document.querySelectorAll('[data-maint-order]').forEach(button => bindOnce(button, () => showOrder(model.workOrders.find(item => item.id === button.dataset.maintOrder), model)));
    document.querySelectorAll('[data-maint-machine]').forEach(button => bindOnce(button, () => showMachine(model.machines.find(item => item.id === button.dataset.maintMachine), model)));
    document.querySelectorAll('[data-maint-tech]').forEach(button => bindOnce(button, () => showTechnician(model.employees.find(item => item.id === button.dataset.maintTech), model)));
    document.querySelectorAll('[data-maint-kpi]').forEach(button => bindOnce(button, () => showKpi(button.dataset.maintKpi, model)));
    document.querySelectorAll('[data-maint-action]').forEach(button => bindOnce(button, () => handleAction(button.dataset.maintAction, model)));
    document.querySelectorAll('[data-maint-inbox]').forEach(button => bindOnce(button, () => handleInbox(button.dataset.maintInbox, model)));
    document.querySelectorAll('[data-maint-filter]').forEach(button => bindOnce(button, () => filterOrders(button.dataset.maintFilter)));
    document.querySelectorAll('[data-maint-day]').forEach(button => bindOnce(button, () => showDay(button.dataset.maintDay, model)));
  }

  function showOrder(order, model) {
    if (!order) return;
    const overlay = createModal(order.machine_name, `
      ${detailGrid([['Type', formatLabel(order.type)], ['Status', formatLabel(order.status)], ['Priority', formatLabel(order.priority)], ['Due', formatDate(order.scheduled_date)], ['Technician', order.technician_name], ['Cost', money(order.cost_ksh)]])}
      <p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${order.notes || 'No notes captured.'}</p>
      <div class="flex flex-wrap justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
        <button type="button" data-order-start class="px-md py-sm border border-primary text-primary rounded-full">Start</button>
        <button type="button" data-order-complete class="px-md py-sm bg-primary text-on-primary rounded-full">Complete</button>
      </div>
    `);
    overlay.querySelector('[data-order-start]')?.addEventListener('click', () => updateOrder(order, 'in_progress', overlay));
    overlay.querySelector('[data-order-complete]')?.addEventListener('click', () => updateOrder(order, 'completed', overlay));
  }

  function showMachine(machine, model) {
    if (!machine) return;
    const overlay = createModal(machine.name, `
      <form data-machine-form class="space-y-md">
        ${detailGrid([['Type', formatLabel(machine.type)], ['Location', machine.location], ['Capacity', `${machine.capacity_kg_hr || 0} kg/hr`], ['Next Maintenance', machine.next_maintenance || 'Not set']])}
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Update Role</p>
          <p class="font-body-md text-body-md text-on-surface">Maintenance Lead or assigned Technician. Maintenance/Offline status creates a Production blocker automatically.</p>
        </div>
        ${selectField('status', 'Status', [['operational', 'Operational'], ['maintenance', 'Maintenance'], ['offline', 'Offline']], machine.status || 'operational')}
        ${textField('next_maintenance', 'Next maintenance', machine.next_maintenance || new Date().toISOString().slice(0, 10), 'date')}
        ${modalActions('Update Asset')}
      </form>
    `, 'Asset Control');
    overlay.querySelector('[data-machine-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      updateMachine(machine.id, { status: data.get('status'), next_maintenance: data.get('next_maintenance') });
      if (data.get('status') !== 'operational') createMaintenance(machine, data.get('status'));
      overlay.remove();
      renderMaintenancePage();
    });
  }

  function showTechnician(employee, model) {
    if (!employee) return;
    const assigned = model.workOrders.filter(item => item.technician_name === employee.full_name);
    createModal(employee.full_name, `
      ${detailGrid([['Role', employee.position || employee.role], ['Department', employee.department], ['Phone', employee.phone], ['Open Orders', assigned.length]])}
      <div class="mt-md space-y-xs">${assigned.map(orderRow).join('') || emptyBlock('No assigned orders.')}</div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `, 'Technician');
  }

  function showKpi(key, model) {
    const rows = key === 'urgent' ? model.urgent : key === 'overdue' ? model.overdue : key === 'assets' ? model.machines : model.open;
    createModal('Maintenance Analysis', `<div class="space-y-xs">${rows.map(item => `<button type="button" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">${item.machine_name || item.name} • ${formatLabel(item.status)}</button>`).join('') || emptyBlock('No records.')}</div><div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`);
  }

  function handleAction(action, model) {
    if (action === 'new') return showNewTicket(model);
    if (action === 'parts') return showPartsRequest(model);
    if (action === 'triage') return showKpi('urgent', model);
    if (action === 'calendar') return showCalendar(model);
    if (action === 'forecast') return showForecast(model);
    if (action === 'export') return exportCsv(model);
  }

  function handleInbox(value, model) {
    const [type, id] = String(value || '').split(':');
    if (type === 'machine') return showMachine(model.machines.find(item => item.id === id), model);
    if (type === 'task') return showTask(model.tasks.find(item => item.id === id));
    if (type === 'order') return showOrder(model.workOrders.find(item => item.id === id), model);
  }

  function showNewTicket(model) {
    const overlay = createModal('Create Maintenance Ticket', `
      <form data-ticket-form class="space-y-md">
        ${selectField('machine_id', 'Asset', model.machines.map(item => [item.id, item.name]))}
        ${selectField('type', 'Type', [['preventive', 'Preventive'], ['corrective', 'Corrective'], ['safety', 'Safety'], ['inspection', 'Inspection']])}
        ${selectField('priority', 'Priority', [['medium', 'Medium'], ['high', 'High'], ['low', 'Low']])}
        ${textField('scheduled_date', 'Due date', new Date().toISOString().slice(0, 10), 'date')}
        ${textareaField('notes', 'Notes')}
        ${modalActions('Create Ticket')}
      </form>
    `);
    overlay.querySelector('[data-ticket-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const machine = model.machines.find(item => item.id === data.get('machine_id')) || {};
      addMaintenance({
        machine_id: machine.id,
        machine_name: machine.name,
        type: data.get('type'),
        priority: data.get('priority'),
        scheduled_date: data.get('scheduled_date'),
        notes: data.get('notes'),
        technician_name: 'Maintenance desk',
        cost_ksh: 0
      });
      overlay.remove();
      renderMaintenancePage();
    });
  }

  function showPartsRequest(model) {
    const overlay = createModal('Parts Request', `
      <form data-parts-form class="space-y-md">
        ${selectField('machine_id', 'Asset', model.machines.map(item => [item.id, item.name]))}
        ${textField('part', 'Part needed', 'Belt, bearing, sensor, blade')}
        ${textField('quantity', 'Quantity', '1', 'number')}
        ${modalActions('Send To Inventory')}
      </form>
    `, 'Inventory Handoff');
    overlay.querySelector('[data-parts-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const machine = model.machines.find(item => item.id === data.get('machine_id')) || {};
      createTask(`Spare part needed: ${data.get('part')}`, `Maintenance needs ${data.get('quantity')} x ${data.get('part')} for ${machine.name}.`, 'Inventory', 'high');
      overlay.remove();
      renderMaintenancePage();
    });
  }

  function showCalendar(model) {
    createModal('Schedule Board', `<div class="grid grid-cols-7 gap-xs">${calendarCells(model).join('')}</div><div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Maintenance Calendar', 'max-w-5xl');
  }

  function showForecast(model) {
    const offlineRisk = model.machines.filter(item => item.status !== 'operational').length;
    createModal('Maintenance Forecast', `${detailGrid([['Asset Availability', `${Math.round((model.machines.length - offlineRisk) / Math.max(model.machines.length, 1) * 100)}%`], ['Urgent Orders', model.urgent.length], ['Overdue Orders', model.overdue.length], ['Likely Production Impact', offlineRisk ? 'High' : 'Low']])}<div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Predictive Maintenance');
  }

  function showDay(day, model) {
    const rows = model.open.filter(item => String(item.scheduled_date || item.due_date || '').slice(0, 10) === day);
    const overlay = createModal(formatDate(day), `<div class="space-y-xs">${rows.map(orderRow).join('') || emptyBlock('No work scheduled.')}</div><div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`);
    overlay.querySelectorAll('[data-maint-order]').forEach(button => {
      button.addEventListener('click', () => showOrder(rows.find(item => item.id === button.dataset.maintOrder), model));
    });
  }

  function showTask(task) {
    if (!task) return;
    const overlay = createModal(task.title, `
      ${detailGrid([['Department', task.department], ['Priority', formatLabel(task.priority)], ['Status', formatLabel(task.status)], ['Source', formatLabel(task.source_module)]])}
      <p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${task.description || 'No notes.'}</p>
      <div class="mt-md grid grid-cols-1 sm:grid-cols-3 gap-sm">
        <button type="button" data-task-start class="px-md py-sm border border-primary text-primary rounded-full">Start</button>
        <button type="button" data-task-workorder class="px-md py-sm border border-outline rounded-full">Work Order</button>
        <button type="button" data-task-complete class="px-md py-sm bg-primary text-on-primary rounded-full">Resolve</button>
      </div>
      <div class="flex justify-between flex-wrap gap-sm pt-md">
        <button type="button" data-task-source class="px-md py-sm border border-outline rounded-full">Open Source</button>
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
      </div>
    `, 'Task Action');
    overlay.querySelector('[data-task-start]')?.addEventListener('click', () => updateTask(task.id, 'in_progress', overlay));
    overlay.querySelector('[data-task-complete]')?.addEventListener('click', () => updateTask(task.id, 'completed', overlay));
    overlay.querySelector('[data-task-workorder]')?.addEventListener('click', () => {
      const machine = readJson('eden_machines', []).find(item => task.title?.includes(item.name)) || readJson('eden_machines', [])[0] || {};
      addMaintenance({ machine_id: machine.id, machine_name: machine.name || task.title, type: 'corrective', priority: task.priority || 'medium', scheduled_date: new Date().toISOString().slice(0, 10), technician_name: 'Maintenance desk', notes: task.description || task.title });
      updateTask(task.id, 'in_progress', overlay);
    });
    overlay.querySelector('[data-task-source]')?.addEventListener('click', () => {
      const target = task.department === 'Production' ? 'production_monitoring.html' : task.department === 'Inventory' ? 'supplier_inventory.html' : task.source_module === 'facility_map' ? 'facility_map.html' : 'operations_overview.html';
      window.location.href = pageHref(target);
    });
  }

  function updateOrder(order, status, overlay) {
    if (order.source === 'maintenance') {
      const list = readJson('eden_maintenance', []);
      localStorage.setItem('eden_maintenance', JSON.stringify(list.map(item => item.id === order.id ? { ...item, status, completed_date: status === 'completed' ? new Date().toISOString().slice(0, 10) : item.completed_date } : item)));
      if (status === 'completed' && order.machine_id) updateMachine(order.machine_id, { status: 'operational', last_maintenance: new Date().toISOString().slice(0, 10) });
    } else {
      const tasks = readJson('eden_tasks', []);
      localStorage.setItem('eden_tasks', JSON.stringify(tasks.map(item => item.id === order.id ? { ...item, status } : item)));
    }
    overlay?.remove();
    renderMaintenancePage();
  }

  function updateTask(id, status, overlay) {
    const tasks = readJson('eden_tasks', []);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks.map(item => item.id === id ? {
      ...item,
      status,
      updated_at: new Date().toISOString(),
      completed_at: status === 'completed' ? new Date().toISOString() : item.completed_at
    } : item)));
    overlay?.remove();
    renderMaintenancePage();
  }

  function filterOrders(filter) {
    document.querySelectorAll('[data-maint-filter]').forEach(btn => btn.classList.toggle('bg-primary', btn.dataset.maintFilter === filter));
    document.querySelectorAll('[data-maint-order]').forEach(row => {
      const show = filter === 'all' || row.dataset.maintStatus === filter || row.dataset.maintPriority === filter || (filter === 'urgent' && ['high', 'urgent', 'emergency'].includes(row.dataset.maintPriority));
      row.classList.toggle('hidden', !show);
    });
  }

  function createMaintenance(machine, status) {
    addMaintenance({
      machine_id: machine.id,
      machine_name: machine.name,
      type: 'corrective',
      priority: status === 'offline' ? 'high' : 'medium',
      scheduled_date: new Date().toISOString().slice(0, 10),
      technician_name: 'Maintenance desk',
      notes: `${machine.name} marked ${formatLabel(status)} from Maintenance Scheduling.`
    });
    createTask(`Production asset unavailable: ${machine.name}`, `${machine.name} is ${formatLabel(status)}. Production should avoid assigning new batches until cleared.`, 'Production', 'high');
  }

  function addMaintenance(payload) {
    const list = readJson('eden_maintenance', []);
    list.unshift({ id: `maint-${Date.now()}`, status: 'scheduled', cost_ksh: 0, ...payload });
    localStorage.setItem('eden_maintenance', JSON.stringify(list));
  }

  function updateMachine(id, updates) {
    const machines = readJson('eden_machines', []);
    localStorage.setItem('eden_machines', JSON.stringify(machines.map(item => item.id === id ? { ...item, ...updates } : item)));
  }

  function createTask(title, description, department, priority = 'medium') {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({ id: `task-maint-${Date.now()}`, title, description, department, priority, status: 'open', source_module: 'maintenance_scheduling', created_at: new Date().toISOString() });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function exportCsv(model) {
    const rows = [['Asset', 'Type', 'Technician', 'Status', 'Due', 'Priority'], ...model.workOrders.map(item => [item.machine_name, item.type, item.technician_name, item.status, item.scheduled_date, item.priority])];
    downloadTextFile(`eden-maintenance-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'));
  }

  function machineByName(machines, name) { return machines.find(item => item.name === name || item.id === name) || null; }
  function extractMachineName(title = '') { return String(title).replace(/^Maintenance required:\s*/i, '').replace(/^Work order:\s*/i, ''); }
  function isOverdue(value) { if (!value) return false; return new Date(value) < new Date(new Date().toISOString().slice(0, 10)); }
  function statusRank(item) { const status = String(item.status || '').toLowerCase(); if (isOverdue(item.scheduled_date)) return 0; if (['high', 'urgent', 'emergency'].includes(String(item.priority).toLowerCase())) return 1; if (status === 'in_progress') return 2; if (status === 'scheduled') return 3; if (status === 'completed') return 9; return 4; }
  function statusBadge(status = 'open') { const key = String(status).toLowerCase(); const cls = ['completed', 'operational'].includes(key) ? 'bg-primary/10 text-primary' : ['overdue', 'offline', 'maintenance'].includes(key) ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'; return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatLabel(status)}</span>`; }
  function detailGrid(rows) { return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`).join('')}</dl>`; }
  function selectField(name, label, options, selected) { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">${options.map(([value, text]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`; }
  function textField(name, label, value = '', type = 'text') { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" type="${type}" value="${value}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>`; }
  function textareaField(name, label) { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><textarea name="${name}" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></textarea></label>`; }
  function modalActions(label) { return `<div class="flex justify-end gap-sm pt-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Cancel</button><button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full">${label}</button></div>`; }
  function emptyBlock(text) { return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`; }
  function formatLabel(value) { return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function formatDate(value) { if (!value) return 'Not set'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }); }
  function money(value) { return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`; }
  function bindOnce(element, handler) { if (!element || element.dataset.maintBound) return; element.dataset.maintBound = 'true'; element.addEventListener('click', handler); }
  function readJson(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; } }
  function pageHref(page) { return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page; }
  function currentPage() { return window.location.pathname.split('/').pop(); }
  function createModal(title, bodyHtml, eyebrow = 'Maintenance Control', maxWidthClass = 'max-w-4xl') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `<div class="w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card><div class="flex items-start justify-between gap-md mb-md"><div><p class="font-label-sm text-label-sm text-primary uppercase">${eyebrow}</p><h3 class="font-headline-md text-headline-md text-on-surface">${title}</h3></div><button type="button" data-modal-close class="material-symbols-outlined p-xs rounded-full hover:bg-surface-container-high">close</button></div>${bodyHtml}</div>`;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('[data-modal-card]');
    requestAnimationFrame(() => { card.classList.remove('scale-95', 'opacity-0'); card.classList.add('scale-100', 'opacity-100'); });
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-modal-close]')) overlay.remove(); });
    setTimeout(() => document.dispatchEvent(new CustomEvent('eden:content-updated')), 50);
    return overlay;
  }
  function downloadTextFile(filename, content, mimeType = 'text/csv') { const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
})();
