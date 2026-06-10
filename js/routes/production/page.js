// js/routes/production/page.js
// Production page controller: product flows, material requests, batch planning, and production FAQs.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['production_monitoring.html'] = bindProductionPage;
  window.edenPageControllers['production_quality_control.html'] = bindProductionPage;

  async function bindProductionPage() {
    if (!window.productionModule) return;
    bindProductionActions();
    await renderProductionPage();
  }

  function bindProductionActions() {
    document.querySelectorAll('[data-production-header-action]').forEach(button => {
      const action = button.dataset.productionHeaderAction;
      const handlers = {
        'new-batch': showNewBatchModal,
        'qc-log': showQcLogModalV2,
        requests: () => {
          document.getElementById('material-request-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          toast('Material request queue opened.', 'info');
        },
        diagnostics: showLineDiagnosticsModal
      };
      bindOne(button, `header-${action}`, handlers[action]);
    });

    const newBatchButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('New Production Batch'));
    bindOne(newBatchButton, 'new-batch', showNewBatchModal);

    const syncButton = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Sync ERP'));
    bindOne(syncButton, 'sync-production', async () => {
      await renderProductionPage();
      toast('Production and inventory data refreshed.', 'info');
    });

    Array.from(document.querySelectorAll('button')).filter(button => ['Weekly', 'Daily'].includes(button.innerText.trim())).forEach(button => {
      bindOne(button, `chart-${button.innerText.trim().toLowerCase()}`, () => {
        setChartMode(button.innerText.trim());
      });
    });

    const viewAllQc = Array.from(document.querySelectorAll('button')).find(button => button.innerText.trim() === 'View All');
    bindOne(viewAllQc, 'view-qc', showQcLogModalV2);

    const addQc = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Add Quality Checkpoint'));
    bindOne(addQc, 'add-qc', showQualityCheckpointModal);

    const sustainabilityReport = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Sustainability Report'));
    bindOne(sustainabilityReport, 'sustainability-report', () => {
      window.location.href = pageHref('sustainability_analytics.html');
    });

    const diagnostics = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Line Diagnostics'));
    bindOne(diagnostics, 'line-diagnostics', showLineDiagnosticsModal);
  }

  async function renderProductionPage() {
    const [batches, machines, maintenance, stats, materials, products] = await Promise.all([
      window.productionModule.getBatches(),
      window.productionModule.getMachines(),
      window.productionModule.getMaintenance(),
      window.productionModule.getProductionStats(),
      getRawMaterials(),
      getFinishedProducts()
    ]);

    renderMachineStatus(machines, maintenance);
    renderProductionMetrics(stats, batches);
    renderProductionUrgentInbox();
    renderProductionChart(batches);
    renderQualityChecklistV2(batches);
    renderMaterialInventory(materials);
    renderProductFlowPanel(products, materials);
    renderMaterialRequestPanel();
    renderProductionCyclePanel(batches);
    bindProductionActions();
  }

  function renderProductionUrgentInbox() {
    const main = document.querySelector('main');
    if (!main) return;
    let panel = document.querySelector('[data-production-urgent-inbox]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.productionUrgentInbox = 'true';
      panel.className = 'fixed right-3 top-24 z-40 w-auto max-w-[calc(100vw-1.5rem)] overflow-visible';
    }
    if (!panel.isConnected) document.body.appendChild(panel);

    const tasks = crossDepartmentTasks('Production');
    const demands = readJson('eden_sales_demand_requests', [])
      .filter(demand => ['queued_for_production', 'production_review', 'in_production'].includes(String(demand.status || '').toLowerCase()))
      .slice(0, 6);
    const urgentItems = [
      ...demands.map(demand => ({ type: 'demand', id: demand.id, title: `${demand.customer_name} demand`, description: demandSummary(demand), status: demand.status, created_at: demand.created_at })),
      ...tasks.map(task => ({ type: 'task', id: task.id, title: task.title, description: task.description, status: task.status, created_at: task.created_at }))
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);

    const collapsed = sessionStorage.getItem('eden_production_inbox_open') !== 'true';
    panel.innerHTML = collapsed ? `
      <button type="button" data-production-inbox-toggle class="group flex items-center gap-xs rounded-full border border-error/25 bg-white/85 backdrop-blur-xl px-xs py-xs shadow-xl hover:shadow-2xl hover:-translate-x-1 transition-all">
        <span class="grid place-items-center w-9 h-9 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]">priority_high</span>
        <span class="hidden sm:block pr-xs font-label-md text-label-md text-on-surface">Production</span>
        <span class="min-w-6 h-6 px-2 rounded-full bg-error-container text-on-error-container text-[11px] font-bold grid place-items-center">${urgentItems.length}</span>
      </button>
    ` : `
      <div class="w-[min(300px,calc(100vw-1.5rem))] rounded-2xl border border-error/20 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div class="flex items-center justify-between gap-sm p-sm bg-gradient-to-r from-error-container/70 to-white/30">
        <div class="flex items-center gap-xs min-w-0">
          <span class="grid place-items-center w-9 h-9 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]">priority_high</span>
          <div class="min-w-0">
            <p class="font-label-md text-label-md text-on-surface">Production</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${urgentItems.length} handoff${urgentItems.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div class="flex items-center gap-xs">
          <button type="button" data-production-inbox-all class="grid place-items-center w-8 h-8 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]" title="Open inbox">open_in_new</button>
          <button type="button" data-production-inbox-toggle class="grid place-items-center w-8 h-8 rounded-full bg-white/70 text-on-surface-variant material-symbols-outlined text-[18px]" title="Collapse">close</button>
        </div>
      </div>
      <div class="p-xs space-y-xs max-h-[48vh] overflow-y-auto">
        ${urgentItems.map(item => `
          <button type="button" data-production-inbox-item="${item.type}:${item.id}" class="w-full text-left p-xs rounded-xl bg-surface-container-lowest/90 border border-outline-variant hover:border-error hover:-translate-y-0.5 transition-all">
            <div class="flex items-center justify-between gap-sm">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate">${item.title}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${compactInboxText(item.description)}</p>
              </div>
              ${statusBadge(item.status || 'open')}
            </div>
          </button>
        `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant bg-surface-container-lowest">No urgent handoffs.</div>'}
      </div>
      </div>
    `;

    bindOne(panel.querySelector('[data-production-inbox-toggle]'), 'production-inbox-toggle', () => {
      sessionStorage.setItem('eden_production_inbox_open', collapsed ? 'true' : 'false');
      renderProductionUrgentInbox();
    });
    bindOne(panel.querySelector('[data-production-inbox-all]'), 'production-inbox-all', showProductionInboxModal);
    panel.querySelectorAll('[data-production-inbox-item]').forEach(button => {
      bindOne(button, `production-inbox-${button.dataset.productionInboxItem}`, () => showProductionInboxDetail(button.dataset.productionInboxItem));
    });
  }

  function renderMachineStatus(machines, maintenance) {
    const statusSection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Real-time Machine Status'));
    const list = statusSection?.querySelector('.flex.flex-col.gap-sm');
    if (!list) return;

    const activeMaintenance = new Set((maintenance || [])
      .filter(item => ['scheduled', 'in_progress', 'overdue', 'emergency'].includes(String(item.status).toLowerCase()))
      .map(item => item.machine_name));
    const rows = machines.length ? machines : [
      { name: 'Extruder Line A', type: 'extruder', status: 'operational' },
      { name: 'Granulator B', type: 'granulator', status: 'operational' },
      { name: 'EKO Polish Mixer', type: 'formulation', status: 'operational' }
    ];

    list.innerHTML = rows.map(machine => {
      const hasMaintenance = activeMaintenance.has(machine.name) || machine.status === 'maintenance';
      const active = machine.status === 'operational' && !hasMaintenance;
      const status = hasMaintenance ? 'ALERT' : active ? 'ACTIVE' : 'IDLE';
      return `
        <button type="button" class="text-left w-full flex items-center justify-between p-sm ${hasMaintenance ? 'border border-error-container bg-error-container/20' : active ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-70'} rounded-lg hover:shadow-sm transition-all" data-machine-id="${machine.id || machine.name}">
          <div class="flex items-center gap-md">
            <div class="w-2 h-2 rounded-full ${hasMaintenance ? 'bg-error' : active ? 'bg-primary animate-pulse' : 'bg-outline'}"></div>
            <div>
              <p class="font-label-md text-label-md">${machine.name}</p>
              <p class="font-body-sm text-body-sm ${hasMaintenance ? 'text-error' : 'text-on-surface-variant'}">${hasMaintenance ? 'Maintenance required' : formatLabel(machine.type || 'Production line')}</p>
            </div>
          </div>
          <span class="font-label-sm text-label-sm ${hasMaintenance ? 'text-error' : active ? 'text-primary' : 'text-on-surface-variant'} font-bold">${status}</span>
        </button>
      `;
    }).join('');

    list.querySelectorAll('[data-machine-id]').forEach(button => {
      const machine = rows.find(item => String(item.id || item.name) === button.dataset.machineId);
      bindOne(button, `machine-${button.dataset.machineId}`, () => showMachineDetail(machine));
    });
  }

  function renderProductionMetrics(stats, batches) {
    const completed = batches.filter(batch => batch.status === 'completed');
    const rejected = batches.filter(batch => batch.status === 'rejected');
    const outputKg = Number(stats.totalOutputKg || 0);
    const efficiency = completed.length ? Math.round(Number(stats.avgEfficiency || 0)) : 0;
    const qualityPass = completed.length + rejected.length ? Math.round((completed.length / (completed.length + rejected.length)) * 100) : 100;
    const active = batches.filter(batch => batch.status === 'in_progress').length;
    setMetricAfterLabel('TOTAL OUTPUT', `${outputKg.toLocaleString('en-KE')} kg`);
    setMetricAfterLabel('EFFICIENCY', `${efficiency}%`);
    setMetricAfterLabel('QUALITY PASS', `${qualityPass}%`);
    setMetricAfterLabel('DOWNTIME', `${Math.max(0, active * 12)}m`);
  }

  function renderProductionChart(batches) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Output Trends'));
    if (!section) return;
    let chart = section.querySelector('[data-output-trend-chart]') ||
      Array.from(section.querySelectorAll('.h-64, [class*="h-64"]')).find(el => String(el.className).includes('items-end'));
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'h-64 flex items-end gap-md px-md pt-md relative';
      chart.dataset.outputTrendChart = 'true';
      section.querySelector('.bg-white')?.appendChild(chart);
    }
    if (!chart) return;
    chart.dataset.outputTrendChart = 'true';
    chart.classList.add('min-h-64');
    const totals = batches.reduce((acc, batch) => {
      const name = batch.product_name || 'Unassigned';
      acc[name] = (acc[name] || 0) + Number(batch.output_kg || batch.actual_output_kg || batch.input_kg || 0);
      return acc;
    }, {});
    const data = Object.entries(totals).filter(([, total]) => total > 0).slice(0, 5);
    const rows = data.length ? data : [
      ['EKO Shoe Polish', 240],
      ['HDPE Granules', 920],
      ['PET Pellets', 410],
      ['LDPE Film Roll', 180]
    ];
    const max = Math.max(...rows.map(([, total]) => total), 1);
    const colors = ['bg-primary-container', 'bg-secondary-container', 'bg-tertiary-container', 'bg-primary-container', 'bg-secondary-container'];
    chart.innerHTML = '<div class="absolute inset-x-0 bottom-8 h-px bg-outline-variant"></div>' + rows.map(([label, total], index) => `
      <button type="button" class="flex-1 h-full flex flex-col justify-end items-center gap-sm group min-w-0 text-left" data-output-product="${slugify(label)}" title="${label}: ${Number(total).toLocaleString('en-KE')} kg">
        <span class="font-label-sm text-label-sm text-on-surface font-bold">${Number(total).toLocaleString('en-KE')}</span>
        <div class="w-full ${colors[index % colors.length]} rounded-t-lg transition-all duration-500 group-hover:brightness-110 group-hover:-translate-y-1" style="height:${Math.max(12, Math.round((total / max) * 78))}%"></div>
        <span class="font-label-sm text-label-sm text-on-surface-variant text-center truncate w-full" title="${label}">${label}</span>
      </button>
    `).join('');
    chart.querySelectorAll('[data-output-product]').forEach(button => {
      bindOne(button, `output-product-${button.dataset.outputProduct}`, () => {
        const label = button.title.split(':')[0];
        const productBatches = batches.filter(batch => (batch.product_name || 'Unassigned') === label);
        showOutputTrendDetail(label, productBatches, totals[label] || rows.find(([rowLabel]) => rowLabel === label)?.[1] || 0);
      });
    });
  }

  function renderQualityChecklist(batches) {
    const qcSection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Shift Quality Control'));
    const list = qcSection?.querySelector('.space-y-sm');
    if (!list) return;
    const cycles = readJson('eden_production_cycles', []);
    const rows = cycles.filter(cycle => ['in_progress', 'qc_check', 'completed'].includes(cycle.status)).slice(0, 4);
    const fallback = [
      ...batches.slice(0, 2).map(batch => ({
        id: batch.id,
        batch_number: batch.batch_number || batch.batch_code,
        product_name: batch.product_name,
        status: batch.status
      }))
    ];
    list.innerHTML = (rows.length ? rows : fallback).map(item => {
      const completed = item.status === 'completed';
      const readyForQc = item.status === 'qc_check' || item.status === 'in_progress';
      return `
        <div class="flex items-start gap-md p-sm hover:bg-surface-container-low rounded-lg transition-colors group" data-qc-cycle="${item.id || item.batch_id || item.batch_number}">
          <span class="material-symbols-outlined mt-0.5 ${completed ? 'text-primary' : readyForQc ? 'text-secondary' : 'text-on-surface-variant'}">${completed ? 'check_circle' : readyForQc ? 'fact_check' : 'pending'}</span>
          <div>
            <p class="font-label-md text-label-md group-hover:text-primary">${completed ? 'QC passed' : 'QC action required'} for ${item.batch_number || item.batch_code || item.id || 'Cycle'}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${item.product_name || 'Production batch'} - ${formatLabel(item.status || 'planned')} • Owner: QC Inspector / Production Lead</p>
            <div class="mt-xs flex gap-xs">
              <button type="button" data-open-qc="${item.id || item.batch_id || item.batch_number}" class="px-xs py-0.5 rounded-full border border-outline text-label-sm font-label-sm hover:bg-surface-container-high">Open QC</button>
              ${completed ? '' : `<button type="button" data-pass-qc="${item.id || item.batch_id || item.batch_number}" class="px-xs py-0.5 rounded-full bg-primary text-on-primary text-label-sm font-label-sm hover:opacity-90">Mark Passed</button>`}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-open-qc]').forEach(button => {
      bindOne(button, `open-qc-${button.dataset.openQc}`, event => {
        event.stopPropagation();
        const item = findCycleOrBatch(button.dataset.openQc, cycles, batches);
        showBatchDetail(item);
      });
    });
    list.querySelectorAll('[data-pass-qc]').forEach(button => {
      bindOne(button, `pass-qc-${button.dataset.passQc}`, async event => {
        event.stopPropagation();
        await markQcPassed(button.dataset.passQc);
      });
    });
  }

  function renderQualityChecklistV2(batches) {
    const qcSection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Shift Quality Control'));
    const list = qcSection?.querySelector('.space-y-sm');
    if (!list) return;
    const cycles = readJson('eden_production_cycles', []);
    const rows = cycles.filter(cycle => ['in_progress', 'qc_check', 'completed', 'rejected'].includes(cycle.status)).slice(0, 4);
    const fallback = batches.slice(0, 2).map(batch => ({
      id: batch.id,
      batch_number: batch.batch_number || batch.batch_code,
      product_name: batch.product_name,
      status: batch.status
    }));
    list.innerHTML = (rows.length ? rows : fallback).map(item => {
      const id = item.id || item.batch_id || item.batch_number;
      const completed = item.status === 'completed';
      const rejected = item.status === 'rejected';
      const readyForQc = item.status === 'qc_check' || item.status === 'in_progress';
      const statusText = rejected ? 'QC rejected' : completed ? 'QC passed' : 'QC action required';
      return `
        <div class="flex items-start gap-md p-sm hover:bg-surface-container-low rounded-lg transition-colors group cursor-pointer" data-qc-cycle="${id}">
          <span class="material-symbols-outlined mt-0.5 ${completed ? 'text-primary' : rejected ? 'text-error' : readyForQc ? 'text-secondary' : 'text-on-surface-variant'}">${completed ? 'check_circle' : rejected ? 'cancel' : readyForQc ? 'fact_check' : 'pending'}</span>
          <div class="flex-1 min-w-0">
            <p class="font-label-md text-label-md group-hover:text-primary">${statusText} for ${item.batch_number || item.batch_code || item.id || 'Cycle'}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${item.product_name || 'Production batch'} - ${formatLabel(item.status || 'planned')} - Owner: QC Inspector / Production Lead</p>
            <div class="mt-xs flex flex-wrap gap-xs">
              <button type="button" data-open-qc="${id}" class="px-xs py-0.5 rounded-full border border-outline text-label-sm font-label-sm hover:bg-surface-container-high">Open QC</button>
              ${completed || rejected ? '' : `<button type="button" data-pass-qc="${id}" class="px-xs py-0.5 rounded-full bg-primary text-on-primary text-label-sm font-label-sm hover:opacity-90">Mark Passed</button>`}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-open-qc]').forEach(button => {
      bindOne(button, `open-qc-v2-${button.dataset.openQc}`, event => {
        event.stopPropagation();
        showQcRecordModal(findCycleOrBatch(button.dataset.openQc, cycles, batches));
      });
    });
    list.querySelectorAll('[data-pass-qc]').forEach(button => {
      bindOne(button, `pass-qc-v2-${button.dataset.passQc}`, async event => {
        event.stopPropagation();
        await markQcPassed(button.dataset.passQc);
      });
    });
    list.querySelectorAll('[data-qc-cycle]').forEach(row => {
      bindOne(row, `qc-row-v2-${row.dataset.qcCycle}`, event => {
        if (event.target.closest('button')) return;
        showQcRecordModal(findCycleOrBatch(row.dataset.qcCycle, cycles, batches));
      });
    });
  }

  function renderMaterialInventory(materials) {
    const tbody = Array.from(document.querySelectorAll('table tbody')).find(body => body.closest('section')?.innerText.includes('Material Inventory Status'));
    if (!tbody) return;
    const rows = materials.length ? materials : [];
    tbody.innerHTML = rows.slice(0, 8).map(material => {
      const quantity = Number(material.quantity_kg || 0);
      const threshold = Number(material.reorder_threshold_kg || 1);
      const low = quantity <= threshold;
      const percent = Math.max(4, Math.min(100, Math.round((quantity / Math.max(1, threshold * 2)) * 100)));
      return `
        <tr class="hover:bg-surface-container-low transition-colors cursor-pointer" data-production-material="${material.id}">
          <td class="px-md py-md">
            <div class="flex items-center gap-sm">
              <div class="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center ${low ? 'text-error' : 'text-primary'}">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${rawMaterialIcon(material.category)}</span>
              </div>
              <p class="font-label-md text-label-md">${material.name}</p>
            </div>
          </td>
          <td class="px-md py-md font-body-md text-body-md">${quantity.toLocaleString('en-KE')}</td>
          <td class="px-md py-md"><div class="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden"><div class="${low ? 'bg-error' : 'bg-primary'} h-full" style="width:${percent}%"></div></div></td>
          <td class="px-md py-md">${statusBadge(low ? 'low_stock' : 'in_stock')}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-production-material]').forEach(row => {
      const material = rows.find(item => item.id === row.dataset.productionMaterial);
      bindOne(row, `material-${row.dataset.productionMaterial}`, () => showProductionMaterialDetail(material));
    });
  }

  function renderProductFlowPanel(products, materials) {
    const grid = document.querySelector('.bento-grid');
    if (!grid) return;
    let panel = document.getElementById('product-flow-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'product-flow-panel';
      panel.className = 'col-span-12';
      const imageUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=75';
      panel.innerHTML = `
        <div class="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div class="relative p-lg border-b border-outline-variant bg-surface-container-low">
            <img alt="Production line" class="absolute inset-0 w-full h-full object-cover opacity-10" src="${imageUrl}">
            <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-md">
              <div>
                <p class="font-label-sm text-label-sm text-primary uppercase tracking-wider">Product Flows</p>
                <h3 class="font-headline-md text-headline-md text-on-surface">Production Requests & Procedures</h3>
                <p class="font-body-md text-body-md text-on-surface-variant max-w-3xl">Choose a product, request the exact raw materials for a target quantity, start a batch, or open the FAQ when the process is unclear.</p>
              </div>
              <button type="button" data-open-production-faq class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md hover:bg-surface-container-lowest transition-colors">General FAQ</button>
            </div>
          </div>
          <div class="p-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md" data-product-flow-list></div>
        </div>
      `;
      const inventorySection = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Material Inventory Status'));
      inventorySection?.insertAdjacentElement('afterend', panel);
      panel.querySelector('[data-open-production-faq]')?.addEventListener('click', () => showProductionFaq());
    }

    const list = panel.querySelector('[data-product-flow-list]');
    if (!list) return;
    list.innerHTML = products.map(product => {
      const recipe = getProductRecipe(product);
      const readiness = calculateReadiness(recipe, materials);
      const quantity = Number(product.quantity_kg ?? product.quantity ?? 0);
      return `
        <div class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest hover:-translate-y-0.5 hover:shadow-md transition-all" data-product-card="${product.id}">
          <div class="flex items-start justify-between gap-md">
            <div>
              <h4 class="font-headline-sm text-headline-sm text-on-surface">${product.name}</h4>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${product.sku || product.id} - ${formatLabel(product.category || 'finished product')}</p>
            </div>
            <span class="material-symbols-outlined p-xs rounded-lg ${readiness.ready ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-error'}">${readiness.ready ? 'verified' : 'warning'}</span>
          </div>
          <div class="mt-md grid grid-cols-2 gap-sm">
            <div class="p-sm rounded-lg bg-surface-container-low">
              <p class="font-label-sm text-label-sm text-on-surface-variant">Finished Stock</p>
              <p class="font-headline-sm text-headline-sm">${quantity.toLocaleString('en-KE')} kg</p>
            </div>
            <div class="p-sm rounded-lg bg-surface-container-low">
              <p class="font-label-sm text-label-sm text-on-surface-variant">Possible Run</p>
              <p class="font-headline-sm text-headline-sm">${readiness.possibleKg.toLocaleString('en-KE')} kg</p>
            </div>
          </div>
          <p class="mt-sm font-body-sm text-body-sm ${readiness.ready ? 'text-on-surface-variant' : 'text-error'}">${readiness.message}</p>
          <div class="mt-md flex flex-wrap gap-sm">
            <button type="button" data-request-materials="${product.id}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">Request Materials</button>
            <button type="button" data-start-product="${product.id}" class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">Start Batch</button>
            <button type="button" data-product-faq="${product.id}" class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">FAQ</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-request-materials]').forEach(button => {
      button.dataset.productionBound = 'request-materials';
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.requestMaterials);
        if (product) showMaterialRequestModal(product, materials);
      });
    });
    list.querySelectorAll('[data-start-product]').forEach(button => {
      button.dataset.productionBound = 'start-product';
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.startProduct);
        if (product) showNewBatchModal(product);
      });
    });
    list.querySelectorAll('[data-product-faq]').forEach(button => {
      button.dataset.productionBound = 'product-faq';
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.productFaq);
        if (product) showProductFaq(product);
      });
    });
    list.querySelectorAll('[data-product-card]').forEach(card => {
      const product = products.find(item => item.id === card.dataset.productCard);
      bindOne(card, `product-card-${card.dataset.productCard}`, event => {
        if (event.target.closest('button')) return;
        showProductFlowDetail(product, materials);
      });
    });
  }

  function renderMaterialRequestPanel() {
    const grid = document.querySelector('.bento-grid');
    if (!grid) return;
    let panel = document.getElementById('material-request-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'material-request-panel';
      panel.className = 'col-span-12';
      panel.innerHTML = `
        <div class="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
          <div class="flex items-center justify-between gap-md mb-md">
            <div>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Material Requests To Inventory</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Requests raised by Production for Inventory issue, procurement follow-up, and tasking.</p>
            </div>
            <span data-request-count class="px-sm py-xs rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">0 Open</span>
          </div>
          <div class="space-y-sm" data-material-request-list></div>
        </div>
      `;
      const flow = document.getElementById('product-flow-panel');
      flow?.insertAdjacentElement('afterend', panel);
    }
    const requests = readJson('eden_material_requests', []);
    const list = panel.querySelector('[data-material-request-list]');
    const count = panel.querySelector('[data-request-count]');
    const open = requests.filter(request => request.status !== 'issued').length;
    if (count) count.innerText = `${open} Open`;
    if (!list) return;
    list.innerHTML = requests.length ? requests.slice(0, 6).map(request => `
      <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-sm hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer" data-material-request="${request.id}">
        <div>
          <p class="font-label-md text-label-md text-on-surface">${request.product_name} - ${Number(request.output_qty_kg || 0).toLocaleString('en-KE')} kg target</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${request.requirements.map(item => `${item.material_name}: ${Number(item.required_kg || 0).toLocaleString('en-KE')} kg`).join(' | ')}</p>
        </div>
        <div class="flex flex-wrap items-center gap-xs">
          <button type="button" data-request-detail="${request.id}" class="px-xs py-1 rounded-full border border-outline text-on-surface-variant font-label-sm text-label-sm hover:bg-surface-container-high">Details</button>
          ${request.status === 'issued' ? `<button type="button" data-request-start="${request.id}" class="px-xs py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm hover:opacity-90">Start</button>` : `<button type="button" data-request-nudge="${request.id}" class="px-xs py-1 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm hover:opacity-90">Notify Inventory</button>`}
          <span class="px-xs py-1 rounded-full ${request.status === 'issued' ? 'bg-primary/10 text-primary' : 'bg-secondary-container text-on-secondary-container'} font-label-sm text-label-sm">${formatLabel(request.status)}</span>
        </div>
      </div>
    `).join('') : '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant text-body-sm">No material requests yet. Use Request Materials from any product flow.</div>';

    list.querySelectorAll('[data-material-request]').forEach(row => {
      bindOne(row, `material-request-row-${row.dataset.materialRequest}`, event => {
        if (event.target.closest('button')) return;
        const request = requests.find(item => item.id === row.dataset.materialRequest);
        showMaterialRequestDetail(request);
      });
    });
    list.querySelectorAll('[data-request-detail]').forEach(button => {
      bindOne(button, `request-detail-${button.dataset.requestDetail}`, event => {
        event.stopPropagation();
        showMaterialRequestDetail(requests.find(item => item.id === button.dataset.requestDetail));
      });
    });
    list.querySelectorAll('[data-request-start]').forEach(button => {
      bindOne(button, `request-start-${button.dataset.requestStart}`, async event => {
        event.stopPropagation();
        await startProductionFromRequest(button.dataset.requestStart);
      });
    });
    list.querySelectorAll('[data-request-nudge]').forEach(button => {
      bindOne(button, `request-nudge-${button.dataset.requestNudge}`, event => {
        event.stopPropagation();
        nudgeInventoryForRequest(button.dataset.requestNudge);
      });
    });
  }

  function renderProductionCyclePanel(batches) {
    const grid = document.querySelector('.bento-grid');
    if (!grid) return;
    let panel = document.getElementById('production-cycle-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'production-cycle-panel';
      panel.className = 'col-span-12';
      panel.innerHTML = `
        <div class="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
            <div>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Production Batch Flow</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Each cycle is tracked from material request to Inventory issue, production, QC, and finished stock.</p>
            </div>
            <span data-cycle-count class="px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">0 Active</span>
          </div>
          <div class="space-y-md" data-production-cycle-list></div>
        </div>
      `;
      const requestPanel = document.getElementById('material-request-panel');
      requestPanel?.insertAdjacentElement('afterend', panel);
    }

    const cycles = mergeBatchCycles(readJson('eden_production_cycles', []), batches);
    localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
    const active = cycles.filter(cycle => !['completed', 'cancelled', 'rejected'].includes(cycle.status)).length;
    const count = panel.querySelector('[data-cycle-count]');
    if (count) count.innerText = `${active} Active`;
    const list = panel.querySelector('[data-production-cycle-list]');
    if (!list) return;
    list.innerHTML = cycles.length ? cycles.slice(0, 8).map(cycle => {
      const stageIndex = cycleStageIndex(cycle.status);
      return `
        <div class="p-md rounded-xl border border-outline-variant bg-surface-container-lowest hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer" data-cycle-row="${cycle.id}">
          <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${cycle.product_name}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${cycle.batch_number || cycle.id} • Target ${Number(cycle.output_qty_kg || 0).toLocaleString('en-KE')} kg • ${formatLabel(cycle.status)}</p>
            </div>
            <div class="flex flex-wrap gap-sm">
              ${cycle.status === 'materials_issued' ? `<button type="button" data-cycle-start="${cycle.id}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">Start Production</button>` : ''}
              ${cycle.status === 'in_progress' ? `<button type="button" data-cycle-progress="${cycle.id}" class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">Record Progress</button><button type="button" data-cycle-qc="${cycle.id}" class="px-sm py-xs bg-secondary text-on-secondary rounded-full font-label-sm text-label-sm hover:opacity-90">Send To QC</button>` : ''}
              ${cycle.status === 'qc_check' ? `<button type="button" data-cycle-record-qc="${cycle.id}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">Record QC</button>` : ''}
              ${cycle.status === 'rejected' ? `<button type="button" data-cycle-rework="${cycle.id}" class="px-sm py-xs border border-error text-error rounded-full font-label-sm text-label-sm hover:bg-error-container/20">Rework Plan</button>` : ''}
              <button type="button" data-cycle-detail="${cycle.id}" class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">Details</button>
            </div>
          </div>
          <div class="mt-md grid grid-cols-5 gap-xs">
            ${['Requested', 'Issued', 'Production', 'QC', 'Done'].map((stage, index) => `
              <div class="min-w-0">
                <div class="h-1.5 rounded-full ${index <= stageIndex ? 'bg-primary' : 'bg-surface-container-highest'}"></div>
                <p class="mt-xs font-label-sm text-label-sm ${index <= stageIndex ? 'text-primary' : 'text-on-surface-variant'} truncate">${stage}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('') : '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant text-body-sm">No production cycles yet. Request materials or start a batch to create one.</div>';

    list.querySelectorAll('[data-cycle-start]').forEach(button => {
      bindOne(button, `cycle-start-${button.dataset.cycleStart}`, async () => startCycleProduction(button.dataset.cycleStart));
    });
    list.querySelectorAll('[data-cycle-qc]').forEach(button => {
      bindOne(button, `cycle-qc-${button.dataset.cycleQc}`, async () => updateCycleStatus(button.dataset.cycleQc, 'qc_check'));
    });
    list.querySelectorAll('[data-cycle-progress]').forEach(button => {
      bindOne(button, `cycle-progress-${button.dataset.cycleProgress}`, () => showProductionProgressModal(button.dataset.cycleProgress));
    });
    list.querySelectorAll('[data-cycle-complete]').forEach(button => {
      bindOne(button, `cycle-complete-${button.dataset.cycleComplete}`, async () => completeCycle(button.dataset.cycleComplete));
    });
    list.querySelectorAll('[data-cycle-record-qc]').forEach(button => {
      bindOne(button, `cycle-record-qc-${button.dataset.cycleRecordQc}`, () => {
        const cycle = cycles.find(item => item.id === button.dataset.cycleRecordQc);
        showQcRecordModal(cycle || {});
      });
    });
    list.querySelectorAll('[data-cycle-rework]').forEach(button => {
      bindOne(button, `cycle-rework-${button.dataset.cycleRework}`, () => showReworkPlanModal(button.dataset.cycleRework));
    });
    list.querySelectorAll('[data-cycle-detail]').forEach(button => {
      bindOne(button, `cycle-detail-${button.dataset.cycleDetail}`, () => showCycleDetail(button.dataset.cycleDetail));
    });
    list.querySelectorAll('[data-cycle-row]').forEach(row => {
      bindOne(row, `cycle-row-${row.dataset.cycleRow}`, event => {
        if (event.target.closest('button')) return;
        showCycleDetail(row.dataset.cycleRow);
      });
    });
  }

  async function showNewBatchModal(selectedProduct = null) {
    const [products, materials] = await Promise.all([getFinishedProducts(), getRawMaterials()]);
    const product = selectedProduct || products[0];
    const overlay = createModal('Start Production Batch', `
      <form data-production-batch-form class="space-y-md">
        ${selectField('product_id', 'Product', products.map(item => [item.id, item.name]), product?.id)}
        ${numberField('output_qty_kg', 'Target output (kg)', 100)}
        ${selectField('machine_name', 'Production line', [['Extruder Line A', 'Extruder Line A'], ['Granulator B', 'Granulator B'], ['Film Press C', 'Film Press C'], ['EKO Polish Mixer', 'EKO Polish Mixer']])}
        <label class="flex items-center gap-sm text-body-sm text-on-surface-variant"><input name="request_materials" type="checkbox" checked class="rounded border-outline text-primary focus:ring-primary"> Request required raw materials from Inventory first</label>
        <div data-batch-requirements class="p-sm rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant"></div>
        ${modalActions('Start Batch')}
      </form>
    `);
    const form = overlay.querySelector('[data-production-batch-form]');
    const updateRequirements = () => {
      const current = products.find(item => item.id === form.product_id.value);
      const qty = Number(form.output_qty_kg.value || 0);
      const recipe = calculateRequirements(current, qty);
      const box = overlay.querySelector('[data-batch-requirements]');
      box.innerHTML = recipe.length
        ? recipe.map(item => `<div class="flex justify-between gap-md"><span>${item.material_name}</span><strong>${Number(item.required_kg || 0).toLocaleString('en-KE')} kg</strong></div>`).join('')
        : 'No recipe configured for this product.';
    };
    form.product_id.addEventListener('change', updateRequirements);
    form.output_qty_kg.addEventListener('input', updateRequirements);
    updateRequirements();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const current = products.find(item => item.id === data.get('product_id'));
      const outputQty = Number(data.get('output_qty_kg') || 0);
      const requirements = calculateRequirements(current, outputQty);
      let request = null;
      if (data.get('request_materials')) request = createMaterialRequest(current, outputQty, requirements, 'batch_start');
      const primary = primaryMaterialForProduct(current, materials);
      const started = await window.productionModule.startBatch({
        product_id: current?.id,
        product_name: current?.name,
        raw_material_id: primary?.id,
        raw_material_name: primary?.name,
        input_kg: requirements.reduce((sum, item) => sum + Number(item.required_kg || 0), 0),
        machine_id: slugify(data.get('machine_name')),
        machine_name: data.get('machine_name'),
        notes: `Target output ${outputQty} kg. Materials requested: ${data.get('request_materials') ? 'yes' : 'no'}`
      });
      if (started) createOrUpdateCycle({
        product: current,
        outputQty,
        requirements,
        request,
        batch: started,
        status: data.get('request_materials') ? 'material_requested' : 'in_progress'
      });
      overlay.remove();
      toast(started ? `${current?.name || 'Production'} batch started.` : 'Could not start production batch.', started ? 'success' : 'error');
      if (started) await renderProductionPage();
    });
  }

  function showMaterialRequestModal(product, materials) {
    const overlay = createModal('Request Raw Materials', `
      <form data-material-request-form class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low">
          <p class="font-label-md text-label-md">${product.name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${product.sku || product.id}</p>
        </div>
        ${numberField('output_qty_kg', 'Target production quantity (kg)', 100)}
        <div data-material-requirements class="p-sm rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant"></div>
        ${modalActions('Send Request')}
      </form>
    `);
    const form = overlay.querySelector('[data-material-request-form]');
    const renderRequirements = () => {
      const requirements = calculateRequirements(product, Number(form.output_qty_kg.value || 0));
      overlay.querySelector('[data-material-requirements]').innerHTML = requirements.map(item => {
        const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
        const enough = Number(material?.quantity_kg || 0) >= Number(item.required_kg || 0);
        return `<div class="flex justify-between gap-md ${enough ? '' : 'text-error'}"><span>${item.material_name}</span><strong>${Number(item.required_kg || 0).toLocaleString('en-KE')} kg</strong></div>`;
      }).join('');
    };
    form.output_qty_kg.addEventListener('input', renderRequirements);
    renderRequirements();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const qty = Number(new FormData(form).get('output_qty_kg') || 0);
      const requirements = calculateRequirements(product, qty);
      const request = createMaterialRequest(product, qty, requirements, 'manual_request');
      createOrUpdateCycle({ product, outputQty: qty, requirements, request, status: 'material_requested' });
      overlay.remove();
      toast('Material request sent to Inventory.', 'success');
      await renderProductionPage();
    });
  }

  function showProductFaq(product) {
    const recipe = getProductRecipe(product);
    createModal(`${product.name} FAQ`, `
      <div class="space-y-md">
        ${faqItem('What raw materials are needed?', recipe.length ? recipe.map(item => `${item.material_name}: ${Number(item.kg_per_kg || 0).toLocaleString('en-KE')} kg per kg output`).join('<br>') : 'No recipe has been configured yet.')}
        ${faqItem('What is the production procedure?', productionProcedure(product).join('<br>'))}
        ${faqItem('What happens when materials are requested?', 'A material request is stored for Inventory, an Inventory task is created, and a notification is added for follow-up. Production can start the batch while the request is visible in the request queue.')}
        ${faqItem('What should I check before starting?', 'Confirm stock readiness, machine status, target output, QC checkpoint plan, and whether low-stock materials require procurement.')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showProductionFaq() {
    createModal('Production FAQ', `
      <div class="space-y-md">
        ${faqItem('How do departments connect?', 'Production requests materials from Inventory. Inventory issues stock or creates procurement workflows. Completed production increases finished product stock for Sales and Distribution. QC results affect dispatch readiness.')}
        ${faqItem('When should I request raw materials?', 'Before starting a batch or whenever a product flow says the possible run is below the target output.')}
        ${faqItem('Where do material requests appear?', 'They appear in the Production request queue and are stored as Inventory tasks so the Inventory department can issue or procure stock.')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showOutputTrendDetail(productName, batches = [], totalKg = 0) {
    const completed = batches.filter(batch => batch.status === 'completed').length;
    const active = batches.filter(batch => batch.status === 'in_progress').length;
    createModal('Output Trend Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Product Line', productName],
          ['Total Volume', `${Number(totalKg || 0).toLocaleString('en-KE')} kg`],
          ['Batches', batches.length || 'Forecast sample'],
          ['Completed', completed],
          ['Active', active]
        ])}
      </dl>
      <div class="mt-md space-y-xs">
        ${(batches.length ? batches.slice(0, 6) : [{ batch_number: 'Forecast', status: 'planned', output_kg: totalKg }]).map(batch => `
          <div class="p-sm rounded-lg bg-surface-container-low flex items-center justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md">${batch.batch_number || batch.batch_code || batch.id || 'Batch'}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(batch.status || 'planned')}</p>
            </div>
            <strong class="font-label-md text-label-md">${Number(batch.output_kg || batch.actual_output_kg || batch.input_kg || 0).toLocaleString('en-KE')} kg</strong>
          </div>
        `).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showMaterialRequestDetail(request = {}) {
    if (!request?.id) return;
    const reservations = readJson('eden_inventory_reservations', []).filter(item => item.request_id === request.id);
    const tasks = readJson('eden_tasks', []).filter(item => item.material_request_id === request.id);
    const cycle = readJson('eden_production_cycles', []).find(item => item.material_request_id === request.id);
    const overlay = createModal('Material Request Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Request', request.id],
          ['Product', request.product_name],
          ['Target Output', `${Number(request.output_qty_kg || 0).toLocaleString('en-KE')} kg`],
          ['Status', formatLabel(request.status)],
          ['Requested By', request.requested_by || 'Production Operator'],
          ['Inventory Task', tasks[0]?.id || 'Queued in Inventory'],
          ['Production Cycle', cycle?.id || 'Not linked']
        ])}
      </dl>
      <div class="mt-md">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Requested Inputs</p>
        <div class="space-y-xs">${(request.requirements || []).map(item => `<div class="flex justify-between gap-md text-body-sm"><span>${item.material_name}</span><strong>${Number(item.required_kg || 0).toLocaleString('en-KE')} kg</strong></div>`).join('')}</div>
      </div>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Cross Department Updates</p>
        <p class="font-body-sm text-body-sm text-on-surface-variant">${reservations.length} inventory reservation line${reservations.length === 1 ? '' : 's'} and ${tasks.length || 1} Inventory task are linked to this request.</p>
      </div>
      <div class="flex flex-wrap justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Close</button>
        <button type="button" data-open-inventory class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md hover:bg-surface-container-low">Open Inventory</button>
        ${request.status === 'issued' ? `<button type="button" data-start-request-cycle class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90">Start Production</button>` : `<button type="button" data-nudge-request class="px-md py-sm bg-secondary text-on-secondary rounded-full font-label-md text-label-md hover:opacity-90">Notify Inventory</button>`}
      </div>
    `);
    overlay.querySelector('[data-open-inventory]')?.addEventListener('click', () => { window.location.href = pageHref('supplier_inventory.html'); });
    overlay.querySelector('[data-start-request-cycle]')?.addEventListener('click', async () => {
      overlay.remove();
      await startProductionFromRequest(request.id);
    });
    overlay.querySelector('[data-nudge-request]')?.addEventListener('click', () => {
      nudgeInventoryForRequest(request.id);
    });
  }

  async function startProductionFromRequest(requestId) {
    const request = readJson('eden_material_requests', []).find(item => item.id === requestId);
    if (!request) return;
    if (request.status !== 'issued') {
      toast('Inventory must issue materials before Production can start.', 'error');
      return;
    }
    const cycles = readJson('eden_production_cycles', []);
    let cycle = cycles.find(item => item.material_request_id === requestId);
    if (!cycle) {
      cycle = createOrUpdateCycle({
        product: { id: request.product_id, name: request.product_name },
        outputQty: request.output_qty_kg,
        requirements: request.requirements,
        request,
        status: 'materials_issued'
      });
    }
    await startCycleProduction(cycle.id);
  }

  function nudgeInventoryForRequest(requestId) {
    const request = readJson('eden_material_requests', []).find(item => item.id === requestId);
    if (!request) return;
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-follow-${Date.now()}`,
      title: `Follow up material issue: ${request.product_name}`,
      description: `Production is waiting for material request ${request.id}. Target output ${Number(request.output_qty_kg || 0).toLocaleString('en-KE')} kg.`,
      department: 'Inventory',
      priority: 'high',
      status: 'open',
      assigned_to: 'Inventory Lead',
      source_module: 'production_monitoring',
      material_request_id: request.id,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    appendProductionEvent(request.id, 'inventory_follow_up', 'Inventory follow-up task created.');
    toast('Inventory follow-up task created.', 'success');
  }

  async function showQcLogModal() {
    const [batches, logs] = await Promise.all([
      window.productionModule.getBatches(),
      window.productionModule.getQCLogs ? window.productionModule.getQCLogs() : Promise.resolve([])
    ]);
    createModal('Quality Control Log', `
      <div class="space-y-sm">
        ${(logs.length ? logs : batches.slice(0, 6).map(batch => ({
          batch_number: batch.batch_number || batch.batch_code,
          product_name: batch.product_name,
          grade: batch.quality_grade || 'Pending',
          passed: batch.status === 'completed',
          inspection_date: batch.end_time ? batch.end_time.slice(0, 10) : 'Pending',
          notes: batch.notes || 'Awaiting QC completion'
        }))).map(item => `
          <div class="p-sm rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md">${item.batch_number} - ${item.product_name || 'Production batch'}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${item.inspection_date} • Grade ${item.grade || 'Pending'} • ${item.notes || 'No notes'}</p>
            </div>
            ${statusBadge(item.passed ? 'completed' : 'pending')}
          </div>
        `).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  async function showQcLogModalV2() {
    const [batches, logs] = await Promise.all([
      window.productionModule.getBatches(),
      window.productionModule.getQCLogs ? window.productionModule.getQCLogs() : Promise.resolve([])
    ]);
    const cycles = readJson('eden_production_cycles', []);
    const pending = cycles.filter(cycle => ['in_progress', 'qc_check'].includes(cycle.status)).map(cycle => ({
      batch_number: cycle.batch_number || cycle.id,
      product_name: cycle.product_name,
      grade: 'Pending',
      passed: false,
      pending: true,
      inspection_date: 'Awaiting QC',
      notes: `Owner: ${cycle.status === 'qc_check' ? 'QC Inspector' : 'Production Lead'}`
    }));
    const rows = [
      ...logs,
      ...pending,
      ...batches.filter(batch => !logs.some(log => log.batch_id === batch.id)).slice(0, 4).map(batch => ({
        batch_number: batch.batch_number || batch.batch_code,
        product_name: batch.product_name,
        grade: batch.quality_grade || 'Pending',
        passed: batch.status === 'completed',
        rejected: batch.status === 'rejected',
        inspection_date: batch.end_time ? batch.end_time.slice(0, 10) : 'Pending',
        notes: batch.notes || 'Awaiting QC completion'
      }))
    ];
    const passedCount = rows.filter(item => item.passed).length;
    const rejectedCount = rows.filter(item => item.rejected || item.status === 'rejected' || item.grade === 'Reject').length;
    const pendingCount = rows.filter(item => item.pending || (!item.passed && !item.rejected && item.status !== 'rejected' && item.grade !== 'Reject')).length;
    createModal('Quality Control Log', `
      <div class="grid grid-cols-3 gap-sm mb-md">
        <div class="p-sm rounded-lg bg-primary/10"><p class="font-label-sm text-label-sm text-on-surface-variant">Passed</p><p class="font-headline-sm text-headline-sm text-primary">${passedCount}</p></div>
        <div class="p-sm rounded-lg bg-error-container/20"><p class="font-label-sm text-label-sm text-on-surface-variant">Rejected</p><p class="font-headline-sm text-headline-sm text-error">${rejectedCount}</p></div>
        <div class="p-sm rounded-lg bg-secondary-container"><p class="font-label-sm text-label-sm text-on-secondary-container">Pending</p><p class="font-headline-sm text-headline-sm text-on-secondary-container">${pendingCount}</p></div>
      </div>
      <div class="space-y-sm">
        ${rows.map(item => `
          <div class="p-sm rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md">${item.batch_number} - ${item.product_name || 'Production batch'}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${item.inspection_date} - Grade ${item.grade || 'Pending'} - ${item.notes || 'No notes'}</p>
            </div>
            ${statusBadge(item.passed ? 'completed' : (item.rejected || item.status === 'rejected' || item.grade === 'Reject') ? 'rejected' : 'pending')}
          </div>
        `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant text-body-sm">No QC records yet.</div>'}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  async function showQualityCheckpointModal() {
    const batches = await window.productionModule.getBatches();
    const overlay = createModal('Add Quality Checkpoint', `
      <form data-qc-checkpoint-form class="space-y-md">
        ${selectField('batch_id', 'Batch', batches.map(batch => [batch.id, `${batch.batch_number || batch.batch_code} - ${batch.product_name || 'Batch'}`]))}
        ${selectField('check_type', 'Checkpoint', [['temperature', 'Verify Temperature'], ['density', 'Inspect Density'], ['contamination', 'Material Contamination Sweep'], ['packaging', 'Packaging & Label Check']])}
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Notes</span>
          <textarea name="notes" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" rows="3" placeholder="What should QC verify?"></textarea>
        </label>
        ${modalActions('Add Checkpoint')}
      </form>
    `);
    overlay.querySelector('[data-qc-checkpoint-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const batch = batches.find(item => item.id === data.get('batch_id'));
      const logs = readJson('eden_qc_logs', []);
      logs.unshift({
        id: `qc-${Date.now()}`,
        batch_id: batch?.id,
        batch_number: batch?.batch_number || batch?.batch_code,
        product_name: batch?.product_name,
        inspection_date: new Date().toISOString().slice(0, 10),
        grade: 'Pending',
        passed: false,
        check_type: data.get('check_type'),
        notes: data.get('notes') || 'Manual checkpoint added'
      });
      localStorage.setItem('eden_qc_logs', JSON.stringify(logs));
      overlay.remove();
      toast('Quality checkpoint added.', 'success');
      await renderProductionPage();
    });
  }

  function showLineDiagnosticsModal() {
    const machines = readJson('eden_machines', []);
    const overlay = createModal('Line Diagnostics', `
      <div class="space-y-sm">
        ${(machines.length ? machines : [{ name: 'EKO Polish Mixer', status: 'operational', capacity_kg_hr: 60 }]).map(machine => `
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant hover:shadow-sm transition-all cursor-pointer" data-diagnostic-machine="${machine.id || machine.name}">
            <div class="flex items-center justify-between gap-md">
              <div>
                <p class="font-label-md text-label-md">${machine.name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(machine.type || 'line')} • Capacity ${Number(machine.capacity_kg_hr || 0).toLocaleString('en-KE')} kg/hr</p>
              </div>
              ${statusBadge(machine.status || 'operational')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
    overlay.querySelectorAll('[data-diagnostic-machine]').forEach(row => {
      row.addEventListener('click', () => {
        const machine = machines.find(item => String(item.id || item.name) === row.dataset.diagnosticMachine);
        overlay.remove();
        showMachineStatusModal(machine || {});
      });
    });
  }

  function showMachineDetail(machine = {}) {
    createModal('Machine Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Machine', machine.name || 'Production line'],
          ['Type', formatLabel(machine.type || 'line')],
          ['Location', machine.location || 'Production hall'],
          ['Status', formatLabel(machine.status || 'operational')],
          ['Capacity', `${Number(machine.capacity_kg_hr || 0).toLocaleString('en-KE')} kg/hr`],
          ['Next Maintenance', machine.next_maintenance || 'Not scheduled']
        ])}
      </dl>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showMachineStatusModal(machine = {}) {
    const overlay = createModal('Update Line Status', `
      <form data-machine-status-form class="space-y-md">
        <dl class="divide-y divide-outline-variant">
          ${detailRows([
            ['Machine', machine.name || 'Production line'],
            ['Type', formatLabel(machine.type || 'line')],
            ['Location', machine.location || 'Production hall'],
            ['Capacity', `${Number(machine.capacity_kg_hr || 0).toLocaleString('en-KE')} kg/hr`],
            ['Next Maintenance', machine.next_maintenance || 'Not scheduled']
          ])}
        </dl>
        ${selectField('status', 'Current status', [['operational', 'Operational'], ['idle', 'Idle'], ['maintenance', 'Maintenance'], ['offline', 'Offline']], machine.status || 'operational')}
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Operator note</span>
          <textarea name="notes" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Temperature, vibration, downtime reason, spare parts needed...">${machine.notes || ''}</textarea>
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Next maintenance date</span>
          <input name="next_maintenance" type="date" value="${machine.next_maintenance || ''}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
        </label>
        ${modalActions('Save Status')}
      </form>
    `);
    overlay.querySelector('[data-machine-status-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const machines = readJson('eden_machines', []);
      const id = machine.id || machine.name;
      const idx = machines.findIndex(item => String(item.id || item.name) === String(id));
      const update = {
        ...machine,
        id,
        status: data.get('status'),
        notes: data.get('notes'),
        next_maintenance: data.get('next_maintenance'),
        updated_at: new Date().toISOString()
      };
      if (idx >= 0) machines[idx] = { ...machines[idx], ...update };
      else machines.unshift(update);
      localStorage.setItem('eden_machines', JSON.stringify(machines));
      if (['maintenance', 'offline'].includes(update.status)) createMaintenanceTask(update);
      appendProductionEvent(id, 'machine_status', `${update.name || id} set to ${formatLabel(update.status)}.`);
      overlay.remove();
      toast('Line diagnostics updated.', 'success');
      await renderProductionPage();
    });
  }

  function showBatchDetail(batch = {}) {
    createModal('Batch Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Batch', batch.batch_number || batch.batch_code || batch.id || 'Batch'],
          ['Product', batch.product_name || 'Unassigned'],
          ['Raw Material', batch.raw_material_name || 'Not assigned'],
          ['Input', `${Number(batch.input_kg || 0).toLocaleString('en-KE')} kg`],
          ['Output', batch.output_kg ? `${Number(batch.output_kg).toLocaleString('en-KE')} kg` : 'Pending'],
          ['Operator', batch.operator_name || 'Current user'],
          ['Status', formatLabel(batch.status || 'planned')]
        ])}
      </dl>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showQcRecordModal(item = {}) {
    const id = item.id || item.batch_id || item.batch_number || item.batch_code;
    const isComplete = item.status === 'completed';
    const isRejected = item.status === 'rejected';
    const overlay = createModal('Record QC Check', `
      <form data-qc-record-form class="space-y-md">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-sm">
          <div class="p-sm rounded-lg bg-surface-container-low">
            <p class="font-label-sm text-label-sm text-on-surface-variant">Batch / Cycle</p>
            <p class="font-label-md text-label-md text-on-surface">${item.batch_number || item.batch_code || item.id || 'Unassigned'}</p>
          </div>
          <div class="p-sm rounded-lg bg-surface-container-low">
            <p class="font-label-sm text-label-sm text-on-surface-variant">Product</p>
            <p class="font-label-md text-label-md text-on-surface">${item.product_name || 'Production batch'}</p>
          </div>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant">QC Inspector records pass/reject evidence. Production Lead reviews rejected batches before rework or disposal. Passed batches close the cycle and release finished stock.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          ${selectField('grade', 'Quality grade', [['A', 'A - Release'], ['B', 'B - Release with note'], ['C', 'C - Rework watch'], ['Reject', 'Reject']], isRejected ? 'Reject' : item.quality_grade || 'A')}
          ${numberField('output_kg', 'Accepted output (kg)', Number(item.output_qty_kg || item.output_kg || item.input_kg || 0))}
          ${qcNumberField('sample_size', 'Sample size', 5)}
          ${qcNumberField('defects_found', 'Defects found', isRejected ? 1 : 0)}
          ${qcNumberField('moisture_pct', 'Moisture / consistency %', 2.5)}
          ${qcNumberField('contamination_pct', 'Contamination %', 0)}
        </div>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Inspection notes</span>
          <textarea name="notes" rows="4" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Record visual check, texture/finish, packaging, labels, smell, contamination, and corrective actions.">${item.notes || ''}</textarea>
        </label>
        <div class="flex flex-wrap justify-end gap-sm pt-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
          <button type="submit" data-qc-result="rejected" class="px-md py-sm border border-error text-error rounded-full font-label-md text-label-md hover:bg-error-container/20 active:scale-95 transition-all" ${isComplete ? 'disabled' : ''}>Mark Rejected</button>
          <button type="submit" data-qc-result="passed" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all" ${isRejected ? 'disabled' : ''}>Mark Passed</button>
        </div>
      </form>
    `);
    overlay.querySelectorAll('[data-qc-result]').forEach(button => {
      button.addEventListener('click', () => {
        overlay.querySelector('[data-qc-record-form]').dataset.result = button.dataset.qcResult;
      });
    });
    overlay.querySelector('[data-qc-record-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await recordQcResult(id, {
        passed: event.currentTarget.dataset.result !== 'rejected',
        grade: data.get('grade'),
        output_kg: Number(data.get('output_kg')),
        sample_size: Number(data.get('sample_size')),
        defects_found: Number(data.get('defects_found')),
        moisture_pct: Number(data.get('moisture_pct')),
        contamination_pct: Number(data.get('contamination_pct')),
        notes: data.get('notes')
      });
      overlay.remove();
    });
  }

  function showProductionProgressModal(cycleId) {
    const cycle = readJson('eden_production_cycles', []).find(item => item.id === cycleId);
    if (!cycle) return;
    const overlay = createModal('Record Production Progress', `
      <form data-production-progress-form class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low">
          <p class="font-label-md text-label-md">${cycle.product_name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${cycle.batch_number || cycle.id} - Target ${Number(cycle.output_qty_kg || 0).toLocaleString('en-KE')} kg</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          ${qcNumberField('actual_output_kg', 'Current output (kg)', cycle.actual_output_kg || 0)}
          ${qcNumberField('scrap_kg', 'Scrap / loss (kg)', cycle.scrap_kg || 0)}
          ${selectField('shift_status', 'Shift status', [['running', 'Running'], ['paused', 'Paused'], ['blocked', 'Blocked'], ['ready_qc', 'Ready for QC']], cycle.shift_status || 'running')}
          ${selectField('owner', 'Current owner', [['Production Operator', 'Production Operator'], ['Production Lead', 'Production Lead'], ['Maintenance Lead', 'Maintenance Lead'], ['QC Inspector', 'QC Inspector']], cycle.owner || 'Production Lead')}
        </div>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Production note</span>
          <textarea name="notes" rows="4" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Record temperature, line speed, downtime, packaging status, staffing or material issues.">${cycle.production_notes || ''}</textarea>
        </label>
        <div class="flex flex-wrap justify-end gap-sm pt-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
          <button type="submit" name="action" value="save" class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md hover:bg-surface-container-low">Save Progress</button>
          <button type="submit" name="action" value="qc" class="px-md py-sm bg-secondary text-on-secondary rounded-full font-label-md text-label-md hover:opacity-90">Save & Send To QC</button>
        </div>
      </form>
    `);
    overlay.querySelectorAll('button[type="submit"]').forEach(button => {
      button.addEventListener('click', () => {
        overlay.querySelector('[data-production-progress-form]').dataset.action = button.value;
      });
    });
    overlay.querySelector('[data-production-progress-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const cycles = readJson('eden_production_cycles', []);
      const idx = cycles.findIndex(item => item.id === cycleId);
      if (idx >= 0) {
        cycles[idx] = {
          ...cycles[idx],
          actual_output_kg: Number(data.get('actual_output_kg')),
          scrap_kg: Number(data.get('scrap_kg')),
          shift_status: data.get('shift_status'),
          owner: data.get('owner'),
          production_notes: data.get('notes'),
          status: event.currentTarget.dataset.action === 'qc' || data.get('shift_status') === 'ready_qc' ? 'qc_check' : 'in_progress',
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
        appendProductionEvent(cycleId, 'production_progress', `Progress recorded: ${Number(data.get('actual_output_kg')).toLocaleString('en-KE')} kg output, ${Number(data.get('scrap_kg')).toLocaleString('en-KE')} kg scrap.`);
      }
      overlay.remove();
      toast('Production progress recorded.', 'success');
      await renderProductionPage();
    });
  }

  function showReworkPlanModal(cycleId) {
    const cycle = readJson('eden_production_cycles', []).find(item => item.id === cycleId);
    if (!cycle) return;
    const overlay = createModal('Rework Plan', `
      <form data-rework-form class="space-y-md">
        <div class="p-sm rounded-lg bg-error-container/20 border border-outline-variant">
          <p class="font-label-md text-label-md">${cycle.product_name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${cycle.batch_number || cycle.id} - Rejected QC requires Production Lead decision.</p>
        </div>
        ${selectField('decision', 'Disposition', [['rework', 'Rework batch'], ['scrap', 'Scrap / dispose'], ['hold', 'Hold for investigation']], 'rework')}
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Corrective action</span>
          <textarea name="notes" required rows="4" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="What failed, who owns correction, and what must be verified before release?">${cycle.rework_notes || ''}</textarea>
        </label>
        ${modalActions('Save Rework Plan')}
      </form>
    `);
    overlay.querySelector('[data-rework-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const cycles = readJson('eden_production_cycles', []);
      const idx = cycles.findIndex(item => item.id === cycleId);
      if (idx >= 0) {
        cycles[idx] = {
          ...cycles[idx],
          rework_decision: data.get('decision'),
          rework_notes: data.get('notes'),
          owner: data.get('decision') === 'hold' ? 'Production Lead / QC Inspector' : 'Production Lead',
          status: data.get('decision') === 'rework' ? 'in_progress' : 'rejected',
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
      }
      createProductionTask(cycle, `Rework plan: ${formatLabel(data.get('decision'))}`, data.get('notes'));
      appendProductionEvent(cycleId, 'rework_plan', `${formatLabel(data.get('decision'))}: ${data.get('notes')}`);
      overlay.remove();
      toast('Rework plan saved.', 'success');
      await renderProductionPage();
    });
  }

  function showProductionMaterialDetail(material = {}) {
    createModal('Production Material Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Material', material.name || 'Material'],
          ['Category', formatLabel(material.category || 'general')],
          ['Stock', `${Number(material.quantity_kg || 0).toLocaleString('en-KE')} kg`],
          ['Threshold', `${Number(material.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg`],
          ['Supplier', material.supplier_name || 'Not assigned'],
          ['Production Status', Number(material.quantity_kg || 0) <= Number(material.reorder_threshold_kg || 0) ? 'Needs replenishment' : 'Ready']
        ])}
      </dl>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showProductFlowDetail(product = {}, materials = []) {
    const recipe = getProductRecipe(product);
    const readiness = calculateReadiness(recipe, materials);
    createModal('Product Flow Detail', `
      <div class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low">
          <p class="font-label-md text-label-md">${product.name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${product.sku || product.id} • ${formatLabel(product.category || 'finished product')}</p>
        </div>
        <div>
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Raw Materials</p>
          <div class="space-y-xs">${recipe.length ? recipe.map(item => `<div class="flex justify-between gap-md"><span>${item.material_name}</span><strong>${Number(item.kg_per_kg || 0).toLocaleString('en-KE')} kg/kg</strong></div>`).join('') : 'No recipe configured.'}</div>
        </div>
        <div class="p-sm rounded-lg ${readiness.ready ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}">${readiness.message} Possible run: ${readiness.possibleKg.toLocaleString('en-KE')} kg.</div>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function setChartMode(mode) {
    const buttons = Array.from(document.querySelectorAll('button')).filter(button => ['Weekly', 'Daily'].includes(button.innerText.trim()));
    buttons.forEach(button => {
      const active = button.innerText.trim() === mode;
      button.classList.toggle('bg-secondary', active);
      button.classList.toggle('text-on-secondary', active);
      button.classList.toggle('border', !active);
      button.classList.toggle('border-outline-variant', !active);
    });
    const multiplier = mode === 'Weekly' ? 6.4 : 1;
    document.querySelectorAll('.h-64.flex.items-end .rounded-t-lg').forEach((bar, index) => {
      const base = [60, 85, 45, 70, 30][index % 5];
      bar.style.height = `${Math.min(95, Math.max(12, Math.round(base * (mode === 'Weekly' ? 1.05 : 1))))}%`;
    });
    setMetricAfterLabel('TOTAL OUTPUT', `${Math.round(1240 * multiplier).toLocaleString('en-KE')} kg`);
    toast(`Output chart set to ${mode}.`, 'info');
  }

  function createMaterialRequest(product, outputQty, requirements, source) {
    const requests = readJson('eden_material_requests', []);
    const tasks = readJson('eden_tasks', []);
    const reservations = readJson('eden_inventory_reservations', []);
    const id = `MR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const request = {
      id,
      product_id: product?.id,
      product_name: product?.name || 'Production product',
      output_qty_kg: outputQty,
      requirements,
      source,
      status: 'requested',
      requested_by: window.appState?.user?.name || 'Production Operator',
      department: 'Production',
      created_at: new Date().toISOString()
    };
    requests.unshift(request);
    requirements.forEach(item => reservations.unshift({
      id: `RES-${id}-${item.material_id || slugify(item.material_name)}`,
      request_id: id,
      product_name: request.product_name,
      material_id: item.material_id || null,
      material_name: item.material_name,
      quantity_kg: item.required_kg,
      status: 'requested',
      created_at: request.created_at
    }));
    tasks.unshift({
      id: `task-${id}`,
      title: `Issue raw materials for ${request.product_name}`,
      description: requirements.map(item => `${item.material_name}: ${Number(item.required_kg || 0).toLocaleString('en-KE')} kg`).join('; '),
      department: 'Inventory',
      priority: requirements.some(item => item.shortfall_kg > 0) ? 'high' : 'medium',
      status: 'open',
      source_module: 'production_monitoring',
      material_request_id: id,
      assigned_to: 'Inventory Lead',
      created_at: request.created_at
    });
    localStorage.setItem('eden_material_requests', JSON.stringify(requests));
    localStorage.setItem('eden_inventory_reservations', JSON.stringify(reservations));
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    const notificationKey = `eden_notifications_${window.appState?.user?.id || 'local'}`;
    const notifications = readJson(notificationKey, []);
    notifications.unshift({
      id: `notif-${id}`,
      type: 'production_material_request',
      title: 'Material request sent to Inventory',
      message: `${request.product_name} requires ${requirements.length} raw material line${requirements.length === 1 ? '' : 's'}.`,
      read: false,
      created_at: request.created_at,
      material_request_id: id
    });
    localStorage.setItem(notificationKey, JSON.stringify(notifications));
    appendProductionEvent(id, 'material_request', `Material request created for ${request.product_name}.`);
    return request;
  }

  function createOrUpdateCycle({ product, outputQty, requirements, request = null, batch = null, status = 'material_requested' }) {
    const cycles = readJson('eden_production_cycles', []);
    const existingIndex = request ? cycles.findIndex(cycle => cycle.material_request_id === request.id) : -1;
    const current = existingIndex >= 0 ? cycles[existingIndex] : {};
    const cycle = {
      id: current.id || `PC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
      product_id: product?.id || current.product_id,
      product_name: product?.name || current.product_name || 'Production product',
      output_qty_kg: Number(outputQty || current.output_qty_kg || 0),
      requirements: requirements?.length ? requirements : current.requirements || [],
      material_request_id: request?.id || current.material_request_id || null,
      batch_id: batch?.id || current.batch_id || null,
      batch_number: batch?.batch_number || batch?.batch_code || current.batch_number || null,
      status,
      owner: status === 'material_requested' ? 'Inventory Lead' : status === 'qc_check' ? 'QC Inspector' : 'Production Lead',
      created_at: current.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (existingIndex >= 0) cycles[existingIndex] = cycle;
    else cycles.unshift(cycle);
    localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
    appendProductionEvent(cycle.id, 'cycle_update', `Cycle set to ${formatLabel(status)}.`);
    return cycle;
  }

  function mergeBatchCycles(cycles, batches) {
    const next = [...cycles];
    batches.forEach(batch => {
      if (next.some(cycle => cycle.batch_id === batch.id)) return;
      next.push({
        id: `PC-${batch.id}`,
        product_id: batch.product_id || null,
        product_name: batch.product_name || 'Production product',
        output_qty_kg: Number(batch.output_kg || batch.input_kg || 0),
        requirements: [],
        material_request_id: null,
        batch_id: batch.id,
        batch_number: batch.batch_number || batch.batch_code,
        status: batch.status === 'completed' ? 'completed' : batch.status === 'in_progress' ? 'in_progress' : 'material_requested',
        owner: batch.status === 'completed' ? 'Production Lead' : 'Production Operator',
        created_at: batch.start_time || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    return next.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  }

  async function startCycleProduction(cycleId) {
    const cycles = readJson('eden_production_cycles', []);
    const cycle = cycles.find(item => item.id === cycleId);
    if (!cycle) return;
    const [products, materials] = await Promise.all([getFinishedProducts(), getRawMaterials()]);
    const product = products.find(item => item.id === cycle.product_id) || { id: cycle.product_id, name: cycle.product_name };
    const primary = primaryMaterialForProduct(product, materials);
    const started = await window.productionModule.startBatch({
      product_id: product.id,
      product_name: product.name,
      raw_material_id: primary?.id,
      raw_material_name: primary?.name,
      input_kg: (cycle.requirements || []).reduce((sum, item) => sum + Number(item.required_kg || 0), 0),
      machine_id: product.name?.toLowerCase().includes('eko') ? 'eko-polish-mixer' : 'production-line',
      machine_name: product.name?.toLowerCase().includes('eko') ? 'EKO Polish Mixer' : 'Production Line',
      notes: `Started from production cycle ${cycle.id}`
    });
    if (started) {
      createOrUpdateCycle({
        product,
        outputQty: cycle.output_qty_kg,
        requirements: cycle.requirements,
        request: cycle.material_request_id ? { id: cycle.material_request_id } : null,
        batch: started,
        status: 'in_progress'
      });
      appendProductionEvent(cycle.id, 'production_started', `Batch ${started.batch_number || started.batch_code || started.id} started.`);
      toast('Production cycle started.', 'success');
      await renderProductionPage();
    } else {
      toast('Could not start production cycle.', 'error');
    }
  }

  async function updateCycleStatus(cycleId, status) {
    const cycles = readJson('eden_production_cycles', []);
    const idx = cycles.findIndex(item => item.id === cycleId);
    if (idx === -1) return;
    cycles[idx] = { ...cycles[idx], status, owner: status === 'qc_check' ? 'QC Inspector' : status === 'rejected' ? 'Production Lead / QC Inspector' : 'Production Lead', updated_at: new Date().toISOString() };
    localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
    appendProductionEvent(cycleId, 'status_change', `Cycle moved to ${formatLabel(status)}.`);
    toast(`Cycle moved to ${formatLabel(status)}.`, 'success');
    await renderProductionPage();
  }

  async function completeCycle(cycleId) {
    const cycles = readJson('eden_production_cycles', []);
    const cycle = cycles.find(item => item.id === cycleId);
    if (!cycle) return;
    if (cycle.batch_id) {
      await window.productionModule.completeBatch(cycle.batch_id, Number(cycle.output_qty_kg || 0), 'A', 'Completed from Production Batch Flow');
    }
    await updateCycleStatus(cycleId, 'completed');
  }

  async function markQcPassed(id) {
    await recordQcResult(id, {
      passed: true,
      grade: 'A',
      notes: 'Quick pass from production QC checklist.',
      sample_size: 5,
      defects_found: 0,
      moisture_pct: 0,
      contamination_pct: 0
    });
  }

  async function recordQcResult(id, result = {}) {
    const cycles = readJson('eden_production_cycles', []);
    const cycleIndex = cycles.findIndex(item => item.id === id || item.batch_id === id || item.batch_number === id);
    const cycle = cycleIndex >= 0 ? cycles[cycleIndex] : null;
    const batches = await window.productionModule.getBatches();
    const batch = batches.find(item => item.id === id || item.id === cycle?.batch_id || item.batch_number === id || item.batch_code === id || item.batch_number === cycle?.batch_number);
    const passed = !!result.passed;
    const outputKg = Number(result.output_kg || cycle?.output_qty_kg || batch?.output_kg || (Number(batch?.input_kg || 0) * 0.9) || 0);
    const notes = result.notes || (passed ? 'QC passed.' : 'QC rejected. Production Lead review required.');
    const log = {
      batch_id: batch?.id || cycle?.batch_id || null,
      batch_number: batch?.batch_number || batch?.batch_code || cycle?.batch_number || id,
      cycle_id: cycle?.id || null,
      product_name: cycle?.product_name || batch?.product_name || 'Production batch',
      grade: passed ? (result.grade || 'A') : 'Reject',
      passed,
      output_kg: outputKg,
      sample_size: Number(result.sample_size || 0),
      defects_found: Number(result.defects_found || 0),
      moisture_pct: Number(result.moisture_pct || 0),
      contamination_pct: Number(result.contamination_pct || 0),
      status: passed ? 'completed' : 'rejected',
      notes,
      inspection_date: new Date().toISOString().slice(0, 10),
      inspector_name: window.appState?.user?.name || 'QC Inspector'
    };

    if (window.productionModule.addQCLog) await window.productionModule.addQCLog(log);
    else {
      const logs = readJson('eden_qc_logs', []);
      logs.unshift({ id: `qc-${Date.now()}`, ...log });
      localStorage.setItem('eden_qc_logs', JSON.stringify(logs));
    }

    if (batch?.id && passed) {
      await window.productionModule.completeBatch(batch.id, outputKg, log.grade, notes);
    } else if (batch?.id && !passed) {
      const storedBatches = readJson('eden_production_batches', []);
      const batchIndex = storedBatches.findIndex(item => item.id === batch.id);
      if (batchIndex >= 0) {
        storedBatches[batchIndex] = { ...storedBatches[batchIndex], status: 'rejected', quality_grade: 'Reject', output_kg: 0, notes, end_time: new Date().toISOString() };
        localStorage.setItem('eden_production_batches', JSON.stringify(storedBatches));
      }
    }

    if (cycle) {
      cycles[cycleIndex] = {
        ...cycle,
        status: passed ? 'completed' : 'rejected',
        owner: passed ? 'Production Lead' : 'Production Lead / QC Inspector',
        qc_result: log,
        output_qty_kg: passed ? outputKg : cycle.output_qty_kg,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
    }

    if (!passed) createProductionTask(cycle || batch || { id, product_name: log.product_name }, 'QC rejection review', notes);
    appendProductionEvent(cycle?.id || id, passed ? 'qc_passed' : 'qc_rejected', `${passed ? 'Passed' : 'Rejected'} by ${log.inspector_name}. Grade ${log.grade}. ${notes}`);

    toast(passed ? 'QC recorded as passed. Cycle closed and stock released.' : 'QC recorded as rejected. Batch is held for Production Lead review.', passed ? 'success' : 'error');
    await renderProductionPage();
  }

  function findCycleOrBatch(id, cycles, batches) {
    return cycles.find(item => item.id === id || item.batch_id === id || item.batch_number === id) ||
      batches.find(item => item.id === id || item.batch_number === id || item.batch_code === id) || {};
  }

  function showCycleDetail(cycleId) {
    const cycle = readJson('eden_production_cycles', []).find(item => item.id === cycleId);
    if (!cycle) return;
    const qc = cycle.qc_result || {};
    const request = readJson('eden_material_requests', []).find(item => item.id === cycle.material_request_id);
    const events = readJson('eden_production_events', []).filter(item => item.entity_id === cycle.id || item.entity_id === cycle.material_request_id || item.entity_id === cycle.batch_id).slice(0, 8);
    createModal('Production Cycle Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Cycle', cycle.id],
          ['Product', cycle.product_name],
          ['Target Output', `${Number(cycle.output_qty_kg || 0).toLocaleString('en-KE')} kg`],
          ['Actual Output', cycle.actual_output_kg ? `${Number(cycle.actual_output_kg || 0).toLocaleString('en-KE')} kg` : 'Not recorded'],
          ['Scrap / Loss', cycle.scrap_kg ? `${Number(cycle.scrap_kg || 0).toLocaleString('en-KE')} kg` : 'Not recorded'],
          ['Material Request', cycle.material_request_id || 'None'],
          ['Batch', cycle.batch_number || cycle.batch_id || 'Not started'],
          ['Owner', cycle.owner || 'Production Lead'],
          ['Status', formatLabel(cycle.status)]
        ])}
      </dl>
      ${qc.inspection_date ? `
        <div class="mt-md p-sm rounded-lg ${qc.passed ? 'bg-primary/10' : 'bg-error-container/20'} border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">QC Result</p>
          <p class="font-label-md text-label-md">${qc.passed ? 'Passed' : 'Rejected'} - Grade ${qc.grade || 'Pending'} - ${qc.inspector_name || 'QC Inspector'}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${qc.inspection_date} - Defects ${Number(qc.defects_found || 0)} / Sample ${Number(qc.sample_size || 0)} - ${qc.notes || 'No notes'}</p>
        </div>
      ` : ''}
      ${cycle.production_notes ? `<div class="mt-md p-sm rounded-lg bg-surface-container-low"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Production Notes</p><p class="font-body-sm text-body-sm text-on-surface-variant">${cycle.production_notes}</p></div>` : ''}
      ${cycle.rework_notes ? `<div class="mt-md p-sm rounded-lg bg-error-container/20"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Rework / Hold Plan</p><p class="font-body-sm text-body-sm text-on-surface-variant">${formatLabel(cycle.rework_decision || 'review')} - ${cycle.rework_notes}</p></div>` : ''}
      <div class="mt-md">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Required Materials</p>
        <div class="space-y-xs">${(cycle.requirements?.length ? cycle.requirements : request?.requirements || []).map(item => `<div class="flex justify-between gap-md text-body-sm"><span>${item.material_name}</span><strong>${Number(item.required_kg || 0).toLocaleString('en-KE')} kg</strong></div>`).join('') || 'No material requirements recorded.'}</div>
      </div>
      <div class="mt-md">
        <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Timeline</p>
        <div class="space-y-xs">${events.map(event => `<div class="p-xs rounded-lg bg-surface-container-low text-body-sm"><strong>${formatLabel(event.type)}</strong> - ${event.message}<br><span class="text-on-surface-variant">${window.edenUtils?.formatDate(event.created_at) || event.created_at}</span></div>`).join('') || '<p class="text-body-sm text-on-surface-variant">No timeline events recorded yet.</p>'}</div>
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function cycleStageIndex(status) {
    return {
      material_requested: 0,
      materials_requested: 0,
      materials_issued: 1,
      in_progress: 2,
      qc_check: 3,
      rejected: 3,
      completed: 4
    }[status] ?? 0;
  }

  function appendProductionEvent(entityId, type, message) {
    const events = readJson('eden_production_events', []);
    events.unshift({
      id: `pe-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      entity_id: entityId,
      type,
      message,
      actor: window.appState?.user?.name || 'Production User',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_production_events', JSON.stringify(events.slice(0, 300)));
  }

  function createProductionTask(cycle = {}, title, description) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-prod-${Date.now()}`,
      title,
      description,
      department: 'Production',
      priority: 'high',
      status: 'open',
      source_module: 'production_monitoring',
      production_cycle_id: cycle.id || null,
      batch_id: cycle.batch_id || null,
      assigned_to: 'Production Lead',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function createMaintenanceTask(machine = {}) {
    const tasks = readJson('eden_tasks', []);
    if (tasks.some(task => task.machine_id === (machine.id || machine.name) && task.status === 'open')) return;
    tasks.unshift({
      id: `task-maint-${Date.now()}`,
      title: `Maintenance required: ${machine.name || machine.id}`,
      description: machine.notes || `${machine.name || 'Production line'} needs maintenance review before production continues.`,
      department: 'Maintenance',
      priority: machine.status === 'offline' ? 'high' : 'medium',
      status: 'open',
      source_module: 'production_monitoring',
      machine_id: machine.id || machine.name,
      assigned_to: 'Maintenance Lead',
      due_date: machine.next_maintenance || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function showProductionInboxModal() {
    const tasks = crossDepartmentTasks('Production');
    const demands = productionDemandRequests();
    const overlay = createModal('Urgent Production Inbox', `
      <div class="space-y-md">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Demand requests</p><p class="font-headline-sm text-headline-sm">${demands.length}</p></div>
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Production tasks</p><p class="font-headline-sm text-headline-sm">${tasks.length}</p></div>
          <div class="p-sm rounded-lg bg-error-container text-on-error-container"><p class="font-label-sm text-label-sm uppercase">Priority</p><p class="font-body-sm text-body-sm">Handle before routine batches.</p></div>
        </div>
        <div class="space-y-sm">
          ${demands.map(demand => inboxButton('demand', demand.id, `${demand.customer_name} demand`, demandSummary(demand), demand.status)).join('')}
          ${tasks.map(task => inboxButton('task', task.id, task.title, task.description, task.status)).join('')}
          ${!demands.length && !tasks.length ? '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No urgent Production handoffs.</div>' : ''}
        </div>
      </div>
    `);
    overlay.querySelectorAll('[data-inbox-open]').forEach(button => {
      button.addEventListener('click', () => showProductionInboxDetail(button.dataset.inboxOpen));
    });
  }

  function showProductionInboxDetail(value) {
    const [type, id] = String(value || '').split(':');
    const demands = readJson('eden_sales_demand_requests', []);
    const tasks = readJson('eden_tasks', []);
    const item = type === 'demand' ? demands.find(demand => demand.id === id) : tasks.find(task => task.id === id);
    if (!item) {
      toast('This inbox item is no longer available.', 'info');
      return;
    }
    const lines = type === 'demand' ? (item.lines || []) : [];
    const overlay = createModal(type === 'demand' ? item.id : item.title, `
      <div class="space-y-md">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          ${detailCell('Source', formatLabel(item.source_module || 'cross_department'))}
          ${detailCell('Status', formatLabel(item.status || 'open'))}
          ${detailCell('Customer', item.customer_name || item.related_customer_id || 'Not linked')}
          ${detailCell('Created', formatDate(item.created_at))}
        </dl>
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Action</p>
          <p class="font-body-md text-body-md text-on-surface">${type === 'demand' ? demandSummary(item) : item.description}</p>
        </div>
        ${lines.length ? `
          <div class="space-y-sm">
            <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Products needed</p>
            ${lines.map(line => `
              <div class="p-sm rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-between gap-md">
                <div><p class="font-label-md text-label-md">${line.product_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">Requested ${Number(line.requested_kg || 0).toLocaleString('en-KE')} kg - Available ${Number(line.available_kg || 0).toLocaleString('en-KE')} kg</p></div>
                <span class="font-label-md text-label-md text-error">${Number(line.shortage_kg || 0).toLocaleString('en-KE')} kg short</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="flex flex-wrap justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Close</button>
          ${type === 'demand' ? '<button type="button" data-production-demand-materials class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Request Materials</button>' : '<button type="button" data-production-inbox-progress class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Start Work</button>'}
          <button type="button" data-production-open-flow class="px-md py-sm border border-primary text-primary rounded-full font-label-md text-label-md">Open Flow</button>
        </div>
      </div>
    `);
    overlay.querySelector('[data-production-demand-materials]')?.addEventListener('click', async () => {
      const result = await createMaterialRequestsFromDemand(item);
      overlay.remove();
      toast(`${result.requests} material request${result.requests === 1 ? '' : 's'} sent to Inventory.`, 'success');
      await renderProductionPage();
      document.getElementById('material-request-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    overlay.querySelector('[data-production-inbox-progress]')?.addEventListener('click', async () => {
      updateInboxItem(type, id, 'in_progress');
      overlay.remove();
      toast('Production work started.', 'success');
      await renderProductionPage();
    });
    overlay.querySelector('[data-production-open-flow]')?.addEventListener('click', () => {
      overlay.remove();
      document.getElementById('production-cycle-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function createMaterialRequestsFromDemand(demand = {}) {
    const [products, materials] = await Promise.all([getFinishedProducts(), getRawMaterials()]);
    const requestIds = [];
    const cycleIds = [];
    (demand.lines || []).forEach(line => {
      const product = products.find(item => item.id === line.product_id) || {
        id: line.product_id,
        name: line.product_name,
        recipe: getProductRecipe({ name: line.product_name })
      };
      const outputQty = Number(line.requested_kg || line.shortage_kg || 0);
      if (!product?.id || outputQty <= 0) return;
      const requirements = calculateRequirements(product, outputQty).map(item => {
        const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
        const shortfall = Math.max(0, Number(item.required_kg || 0) - Number(material?.quantity_kg || 0));
        return { ...item, shortfall_kg: shortfall };
      });
      const request = createMaterialRequest(product, outputQty, requirements, `sales_demand:${demand.id}`);
      const cycle = createOrUpdateCycle({ product, outputQty, requirements, request, status: 'material_requested' });
      requestIds.push(request.id);
      cycleIds.push(cycle.id);
    });
    const demands = readJson('eden_sales_demand_requests', []).map(item => item.id === demand.id ? {
      ...item,
      status: 'materials_requested',
      material_request_ids: [...new Set([...(item.material_request_ids || []), ...requestIds])],
      production_cycle_ids: [...new Set([...(item.production_cycle_ids || []), ...cycleIds])],
      production_updated_at: new Date().toISOString()
    } : item);
    localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));
    return { requests: requestIds.length, cycles: cycleIds.length };
  }

  function updateInboxItem(type, id, status) {
    if (type === 'demand') {
      const demands = readJson('eden_sales_demand_requests', []).map(demand => demand.id === id ? { ...demand, status, production_updated_at: new Date().toISOString() } : demand);
      localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));
      return;
    }
    const tasks = readJson('eden_tasks', []).map(task => task.id === id ? { ...task, status, updated_at: new Date().toISOString() } : task);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function productionDemandRequests() {
    return readJson('eden_sales_demand_requests', [])
      .filter(demand => ['queued_for_production', 'production_review', 'materials_requested', 'in_production'].includes(String(demand.status || '').toLowerCase()))
      .slice(0, 8);
  }

  function crossDepartmentTasks(department) {
    return readJson('eden_tasks', [])
      .filter(task => String(task.department || '').toLowerCase() === department.toLowerCase())
      .filter(task => ['open', 'queued', 'in_progress'].includes(String(task.status || 'open').toLowerCase()))
      .filter(task => ['sales_distribution', 'customer_crm'].includes(String(task.source_module || '').toLowerCase()))
      .slice(0, 8);
  }

  function demandSummary(demand) {
    const lines = demand.lines || [];
    const totalShort = lines.reduce((sum, line) => sum + Number(line.shortage_kg || 0), 0);
    return `${lines.length} product line${lines.length === 1 ? '' : 's'} - ${totalShort.toLocaleString('en-KE')} kg short - ${formatLabel(demand.reason || 'stock demand')}`;
  }

  function inboxButton(type, id, title, description, status) {
    return `
      <button type="button" data-inbox-open="${type}:${id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant hover:border-primary transition-all">
        <div class="flex items-start justify-between gap-md">
          <div class="min-w-0"><p class="font-label-md text-label-md text-on-surface truncate">${title}</p><p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${description}</p></div>
          ${statusBadge(status || 'open')}
        </div>
      </button>
    `;
  }

  function detailCell(label, value) {
    return `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`;
  }

  function compactInboxText(value) {
    return String(value || '')
      .replace(/Review raw materials, open a production batch, and update Sales when finished stock is available\.?/i, 'Produce and update Sales.')
      .replace(/Confirm finished stock, expected completion date, and notify Sales before an order is created\.?/i, 'Confirm stock for Sales.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function calculateRequirements(product, outputQty) {
    const recipe = getProductRecipe(product);
    return recipe.map(item => ({
      ...item,
      required_kg: roundKg(Number(item.kg_per_kg || 0) * Number(outputQty || 0))
    }));
  }

  function calculateReadiness(recipe, materials) {
    if (!recipe.length) return { ready: false, possibleKg: 0, message: 'Recipe not configured.' };
    const rows = recipe.map(item => {
      const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
      const possible = Number(item.kg_per_kg || 0) > 0 ? Math.floor(Number(material?.quantity_kg || 0) / Number(item.kg_per_kg || 1)) : 0;
      return { item, material, possible };
    });
    const limiting = rows.sort((a, b) => a.possible - b.possible)[0];
    const ready = rows.every(row => row.material && Number(row.material.quantity_kg || 0) > Number(row.material.reorder_threshold_kg || 0));
    return {
      ready,
      possibleKg: limiting?.possible || 0,
      message: ready ? 'Inputs are above reorder thresholds.' : `${limiting?.item.material_name || 'A material'} needs review before the next run.`
    };
  }

  function getProductRecipe(product = {}) {
    if (Array.isArray(product.recipe) && product.recipe.length) return product.recipe;
    const name = String(product.name || '').toLowerCase();
    if (name.includes('pet')) return [{ material_id: 'raw-1', material_name: 'Refined PET Flakes', kg_per_kg: 1.15 }];
    if (name.includes('hdpe')) return [{ material_id: 'raw-2', material_name: 'HDPE Pellets', kg_per_kg: 1.08 }];
    if (name.includes('ldpe')) return [{ material_id: 'raw-3', material_name: 'LDPE Film', kg_per_kg: 1.12 }];
    if (name.includes('pp')) return [{ material_id: 'raw-4', material_name: 'Mixed PP Regrind', kg_per_kg: 1.15 }];
    if (name.includes('eko shoe polish')) return getEkoRecipe(product);
    return [];
  }

  function getEkoRecipe(product) {
    if (Array.isArray(product.recipe) && product.recipe.length) return product.recipe;
    return [
      { material_id: 'raw-6', material_name: 'Paraffin Wax', kg_per_kg: 0.28 },
      { material_id: 'raw-7', material_name: 'Carnauba Wax', kg_per_kg: 0.12 },
      { material_id: 'raw-8', material_name: 'Beeswax', kg_per_kg: 0.10 },
      { material_id: 'raw-9', material_name: 'Carbon Black Pigment', kg_per_kg: 0.08 },
      { material_id: 'raw-10', material_name: 'Mineral Oil', kg_per_kg: 0.22 },
      { material_id: 'raw-11', material_name: 'Turpentine Solvent', kg_per_kg: 0.18 },
      { material_id: 'raw-12', material_name: 'Polish Tins & Labels', kg_per_kg: 0.02 }
    ];
  }

  function productionProcedure(product) {
    const name = String(product.name || '').toLowerCase();
    if (name.includes('eko shoe polish')) {
      return [
        '1. Verify waxes, pigment, oil, solvent, tins, and labels are issued by Inventory.',
        '2. Heat wax blend under controlled temperature until fully melted.',
        '3. Mix pigment and oil into the wax base until uniform.',
        '4. Add solvent under ventilation and mix to target consistency.',
        '5. Fill tins, cool, label, and move samples to QC.'
      ];
    }
    return [
      '1. Confirm raw material batch is issued and clean.',
      '2. Prepare machine line and set production parameters.',
      '3. Feed material gradually and monitor output quality.',
      '4. Record output weight, losses, and operator notes.',
      '5. Send sample to QC before finished stock is released.'
    ];
  }

  function primaryMaterialForProduct(product, materials) {
    const recipe = getProductRecipe(product);
    return materials.find(material => material.id === recipe[0]?.material_id || material.name === recipe[0]?.material_name) || materials[0];
  }

  async function getRawMaterials() {
    if (window.inventoryModule?.getRawMaterials) return window.inventoryModule.getRawMaterials();
    return readJson('eden_raw_materials', []);
  }

  async function getFinishedProducts() {
    if (window.inventoryModule?.getFinishedProducts) return window.inventoryModule.getFinishedProducts();
    return readJson('eden_finished_products', []);
  }

  function setMetricAfterLabel(label, value) {
    const labelEl = Array.from(document.querySelectorAll('p')).find(el => el.innerText.trim().toUpperCase() === label);
    const valueEl = labelEl?.parentElement?.querySelector('.font-headline-md');
    if (valueEl) valueEl.innerText = value;
  }

  function createModal(title, bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div><p class="font-label-sm text-label-sm text-primary uppercase">Production Control</p><h3 class="font-headline-md text-headline-md text-on-surface">${title}</h3></div>
          <button type="button" data-modal-close class="material-symbols-outlined p-xs rounded-full hover:bg-surface-container-high">close</button>
        </div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('[data-modal-card]');
    requestAnimationFrame(() => {
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');
    });
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-modal-close]')) overlay.remove();
    });
    return overlay;
  }

  function selectField(name, label, options, selected = '') {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
          ${options.map(([value, text]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${text}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function numberField(name, label, value) {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <input name="${name}" required min="1" step="0.1" type="number" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
      </label>
    `;
  }

  function qcNumberField(name, label, value) {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <input name="${name}" required min="0" step="0.1" type="number" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
      </label>
    `;
  }

  function modalActions(confirmLabel) {
    return `
      <div class="flex justify-end gap-sm pt-sm">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
        <button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">${confirmLabel}</button>
      </div>
    `;
  }

  function faqItem(question, answer) {
    return `
      <details class="p-md rounded-xl border border-outline-variant bg-surface-container-low">
        <summary class="font-label-md text-label-md text-on-surface cursor-pointer">${question}</summary>
        <p class="mt-sm font-body-sm text-body-sm text-on-surface-variant">${answer}</p>
      </details>
    `;
  }

  function detailRows(rows) {
    return rows.map(([label, value]) => `
      <div class="py-sm flex justify-between gap-md">
        <dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt>
        <dd class="font-body-md text-body-md text-on-surface text-right">${value}</dd>
      </div>
    `).join('');
  }

  function statusBadge(status = 'scheduled') {
    const label = formatLabel(status);
    const key = String(status).toLowerCase();
    const positive = ['stored', 'received', 'completed', 'consumed', 'in_stock'].includes(key);
    const warning = ['in_transit', 'processing', 'queued', 'requested', 'in_progress', 'low_stock'].includes(key);
    const danger = ['rejected', 'failed', 'cancelled'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : danger ? 'bg-error-container/20 text-error' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${label}</span>`;
  }

  function rawMaterialIcon(category) {
    const key = String(category || '').toLowerCase();
    if (key.includes('paper')) return 'description';
    if (key.includes('shoe') || key.includes('wax')) return 'science';
    if (key.includes('packaging')) return 'inventory_2';
    if (key.includes('plastic') || key.includes('hdpe') || key.includes('ldpe')) return 'recycling';
    return 'category';
  }

  function bindOne(element, key, handler) {
    if (!element || element.dataset.productionBound === key) return;
    element.dataset.productionBound = key;
    element.addEventListener('click', handler);
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function roundKg(value) {
    return Math.round(Number(value || 0) * 10) / 10;
  }

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function pageHref(page) {
    return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page;
  }

  function formatLabel(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
  }
})();
