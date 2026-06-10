// js/routes/facility/page.js
// Facility control layer: spatial operations, asset health, safety, and department handoffs.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['facility_map.html'] = bindFacilityPage;
  window.bindFacilityPage = bindFacilityPage;
  if (document.readyState !== 'loading' && currentPage() === 'facility_map.html') {
    window.setTimeout(bindFacilityPage, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentPage() === 'facility_map.html') window.setTimeout(bindFacilityPage, 0);
    }, { once: true });
  }

  async function bindFacilityPage() {
    await renderFacilityPage();
  }

  async function renderFacilityPage() {
    const model = await buildFacilityModel();
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = facilityTemplate(model);
    bindFacilityControls(model);
    document.dispatchEvent(new CustomEvent('eden:content-updated'));
  }

  async function buildFacilityModel() {
    const machines = readJson('eden_machines', window.productionModule?.MOCK_MACHINES || []);
    const maintenance = readJson('eden_maintenance', window.productionModule?.MOCK_MAINTENANCE || []);
    const raw = readJson('eden_raw_materials', window.inventoryModule?.MOCK_RAW_MATERIALS || []);
    const finished = readJson('eden_finished_products', window.inventoryModule?.MOCK_FINISHED_PRODUCTS || []);
    const collections = readJson('eden_collections', window.collectionModule?.MOCK_COLLECTIONS || []);
    const employees = readJson('eden_employees', window.hrModule?.MOCK_EMPLOYEES || []);
    const tasks = readJson('eden_tasks', window.hrModule?.MOCK_TASKS || []);
    const batches = readJson('eden_production_batches', window.productionModule?.MOCK_PRODUCTION_BATCHES || []);
    const openMaintenance = maintenance.filter(item => !['completed', 'closed'].includes(String(item.status).toLowerCase()));
    const criticalAssets = machines.filter(item => ['maintenance', 'critical', 'offline'].includes(String(item.status).toLowerCase()));
    const lowStock = raw.filter(item => Number(item.quantity_kg || 0) <= Number(item.reorder_threshold_kg || 0));
    const onsite = employees.filter(item => String(item.status || 'active') === 'active');
    const inTransit = collections.filter(item => ['in_transit', 'scheduled'].includes(String(item.status).toLowerCase()));
    const activeBatches = batches.filter(item => !['completed', 'rejected'].includes(String(item.status).toLowerCase()));
    const zones = buildZones({ machines, maintenance, raw, finished, collections, employees, tasks, batches, openMaintenance, criticalAssets, lowStock, onsite, inTransit, activeBatches });
    return { machines, maintenance, raw, finished, collections, employees, tasks, batches, openMaintenance, criticalAssets, lowStock, onsite, inTransit, activeBatches, zones };
  }

  function buildZones(model) {
    const byLocation = name => model.machines.filter(machine => String(machine.location || '').toLowerCase().includes(name));
    return [
      {
        id: 'collection',
        name: 'Collection Bay',
        icon: 'local_shipping',
        status: model.inTransit.length ? 'busy' : 'optimal',
        metric: `${model.inTransit.length} active`,
        x: 5, y: 8, w: 30, h: 36,
        department: 'Waste Collection',
        href: 'waste_collection.html',
        detail: 'Inbound vehicles, school pickups, weigh-slip intake.',
        assets: model.collections.slice(0, 4).map(item => ({ id: item.id, name: item.school_name || item.id, meta: `${formatLabel(item.status)} • ${Number(item.weight_kg || 0)} kg`, type: 'collection' }))
      },
      {
        id: 'sorting',
        name: 'Sorting Area',
        icon: 'category',
        status: model.lowStock.length ? 'watch' : 'optimal',
        metric: `${sum(model.raw, 'quantity_kg').toLocaleString('en-KE')} kg`,
        x: 40, y: 8, w: 55, h: 22,
        department: 'Inventory',
        href: 'supplier_inventory.html',
        detail: 'Raw material staging and quality separation.',
        assets: model.raw.slice(0, 5).map(item => ({ id: item.id, name: item.name, meta: `${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg • ${statusFromStock(item)}`, type: 'material' }))
      },
      {
        id: 'production',
        name: 'Production Hall',
        icon: 'factory',
        status: model.criticalAssets.length ? 'critical' : model.activeBatches.length ? 'busy' : 'optimal',
        metric: `${model.activeBatches.length} cycles`,
        x: 40, y: 36, w: 55, h: 38,
        department: 'Production',
        href: 'production_monitoring.html',
        detail: 'Machines, batch cycles, QC handoff and line capacity.',
        assets: [...model.machines, ...model.activeBatches].slice(0, 6).map(item => ({ id: item.id, name: item.name || item.batch_number || item.product_name, meta: item.capacity_kg_hr ? `${formatLabel(item.status)} • ${item.capacity_kg_hr} kg/hr` : `${item.product_name} • ${formatLabel(item.status)}`, type: item.capacity_kg_hr ? 'machine' : 'batch' }))
      },
      {
        id: 'storage',
        name: 'Storage',
        icon: 'inventory_2',
        status: model.lowStock.length ? 'watch' : 'optimal',
        metric: `${sum(model.finished, 'quantity_kg').toLocaleString('en-KE')} kg`,
        x: 5, y: 50, w: 30, h: 43,
        department: 'Inventory',
        href: 'supplier_inventory.html',
        detail: 'Finished products, packaging, dispatch-ready stock.',
        assets: model.finished.slice(0, 5).map(item => ({ id: item.id, name: item.name, meta: `${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg • ${formatLabel(item.status)}`, type: 'finished' }))
      },
      {
        id: 'admin',
        name: 'Admin & Safety',
        icon: 'corporate_fare',
        status: model.tasks.some(task => ['Safety', 'HR', 'Maintenance'].includes(task.department) && task.status !== 'completed') ? 'watch' : 'optimal',
        metric: `${model.onsite.length} staff`,
        x: 40, y: 80, w: 55, h: 13,
        department: 'HR',
        href: 'hr_staffing.html',
        detail: 'Staffing, safety desk, incident response and approvals.',
        assets: model.employees.slice(0, 5).map(item => ({ id: item.id, name: item.full_name, meta: `${item.department || 'Team'} • ${item.position || item.role}`, type: 'staff' }))
      }
    ];
  }

  function facilityTemplate(model) {
    return `
      <section class="mb-lg flex flex-col lg:flex-row lg:items-end justify-between gap-md">
        <div>
          <p class="font-label-md text-label-md text-primary uppercase">Facility Command</p>
          <h1 class="font-headline-xl text-headline-xl text-on-surface">Facility Map</h1>
          <p class="font-body-md text-body-md text-on-surface-variant max-w-2xl">Live plant zones, assets, staff, storage, and department handoffs.</p>
        </div>
        <div class="flex flex-wrap gap-sm">
          <button type="button" data-facility-action="workorder" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">add_task</span>Work Order</button>
          <button type="button" data-facility-action="safety" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">health_and_safety</span>Safety</button>
          <button type="button" data-facility-action="export" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md flex items-center gap-xs"><span class="material-symbols-outlined">download</span>Export</button>
        </div>
      </section>

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
        ${kpiCard('critical', 'Critical Assets', model.criticalAssets.length, 'build', 'Open maintenance')}
        ${kpiCard('stock', 'Storage Pressure', `${model.lowStock.length}`, 'inventory_2', 'Low-stock zones')}
        ${kpiCard('people', 'Staff On Site', model.onsite.length, 'groups', 'HR coverage')}
        ${kpiCard('flow', 'Moving Loads', model.inTransit.length, 'route', 'Collection flow')}
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-lg">
        <div class="xl:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div class="p-md border-b border-outline-variant flex flex-wrap items-center justify-between gap-sm">
            <div class="flex items-center gap-md">
              <h2 class="font-headline-sm text-headline-sm">HQ Level 01</h2>
              <div class="flex rounded-full border border-outline-variant overflow-hidden">
                ${['2D', 'Heat', 'Assets'].map((mode, index) => `<button type="button" data-facility-map-mode="${mode.toLowerCase()}" class="px-sm py-xs font-label-sm text-label-sm ${index === 0 ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low'}">${mode}</button>`).join('')}
              </div>
            </div>
            <div class="flex gap-xs">
              ${['zoom_in', 'zoom_out', 'center_focus_strong'].map(icon => `<button type="button" data-facility-tool="${icon}" class="material-symbols-outlined w-10 h-10 rounded-full border border-outline-variant hover:bg-surface-container-low">${icon}</button>`).join('')}
            </div>
          </div>
          <div data-facility-map data-map-mode="2d" class="relative min-h-[600px] bg-[radial-gradient(#dfe7e0_1px,transparent_1px)] [background-size:24px_24px] p-md overflow-hidden transition-all">
            <div data-facility-map-plane class="relative h-[560px] rounded-xl border border-dashed border-outline-variant bg-surface-container-low/80 overflow-hidden transition-transform duration-300 origin-center">
              ${model.zones.map(zoneBlock).join('')}
              ${assetDots(model).join('')}
              <div class="absolute left-4 bottom-4 max-w-sm rounded-xl bg-white/85 backdrop-blur border border-outline-variant p-sm shadow-sm">
                <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Selected Zone</p>
                <p data-facility-selected class="font-headline-sm text-headline-sm text-primary">Click a zone</p>
              </div>
            </div>
          </div>
        </div>

        <aside class="xl:col-span-4 space-y-lg">
          <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
            <div class="flex items-center justify-between mb-md">
              <h3 class="font-headline-sm text-headline-sm">Facility Inbox</h3>
              <button type="button" data-facility-action="triage" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Triage</button>
            </div>
            <div class="space-y-xs">${facilityInbox(model).join('') || emptyBlock('No facility blockers.')}</div>
          </section>
          <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
            <div class="flex items-center justify-between mb-md">
              <h3 class="font-headline-sm text-headline-sm">Asset Health</h3>
              <button type="button" data-facility-action="diagnostics" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Run</button>
            </div>
            <div class="space-y-sm">${model.machines.map(assetHealthRow).join('')}</div>
          </section>
        </aside>
      </section>

      <section class="mt-lg grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h3 class="font-headline-sm text-headline-sm mb-md">Maintenance Queue</h3>
          <div class="space-y-xs">${model.openMaintenance.slice(0, 5).map(maintenanceRow).join('') || emptyBlock('No open maintenance.')}</div>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h3 class="font-headline-sm text-headline-sm mb-md">Zone Analytics</h3>
          <div class="space-y-sm">${model.zones.map(zoneMetricRow).join('')}</div>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h3 class="font-headline-sm text-headline-sm mb-md">Facility Controls</h3>
          <div class="grid grid-cols-1 gap-xs">
            ${[
              ['lockdown', 'Safety Override', 'security'],
              ['lighting', 'Lighting Control', 'light_mode'],
              ['iot', 'IoT Network', 'router'],
              ['energy', 'Energy Scan', 'bolt']
            ].map(([key, label, icon]) => `<button type="button" data-facility-control="${key}" class="p-sm rounded-lg border border-outline-variant bg-surface-container-low text-left flex items-center justify-between gap-md"><span class="flex items-center gap-sm"><span class="material-symbols-outlined text-primary">${icon}</span><span class="font-label-md text-label-md">${label}</span></span><span class="material-symbols-outlined text-on-surface-variant">chevron_right</span></button>`).join('')}
          </div>
        </div>
      </section>
      <div class="h-28"></div>
    `;
  }

  function kpiCard(key, label, value, icon, hint) {
    return `<button type="button" data-facility-kpi="${key}" class="text-left p-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm hover:border-primary transition-all">
      <div class="flex items-center justify-between gap-sm"><span class="font-label-md text-label-md text-on-surface-variant">${label}</span><span class="material-symbols-outlined text-primary">${icon}</span></div>
      <p class="font-headline-lg text-headline-lg text-primary mt-xs">${value}</p>
      <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
    </button>`;
  }

  function zoneBlock(zone) {
    const color = zone.status === 'critical' ? 'border-error text-error bg-error-container/25' : zone.status === 'watch' ? 'border-tertiary text-tertiary bg-tertiary-fixed/30' : zone.status === 'busy' ? 'border-secondary text-secondary bg-secondary-fixed/25' : 'border-primary text-primary bg-primary-fixed/20';
    return `<button type="button" data-facility-zone="${zone.id}" class="absolute rounded-xl border-2 ${color} p-sm flex items-center justify-center text-center hover:scale-[1.01] hover:shadow-lg transition-all overflow-hidden" style="left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%;">
      <span class="absolute inset-0 bg-white/35 opacity-0 hover:opacity-100 transition-opacity"></span>
      <span class="relative">
        <span class="material-symbols-outlined text-3xl">${zone.icon}</span>
        <span class="block font-label-md text-label-md uppercase">${zone.name}</span>
        <span class="mt-xs inline-flex px-xs py-[2px] rounded-full bg-white/75 text-[10px] font-bold">${formatLabel(zone.status)} • ${zone.metric}</span>
      </span>
    </button>`;
  }

  function assetDots(model) {
    const dots = [
      ['mach-1', 63, 48, model.machines.find(item => item.id === 'mach-1')?.status || 'operational'],
      ['mach-2', 78, 55, model.machines.find(item => item.id === 'mach-2')?.status || 'operational'],
      ['mach-3', 54, 63, model.machines.find(item => item.id === 'mach-3')?.status || 'maintenance'],
      ['store', 22, 70, model.lowStock.length ? 'maintenance' : 'operational'],
      ['truck', 18, 28, model.inTransit.length ? 'in_transit' : 'operational']
    ];
    return dots.map(([id, left, top, status]) => `<button type="button" data-facility-asset-dot="${id}" class="absolute w-4 h-4 rounded-full ${statusClass(status, true)} ring-4 ring-white/75 shadow-lg animate-pulse" style="left:${left}%;top:${top}%;" title="${id}"></button>`);
  }

  function facilityInbox(model) {
    return [
      ...model.criticalAssets.map(item => inboxRow('asset', item.id, item.name, 'Maintenance required', 'build')),
      ...model.lowStock.slice(0, 2).map(item => inboxRow('stock', item.id, item.name, 'Storage below threshold', 'inventory')),
      ...model.tasks.filter(task => (['Maintenance', 'Safety', 'Facilities'].includes(task.department) || task.source_module === 'facility_map') && task.status !== 'completed').slice(0, 3).map(item => inboxRow('task', item.id, item.title, formatLabel(item.status), 'assignment'))
    ].slice(0, 6);
  }

  function inboxRow(type, id, title, meta, icon) {
    return `<button type="button" data-facility-inbox="${type}:${id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex items-center justify-between gap-md">
      <span class="min-w-0"><span class="font-label-md text-label-md truncate block">${title}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${meta}</span></span>
      <span class="material-symbols-outlined text-primary">${icon}</span>
    </button>`;
  }

  function assetHealthRow(machine) {
    const load = machine.status === 'maintenance' ? 92 : machine.type === 'washer' ? 68 : 78;
    return `<button type="button" data-facility-machine="${machine.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all">
      <div class="flex justify-between gap-sm"><span class="font-label-md text-label-md">${machine.name}</span>${statusBadge(machine.status)}</div>
      <div class="mt-xs h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div class="${machine.status === 'maintenance' ? 'bg-error' : 'bg-primary'} h-full" style="width:${load}%"></div></div>
      <p class="font-body-sm text-body-sm text-on-surface-variant mt-xs">${machine.location || 'Plant'} • ${machine.capacity_kg_hr || 0} kg/hr</p>
    </button>`;
  }

  function maintenanceRow(item) {
    return `<button type="button" data-facility-maintenance="${item.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex justify-between gap-md">
      <span><span class="font-label-md text-label-md block">${item.machine_name || item.title}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${formatDate(item.scheduled_date)} • ${formatLabel(item.type)}</span></span>${statusBadge(item.status)}
    </button>`;
  }

  function zoneMetricRow(zone) {
    const pct = zone.status === 'critical' ? 92 : zone.status === 'watch' ? 66 : zone.status === 'busy' ? 78 : 42;
    return `<button type="button" data-facility-zone="${zone.id}" class="w-full text-left">
      <div class="flex justify-between font-label-md text-label-md"><span>${zone.name}</span><span>${pct}%</span></div>
      <div class="mt-xs h-2 rounded-full bg-surface-container-highest overflow-hidden"><div class="${zone.status === 'critical' ? 'bg-error' : 'bg-primary'} h-full rounded-full" style="width:${pct}%"></div></div>
    </button>`;
  }

  function bindFacilityControls(model) {
    document.querySelectorAll('[data-facility-zone]').forEach(button => bindOnce(button, () => showZoneDetail(model.zones.find(zone => zone.id === button.dataset.facilityZone), model)));
    document.querySelectorAll('[data-facility-kpi]').forEach(button => bindOnce(button, () => showKpiDetail(button.dataset.facilityKpi, model)));
    document.querySelectorAll('[data-facility-machine]').forEach(button => bindOnce(button, () => showMachineDetail(model.machines.find(item => item.id === button.dataset.facilityMachine), model)));
    document.querySelectorAll('[data-facility-maintenance]').forEach(button => bindOnce(button, () => showMaintenanceDetail(model.maintenance.find(item => item.id === button.dataset.facilityMaintenance))));
    document.querySelectorAll('[data-facility-inbox]').forEach(button => bindOnce(button, () => handleInbox(button.dataset.facilityInbox, model)));
    document.querySelectorAll('[data-facility-action]').forEach(button => bindOnce(button, () => handleHeaderAction(button.dataset.facilityAction, model)));
    document.querySelectorAll('[data-facility-control]').forEach(button => bindOnce(button, () => showControl(button.dataset.facilityControl, model)));
    document.querySelectorAll('[data-facility-map-mode]').forEach(button => bindOnce(button, () => setMapMode(button.dataset.facilityMapMode)));
    document.querySelectorAll('[data-facility-tool]').forEach(button => bindOnce(button, () => applyMapTool(button.dataset.facilityTool)));
    document.querySelectorAll('[data-facility-asset-dot]').forEach(button => bindOnce(button, () => showKpiDetail(button.dataset.facilityAssetDot, model)));
  }

  function showZoneDetail(zone, model) {
    if (!zone) return;
    document.querySelector('[data-facility-selected]').innerText = zone.name;
    const overlay = createModal(zone.name, `
      ${detailGrid([['Department', zone.department], ['Status', formatLabel(zone.status)], ['Metric', zone.metric], ['Purpose', zone.detail]])}
      <div class="mt-md space-y-xs">
        ${zone.assets.map(item => `<button type="button" data-zone-asset="${item.type}:${item.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md"><span><span class="font-label-md text-label-md block">${item.name}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${item.meta}</span></span><span class="material-symbols-outlined text-primary">chevron_right</span></button>`).join('') || emptyBlock('No live records in this zone.')}
      </div>
      <div class="flex flex-wrap justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
        <button type="button" data-zone-task="${zone.id}" class="px-md py-sm border border-primary text-primary rounded-full">Create Task</button>
        <button type="button" data-zone-open="${zone.href}" class="px-md py-sm bg-primary text-on-primary rounded-full">Open Department</button>
      </div>
    `, 'Facility Zone', 'max-w-4xl');
    overlay.querySelector('[data-zone-open]')?.addEventListener('click', event => { window.location.href = pageHref(event.currentTarget.dataset.zoneOpen); });
    overlay.querySelector('[data-zone-task]')?.addEventListener('click', () => { createFacilityTask(`${zone.name} follow-up`, zone.department, zone.detail); overlay.remove(); renderFacilityPage(); });
    overlay.querySelectorAll('[data-zone-asset]').forEach(btn => btn.addEventListener('click', () => handleInbox(btn.dataset.zoneAsset, model)));
  }

  function showKpiDetail(key, model) {
    const rows = {
      critical: model.criticalAssets.map(item => [item.name, formatLabel(item.status)]),
      stock: model.lowStock.map(item => [item.name, `${Number(item.quantity_kg || 0)} / ${Number(item.reorder_threshold_kg || 0)} kg`]),
      people: model.onsite.map(item => [item.full_name, item.department || item.role]),
      flow: model.inTransit.map(item => [item.school_name || item.id, formatLabel(item.status)]),
      truck: model.inTransit.map(item => [item.school_name || item.id, `${Number(item.weight_kg || 0)} kg`])
    }[key] || model.machines.map(item => [item.name, formatLabel(item.status)]);
    createModal('Facility Analysis', `
      <div class="space-y-xs">${rows.map(([a, b]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md"><span class="font-label-md">${a}</span><span class="text-on-surface-variant">${b}</span></div>`).join('') || emptyBlock('No records.')}</div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showMachineDetail(machine, model) {
    if (!machine) return;
    const overlay = createModal(machine.name, `
      ${detailGrid([['Type', formatLabel(machine.type)], ['Location', machine.location], ['Status', formatLabel(machine.status)], ['Capacity', `${machine.capacity_kg_hr || 0} kg/hr`], ['Last Maintenance', formatDate(machine.last_maintenance)], ['Next Maintenance', formatDate(machine.next_maintenance)]])}
      <div class="flex flex-wrap justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button>
        <button type="button" data-machine-status="operational" class="px-md py-sm border border-primary text-primary rounded-full">Mark Operational</button>
        <button type="button" data-machine-workorder class="px-md py-sm bg-primary text-on-primary rounded-full">Work Order</button>
      </div>
    `, 'Asset Detail');
    overlay.querySelector('[data-machine-status]')?.addEventListener('click', async () => {
      await window.productionModule?.updateMachineStatus?.(machine.id, 'operational');
      overlay.remove();
      toast('Asset marked operational.', 'success');
      renderFacilityPage();
    });
    overlay.querySelector('[data-machine-workorder]')?.addEventListener('click', async () => {
      await addMaintenance(machine);
      overlay.remove();
      renderFacilityPage();
    });
  }

  function showMaintenanceDetail(item) {
    if (!item) return;
    const overlay = createModal(item.machine_name || item.title, `
      ${detailGrid([['Type', formatLabel(item.type)], ['Status', formatLabel(item.status)], ['Priority', formatLabel(item.priority)], ['Cost', money(item.cost_ksh)], ['Scheduled', formatDate(item.scheduled_date)], ['Technician', item.technician_name || 'Unassigned']])}
      <p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${item.notes || 'No notes captured.'}</p>
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-complete-maintenance class="px-md py-sm bg-primary text-on-primary rounded-full">Complete</button></div>
    `, 'Maintenance');
    overlay.querySelector('[data-complete-maintenance]')?.addEventListener('click', async () => {
      await window.productionModule?.completeMaintenanceTask?.(item.id, item.cost_ksh || 0, item.notes || 'Completed from Facility Map');
      overlay.remove();
      toast('Maintenance completed.', 'success');
      renderFacilityPage();
    });
  }

  function handleInbox(value, model) {
    const [type, id] = String(value || '').split(':');
    if (type === 'asset' || type === 'machine') return showMachineDetail(model.machines.find(item => item.id === id), model);
    if (type === 'stock' || type === 'material') return showStockDetail(model.raw.find(item => item.id === id));
    if (type === 'finished') return showStockDetail(model.finished.find(item => item.id === id));
    if (type === 'task') return showTaskDetail(model.tasks.find(item => item.id === id));
    if (type === 'collection') return showCollectionDetail(model.collections.find(item => item.id === id));
    if (type === 'batch') return showBatchDetail(model.batches.find(item => item.id === id));
    if (type === 'staff') return showStaffDetail(model.employees.find(item => item.id === id));
  }

  function showStockDetail(item) {
    if (!item) return;
    createModal(item.name, `${detailGrid([['Quantity', `${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg`], ['Threshold', `${Number(item.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg`], ['Status', item.status || statusFromStock(item)], ['Value', money(Number(item.quantity_kg || 0) * Number(item.unit_cost || item.unit_price || 0))]])}<div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-open-inventory class="px-md py-sm bg-primary text-on-primary rounded-full">Inventory</button></div>`).querySelector('[data-open-inventory]')?.addEventListener('click', () => { window.location.href = pageHref('supplier_inventory.html'); });
  }

  function showCollectionDetail(item) {
    if (!item) return;
    createModal(item.school_name || item.id, `${detailGrid([['Status', formatLabel(item.status)], ['Weight', `${Number(item.weight_kg || 0)} kg`], ['Waste', formatLabel(item.waste_type)], ['Collector', item.collector_name]])}<div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Collection Flow');
  }

  function showBatchDetail(item) {
    if (!item) return;
    createModal(item.batch_number || item.product_name, `${detailGrid([['Product', item.product_name], ['Status', formatLabel(item.status)], ['Input', `${Number(item.input_kg || 0)} kg`], ['Machine', item.machine_name]])}<div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Production Flow');
  }

  function showStaffDetail(item) {
    if (!item) return;
    createModal(item.full_name, `${detailGrid([['Department', item.department], ['Position', item.position || item.role], ['Phone', item.phone], ['Status', formatLabel(item.status)]])}<div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Staff Coverage');
  }

  function showTaskDetail(task) {
    if (!task) return;
    createModal(task.title, `${detailGrid([['Department', task.department], ['Priority', formatLabel(task.priority)], ['Status', formatLabel(task.status)], ['Due', formatDate(task.due_date)]])}<p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${task.description || 'No notes.'}</p><div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'Task');
  }

  function handleHeaderAction(action, model) {
    if (action === 'export') return exportFacilityCsv(model);
    if (action === 'triage') return showKpiDetail('critical', model);
    if (action === 'diagnostics') return runDiagnostics(model);
    if (action === 'safety') return showControl('lockdown', model);
    if (action === 'workorder') return showWorkOrder(model);
  }

  function showControl(key, model) {
    const titles = { lockdown: 'Safety Override', lighting: 'Lighting Control', iot: 'IoT Network', energy: 'Energy Scan' };
    const overlay = createModal(titles[key] || 'Facility Control', `
      ${detailGrid([['Mode', formatLabel(key)], ['Affected Zones', model.zones.length], ['Staff On Site', model.onsite.length], ['Open Actions', model.openMaintenance.length + model.lowStock.length]])}
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Cancel</button><button type="button" data-confirm-control class="px-md py-sm bg-primary text-on-primary rounded-full">Confirm</button></div>
    `, 'Control');
    overlay.querySelector('[data-confirm-control]')?.addEventListener('click', () => {
      createFacilityTask(`${titles[key] || 'Facility'} check`, 'Facilities', `Control action confirmed from Facility Map: ${formatLabel(key)}.`);
      overlay.remove();
      toast('Control task logged.', 'success');
      renderFacilityPage();
    });
  }

  function showWorkOrder(model) {
    const machine = model.criticalAssets[0] || model.machines[0];
    if (!machine) return toast('No asset found for work order.', 'warning');
    showMachineDetail(machine, model);
  }

  async function addMaintenance(machine) {
    await window.productionModule?.addMaintenanceTask?.({
      machine_id: machine.id,
      machine_name: machine.name,
      type: 'corrective',
      scheduled_date: new Date().toISOString().split('T')[0],
      technician_name: 'Maintenance Desk',
      status: 'scheduled',
      priority: machine.status === 'maintenance' ? 'high' : 'medium',
      cost_ksh: 12000,
      notes: `Raised from Facility Map for ${machine.location || 'plant floor'}.`
    });
    createFacilityTask(`Work order: ${machine.name}`, 'Maintenance', `Inspect ${machine.name} and update maintenance schedule.`);
    toast('Work order created for Maintenance.', 'success');
  }

  function runDiagnostics(model) {
    const findings = model.machines.map(item => [item.name, item.status === 'maintenance' ? 'Action required' : 'Normal']);
    createModal('Diagnostics', `<div class="space-y-xs">${findings.map(([a, b]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between"><span>${a}</span><strong>${b}</strong></div>`).join('')}</div><div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`);
  }

  function setMapMode(mode) {
    const map = document.querySelector('[data-facility-map]');
    if (!map) return;
    map.dataset.mapMode = mode;
    document.querySelectorAll('[data-facility-map-mode]').forEach(btn => {
      const active = btn.dataset.facilityMapMode === mode;
      btn.classList.toggle('bg-primary', active);
      btn.classList.toggle('text-on-primary', active);
    });
    map.classList.toggle('brightness-95', mode === 'heat');
    map.classList.toggle('saturate-150', mode === 'heat');
    map.classList.toggle('contrast-125', mode === 'assets');
    const selected = document.querySelector('[data-facility-selected]');
    if (selected) selected.innerText = `${formatLabel(mode)} view active`;
    localStorage.setItem('eden_facility_map_mode', mode);
  }

  function applyMapTool(tool) {
    const plane = document.querySelector('[data-facility-map-plane]');
    const selected = document.querySelector('[data-facility-selected]');
    if (!plane) return;
    const current = Number(plane.dataset.zoom || 1);
    const next = tool === 'zoom_in' ? Math.min(1.35, current + 0.1) : tool === 'zoom_out' ? Math.max(0.8, current - 0.1) : 1;
    plane.dataset.zoom = String(next);
    plane.style.transform = `scale(${next})`;
    if (selected) selected.innerText = tool === 'center_focus_strong' ? 'Map centered' : `Zoom ${Math.round(next * 100)}%`;
  }

  function createFacilityTask(title, department, description) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({ id: `task-fac-${Date.now()}`, title, description, department, priority: 'high', status: 'open', source_module: 'facility_map', created_at: new Date().toISOString() });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function exportFacilityCsv(model) {
    const rows = [
      ['Type', 'Name', 'Status', 'Location'],
      ...model.machines.map(item => ['Machine', item.name, item.status, item.location]),
      ...model.openMaintenance.map(item => ['Maintenance', item.machine_name, item.status, item.scheduled_date]),
      ...model.lowStock.map(item => ['Low Stock', item.name, item.quantity_kg, item.reorder_threshold_kg])
    ];
    downloadTextFile(`eden-facility-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Facility export downloaded.', 'success');
  }

  function statusBadge(status = 'open') {
    return `<span class="${statusClass(status)} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatLabel(status)}</span>`;
  }
  function statusClass(status, dot = false) {
    const key = String(status || '').toLowerCase();
    const cls = ['critical', 'maintenance', 'offline', 'error'].includes(key) ? 'bg-error text-on-error' : ['busy', 'scheduled', 'in_transit', 'pending'].includes(key) ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary';
    return dot ? cls.split(' ')[0] : cls;
  }
  function statusFromStock(item) { return Number(item.quantity_kg || 0) <= Number(item.reorder_threshold_kg || 0) ? 'Low Stock' : 'Healthy'; }
  function detailGrid(rows) { return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`).join('')}</dl>`; }
  function emptyBlock(text) { return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`; }
  function formatLabel(value) { return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function formatDate(value) { if (!value) return 'Not set'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }); }
  function money(value) { return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`; }
  function sum(rows, key) { return rows.reduce((total, row) => total + Number(row[key] || 0), 0); }
  function bindOnce(element, handler) { if (!element || element.dataset.facilityBound) return; element.dataset.facilityBound = 'true'; element.addEventListener('click', handler); }
  function readJson(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; } }
  function pageHref(page) { return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page; }
  function toast(message, type = 'info') { window.edenUtils?.showToast(message, type); }
  function createModal(title, bodyHtml, eyebrow = 'Facility Control', maxWidthClass = 'max-w-3xl') {
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
  function currentPage() { return window.location.pathname.split('/').pop(); }
})();
