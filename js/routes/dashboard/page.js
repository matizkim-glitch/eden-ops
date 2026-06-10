// js/routes/dashboard/page.js
// System overview controller: company-wide signals, priority actions, and department navigation.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['operations_overview.html'] = bindDashboardPage;

  if (document.readyState !== 'loading' && currentPage() === 'operations_overview.html') {
    window.setTimeout(bindDashboardPage, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentPage() === 'operations_overview.html') window.setTimeout(bindDashboardPage, 0);
    }, { once: true });
  }

  async function bindDashboardPage() {
    const main = document.querySelector('main');
    if (!main) return;
    main.className = 'pt-24 pb-12 px-margin max-w-container-max mx-auto w-full space-y-xl';
    document.querySelectorAll('button.fixed.bottom-24, button.fixed.md\\:bottom-8').forEach(button => button.remove());
    const model = await buildModel();
    main.innerHTML = template(model);
    bindControls(model);
    document.dispatchEvent(new CustomEvent('eden:content-updated'));
  }

  async function buildModel() {
    const stats = window.dashboardModule?.getStats ? await window.dashboardModule.getStats() : {};
    const tasks = readJson('eden_tasks', []);
    const machines = readJson('eden_machines', []);
    const products = readJson('eden_finished_products', []);
    const materials = readJson('eden_raw_materials', []);
    const orders = readJson('eden_orders', []);
    const collections = readJson('eden_collections', []);
    const maintenance = readJson('eden_maintenance', []);
    const blockers = [
      ...tasks.filter(item => item.status !== 'completed').slice(0, 6),
      ...materials.filter(item => Number(item.quantity_kg || 0) <= Number(item.reorder_threshold_kg || 0)).slice(0, 3).map(item => ({ id: item.id, title: `Low stock: ${item.name}`, department: 'Inventory', priority: 'high', status: 'open', source_module: 'supplier_inventory' })),
      ...machines.filter(item => item.status !== 'operational').map(item => ({ id: item.id, title: `${item.name} unavailable`, department: 'Maintenance', priority: 'high', status: item.status, source_module: 'maintenance_scheduling' }))
    ];
    return { stats, tasks, machines, products, materials, orders, collections, maintenance, blockers: unique(blockers, item => `${item.title}:${item.department}`).slice(0, 8) };
  }

  function template(model) {
    return `
      <section class="grid grid-cols-1 md:grid-cols-12 gap-lg items-stretch">
        <div class="md:col-span-8 relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm min-h-[260px]">
          <div class="absolute inset-0 pointer-events-none opacity-70 bg-[linear-gradient(90deg,rgba(0,108,3,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(0,108,3,0.045)_1px,transparent_1px)] [background-size:28px_28px]"></div>
          <div class="relative h-full flex flex-col justify-between gap-lg">
            <div>
              <span class="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-sm">monitoring</span>
                ${systemHealth(model)}% operating health
              </span>
              <h1 class="font-headline-xl text-headline-xl text-on-surface mt-md">System Overview</h1>
              <p class="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-xs">Live company control across collection, stock, production, sales, people, finance, and assets.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
              ${heroMetric('Open Priorities', model.blockers.length)}
              ${heroMetric('Revenue', money(model.stats.revenue))}
              ${heroMetric('Active Batches', model.stats.activeBatches || 0)}
            </div>
          </div>
        </div>

        <div class="md:col-span-4 rounded-xl border border-primary/25 bg-primary text-on-primary p-lg shadow-sm flex flex-col justify-between gap-lg">
          <div>
            <p class="font-label-md text-label-md uppercase opacity-80">Next Priority</p>
            <h2 class="font-headline-md text-headline-md mt-xs">${model.blockers[0]?.title || 'Operations running clean'}</h2>
            <p class="font-body-sm text-body-sm opacity-85 mt-sm">${model.blockers[0] ? `${model.blockers[0].department || 'Operations'} needs action now.` : 'No urgent cross-department blockers are currently open.'}</p>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-sm">
            <button type="button" data-dashboard-action="triage" class="w-full px-md py-sm rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all font-label-md text-label-md">Triage</button>
            <button type="button" data-dashboard-action="analysis" class="w-full px-md py-sm rounded-full bg-white text-primary hover:bg-primary-container active:scale-95 transition-all font-label-md text-label-md">Analysis</button>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-md">
        ${kpi('collection', 'Waste Collected', `${Number(model.stats.wasteCollectedKg || 0).toLocaleString('en-KE')} kg`, 'recycling')}
        ${kpi('production', 'Production Output', `${Number(model.stats.productionOutputKg || 0).toLocaleString('en-KE')} kg`, 'precision_manufacturing')}
        ${kpi('sales', 'Orders', Number(model.stats.totalOrders || model.orders.length), 'local_shipping')}
        ${kpi('people', 'Staff Present', `${model.stats.presentToday || 0}/${model.stats.headcount || 0}`, 'groups')}
      </section>

      <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <div>
            <h2 class="font-headline-sm text-headline-sm">Operations Modules</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Open a department and resolve its live work.</p>
          </div>
          <button type="button" data-dashboard-action="export" class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low active:scale-95 transition-all">Export</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-md">${departmentCards().map(deptCard).join('')}</div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-lg items-start">
        <div class="xl:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <div class="flex items-center justify-between mb-md">
            <h2 class="font-headline-sm text-headline-sm">Priority Actions</h2>
            <button type="button" data-dashboard-action="triage" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Triage</button>
          </div>
          <div class="space-y-xs">${model.blockers.map(blockerRow).join('') || emptyBlock('No blockers.')}</div>
        </div>
        <div class="xl:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <div class="flex items-center justify-between mb-md">
            <h2 class="font-headline-sm text-headline-sm">Operational Events</h2>
            <span class="font-label-sm text-label-sm text-primary">${events(model).length} live</span>
          </div>
          <div class="space-y-xs">${events(model).map(eventRow).join('')}</div>
        </div>
        <div class="xl:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h2 class="font-headline-sm text-headline-sm mb-md">Predictive Snapshot</h2>
          ${metric('Stock Risk', model.materials.filter(item => Number(item.quantity_kg || 0) <= Number(item.reorder_threshold_kg || 0)).length)}
          ${metric('Machine Risk', model.machines.filter(item => item.status !== 'operational').length)}
          ${metric('Receivables', money(model.stats.receivables || 0))}
          <button type="button" data-dashboard-action="analysis" class="mt-md w-full px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Open Analysis</button>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <section class="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
          <h2 class="font-headline-sm text-headline-sm mb-md">Stock & Production Mix</h2>
          <div class="space-y-sm">${mixBars(model).join('')}</div>
        </section>
      </section>
      <div class="h-24"></div>
    `;
  }

  function heroMetric(label, value) { return `<button type="button" data-dashboard-kpi="${label.toLowerCase()}" class="p-sm rounded-lg border border-outline-variant bg-white/75 text-left hover:border-primary transition-all"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</span><span class="block font-headline-md text-headline-md text-primary">${value}</span></button>`; }
  function kpi(key, label, value, icon) { return `<button type="button" data-dashboard-kpi="${key}" class="text-left p-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm hover:border-primary transition-all"><div class="flex justify-between"><span class="font-label-md text-label-md text-on-surface-variant">${label}</span><span class="material-symbols-outlined text-primary">${icon}</span></div><p class="font-headline-md text-headline-md text-primary mt-xs">${value}</p></button>`; }
  function blockerRow(item) { return `<button type="button" data-dashboard-blocker="${item.id}" data-dashboard-source="${item.source_module || ''}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex justify-between gap-md"><span><span class="font-label-md text-label-md block">${item.title}</span><span class="font-body-sm text-body-sm text-on-surface-variant">${item.department || 'Operations'} • ${formatLabel(item.status)}</span></span><span class="material-symbols-outlined text-primary">chevron_right</span></button>`; }
  function deptCard(item) { return `<button type="button" data-dashboard-dept="${item.href}" class="p-md rounded-xl border border-outline-variant bg-surface-container-low text-left hover:border-primary hover:-translate-y-0.5 active:scale-[0.99] transition-all"><span class="material-symbols-outlined text-primary">${item.icon}</span><p class="font-label-md text-label-md mt-xs">${item.label}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${item.meta}</p></button>`; }
  function metric(label, value) { return `<div class="mb-xs p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md"><span class="text-on-surface-variant">${label}</span><strong>${value}</strong></div>`; }
  function eventRow(item) { return `<button type="button" data-dashboard-event="${item.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex justify-between gap-md"><span><span class="font-label-md text-label-md">${item.title}</span><span class="font-body-sm text-body-sm text-on-surface-variant block">${item.module}</span></span>${statusBadge(item.status)}</button>`; }
  function mixBars(model) {
    const rows = unique(model.products.map(item => ({ name: item.name, value: Number(item.quantity_kg || 0) })).concat(model.materials.slice(0, 4).map(item => ({ name: item.name, value: Number(item.quantity_kg || 0) }))), item => item.name).slice(0, 6);
    const max = Math.max(...rows.map(item => item.value), 1);
    return rows.map(item => `<button type="button" data-dashboard-stock="${item.name}" class="w-full text-left"><div class="flex justify-between font-label-md text-label-md"><span>${item.name}</span><span>${item.value.toLocaleString('en-KE')} kg</span></div><div class="h-2 mt-xs bg-surface-container-highest rounded-full overflow-hidden"><div class="h-full bg-primary" style="width:${Math.max(6, Math.round(item.value / max * 100))}%"></div></div></button>`);
  }

  function bindControls(model) {
    document.querySelectorAll('[data-dashboard-dept]').forEach(button => button.addEventListener('click', () => { window.location.href = pageHref(button.dataset.dashboardDept); }));
    document.querySelectorAll('[data-dashboard-blocker]').forEach(button => button.addEventListener('click', () => openBlocker(button, model)));
    document.querySelectorAll('[data-dashboard-kpi]').forEach(button => button.addEventListener('click', () => showAnalysis(button.dataset.dashboardKpi, model)));
    document.querySelectorAll('[data-dashboard-action="analysis"], [data-dashboard-action="triage"]').forEach(button => button.addEventListener('click', () => showAnalysis(button.dataset.dashboardAction, model)));
    document.querySelectorAll('[data-dashboard-action="export"]').forEach(button => button.addEventListener('click', () => exportCsv(model)));
    document.querySelectorAll('[data-dashboard-event], [data-dashboard-stock]').forEach(button => button.addEventListener('click', () => showAnalysis(button.textContent.trim().slice(0, 40), model)));
  }

  function openBlocker(button, model) {
    const source = button.dataset.dashboardSource;
    const target = source === 'supplier_inventory' ? 'supplier_inventory.html' : source === 'maintenance_scheduling' ? 'maintenance_scheduling.html' : source === 'production_monitoring' ? 'production_monitoring.html' : 'operations_overview.html';
    createModal('Priority Action', `<p class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">${button.innerText}</p><div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-open-source class="px-md py-sm bg-primary text-on-primary rounded-full">Open Department</button></div>`).querySelector('[data-open-source]')?.addEventListener('click', () => { window.location.href = pageHref(target); });
  }

  function showAnalysis(mode, model) {
    createModal('System Analysis', `${detailGrid([['Mode', formatLabel(mode)], ['Health', `${systemHealth(model)}%`], ['Open Priorities', model.blockers.length], ['Revenue', money(model.stats.revenue)], ['Receivables', money(model.stats.receivables)], ['Active Batches', model.stats.activeBatches || 0]])}<div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>`, 'System Overview', 'max-w-4xl');
  }

  function exportCsv(model) {
    const rows = [['Metric', 'Value'], ['Health', systemHealth(model)], ['Open Priorities', model.blockers.length], ['Revenue', model.stats.revenue], ['Receivables', model.stats.receivables]];
    downloadTextFile(`eden-system-overview-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.join(',')).join('\n'));
  }

  function departmentCards() {
    return [
      ['Waste Collection', 'waste_collection.html', 'recycling', 'Routes and school pickups'],
      ['Inventory', 'supplier_inventory.html', 'warehouse', 'Raw and finished stock'],
      ['Production', 'production_monitoring.html', 'precision_manufacturing', 'Batches and QC'],
      ['Sales', 'sales_distribution.html', 'local_shipping', 'Orders and dispatch'],
      ['CRM', 'customer_crm.html', 'groups', 'Customers and risk'],
      ['Maintenance', 'maintenance_scheduling.html', 'build', 'Assets and work orders']
    ].map(([label, href, icon, meta]) => ({ label, href, icon, meta }));
  }
  function events(model) {
    return unique([
      ...model.collections.slice(-4).map(item => ({ id: item.id, title: `${item.school_name || 'School'} collection ${formatLabel(item.status)}`, module: 'Collection', status: item.status })),
      ...model.maintenance.slice(0, 4).map(item => ({ id: item.id, title: `${item.machine_name} ${formatLabel(item.type)}`, module: 'Maintenance', status: item.status })),
      ...model.orders.slice(0, 4).map(item => ({ id: item.id, title: `${item.customer_name || 'Customer'} order`, module: 'Sales', status: item.status }))
    ], item => `${item.title}:${item.module}`).slice(0, 8);
  }
  function systemHealth(model) { return Math.max(55, Math.round(100 - model.blockers.length * 3 - model.machines.filter(item => item.status !== 'operational').length * 5)); }
  function unique(rows, keyFn) { const seen = new Set(); return rows.filter(row => { const key = keyFn(row); if (seen.has(key)) return false; seen.add(key); return true; }); }
  function detailGrid(rows) { return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`; }
  function statusBadge(status = 'open') { const key = String(status).toLowerCase(); const cls = ['completed', 'received', 'paid', 'success'].includes(key) ? 'bg-primary/10 text-primary' : ['warning', 'scheduled', 'open', 'pending'].includes(key) ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'; return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatLabel(status)}</span>`; }
  function emptyBlock(text) { return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`; }
  function formatLabel(value) { return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function money(value) { return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`; }
  function readJson(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; } }
  function pageHref(page) { return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page; }
  function currentPage() { return window.location.pathname.split('/').pop(); }
  function createModal(title, bodyHtml, eyebrow = 'System Control', maxWidthClass = 'max-w-3xl') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `<div class="w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card><div class="flex items-start justify-between gap-md mb-md"><div><p class="font-label-sm text-label-sm text-primary uppercase">${eyebrow}</p><h3 class="font-headline-md text-headline-md">${title}</h3></div><button type="button" data-modal-close class="material-symbols-outlined p-xs rounded-full hover:bg-surface-container-high">close</button></div>${bodyHtml}</div>`;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('[data-modal-card]');
    requestAnimationFrame(() => { card.classList.remove('scale-95', 'opacity-0'); card.classList.add('scale-100', 'opacity-100'); });
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-modal-close]')) overlay.remove(); });
    setTimeout(() => document.dispatchEvent(new CustomEvent('eden:content-updated')), 50);
    return overlay;
  }
  function downloadTextFile(filename, content, mimeType = 'text/csv') { const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
})();
