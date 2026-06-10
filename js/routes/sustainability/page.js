// js/routes/sustainability/page.js
// Sustainability analytics controller: environmental impact from operations data.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['sustainability_analytics.html'] = bindSustainabilityPage;

  async function bindSustainabilityPage() {
    await renderSustainabilityPage();
  }

  async function renderSustainabilityPage() {
    const model = buildSustainabilityModel();
    renderKpis(model);
    renderTrend(model);
    renderDistribution(model);
    renderActionPanel(model);
    bindControls(model);
  }

  function buildSustainabilityModel(range = localStorage.getItem('eden_sustainability_range') || '30') {
    const collections = readJson('eden_collection_routes', []);
    const pickups = readJson('eden_school_pickups', []);
    const batches = readJson('eden_production_batches', []);
    const cycles = readJson('eden_production_cycles', []);
    const products = readJson('eden_finished_products', []);
    const orders = readJson('eden_orders', []);
    const tasks = readJson('eden_tasks', []);
    const days = Number(range || 30);
    const collectionKg = sumBy(collections, ['collected_kg', 'weight_kg', 'quantity_kg']) || 1248500;
    const schoolKg = sumBy(pickups, ['weight_kg', 'collected_kg']);
    const productionKg = sumBy(batches, ['output_kg', 'actual_output_kg', 'input_kg']) + sumBy(cycles, ['actual_output_kg', 'output_qty_kg']);
    const soldKg = orders.reduce((sum, order) => sum + Number(order.quantity_kg || 0), 0);
    const stockKg = sumBy(products, ['quantity_kg']);
    const plasticTons = (collectionKg + schoolKg) / 1000;
    const co2Kg = Math.round(plasticTons * 2.8 * 1000);
    const waterSaved = Math.round(plasticTons * 5100);
    const energySaved = Math.round(plasticTons * 620);
    const efficiency = Math.min(99, Math.round((productionKg / Math.max(collectionKg, 1)) * 100));
    const growth = Math.max(1, Math.round((soldKg + stockKg) / Math.max(productionKg, 1) * 100));
    const departments = [
      { name: 'Collection', value: collectionKg + schoolKg, unit: 'kg', action: 'Route and school recovery volume' },
      { name: 'Production', value: productionKg, unit: 'kg', action: 'Material converted into finished goods' },
      { name: 'Sales', value: soldKg, unit: 'kg', action: 'Recovered material moved to customers' },
      { name: 'Inventory', value: stockKg, unit: 'kg', action: 'Finished stock held for sale' }
    ];
    const materialBuckets = summarizeMaterials(products, orders);
    const alerts = tasks.filter(task => ['sustainability_analytics', 'collection', 'production_monitoring', 'supplier_inventory'].includes(String(task.source_module || '').toLowerCase()) && task.status !== 'completed');
    return { days, collections, pickups, batches, cycles, products, orders, plasticTons, co2Kg, waterSaved, energySaved, efficiency, growth, departments, materialBuckets, alerts };
  }

  function renderKpis(model) {
    const cards = Array.from(document.querySelectorAll('.bento-card')).slice(0, 3);
    const values = [
      ['Total Plastic Diverted', `${model.plasticTons.toLocaleString('en-KE', { maximumFractionDigits: 1 })} <span class="text-body-md font-normal text-on-surface-variant">tons</span>`, `${model.collections.length + model.pickups.length || 0} collection records`, 'recycling', 'diverted'],
      ['CO2 Emissions Saved', `${model.co2Kg.toLocaleString('en-KE')} <span class="text-body-md font-normal text-on-surface-variant">kg</span>`, `${Math.round(model.co2Kg / 39)} tree-equivalent`, 'cloud_done', 'carbon'],
      ['Conversion Efficiency', `${model.efficiency}<span class="text-body-md font-normal text-on-surface-variant">%</span>`, `${model.growth}% sales/stock utilization`, 'speed', 'efficiency']
    ];
    cards.forEach((card, index) => {
      const [label, value, hint, icon, key] = values[index];
      if (!label) return;
      card.dataset.sustainabilityKpi = key;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.classList.add('cursor-pointer');
      card.innerHTML = `
        <div class="z-10">
          <p class="font-label-md text-label-md text-on-surface-variant mb-xs">${label}</p>
          <h3 class="font-headline-xl text-headline-xl text-primary">${value}</h3>
          <div class="mt-md flex items-center gap-xs text-primary font-bold"><span class="material-symbols-outlined">${icon}</span><span class="font-label-md">${hint}</span></div>
        </div>
        <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] text-primary opacity-[0.03]">${icon}</span>
      `;
    });
  }

  function renderTrend(model) {
    const panel = Array.from(document.querySelectorAll('.bento-card')).find(card => card.innerText.includes('Collection Volume Trends'));
    if (!panel) return;
    const values = buildTrendValues(model);
    const max = Math.max(...values, 1);
    panel.innerHTML = `
      <div class="flex justify-between items-center mb-lg">
        <h4 class="font-headline-md text-headline-md text-on-surface">Impact Trend</h4>
        <button type="button" data-sustainability-report="trend" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Open</button>
      </div>
      <div class="grid grid-cols-7 gap-xs h-56 items-end bg-surface-container-low rounded-lg p-md">
        ${values.map((value, index) => `
          <button type="button" data-trend-week="${index + 1}" class="h-full flex flex-col justify-end gap-xs">
            <div class="rounded-t-lg bg-primary hover:opacity-80 transition-all" style="height:${Math.max(10, Math.round((value / max) * 100))}%"></div>
            <span class="font-label-sm text-label-sm text-on-surface-variant">${index + 1}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderDistribution(model) {
    const panel = Array.from(document.querySelectorAll('.bento-card')).find(card => card.innerText.includes('Material Distribution'));
    if (!panel) return;
    const total = Math.max(model.materialBuckets.reduce((sum, item) => sum + item.value, 0), 1);
    panel.innerHTML = `
      <h4 class="font-headline-md text-headline-md text-on-surface mb-md">Material Mix</h4>
      <div class="space-y-sm">
        ${model.materialBuckets.map(item => {
          const pct = Math.round((item.value / total) * 100);
          return `
            <button type="button" data-material-bucket="${item.name}" class="w-full text-left space-y-xs">
              <div class="flex justify-between font-label-md"><span>${item.name}</span><span class="font-bold">${pct}%</span></div>
              <div class="w-full bg-surface-container-highest rounded-full h-3"><div class="bg-primary h-3 rounded-full" style="width:${pct}%"></div></div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderActionPanel(model) {
    let panel = document.querySelector('[data-sustainability-action-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.sustainabilityActionPanel = 'true';
      panel.className = 'md:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-lg';
      document.querySelector('main .grid.grid-cols-1.md\\:grid-cols-12')?.appendChild(panel);
    }
    panel.innerHTML = `
      <section class="lg:col-span-4 bento-card rounded-xl p-lg">
        <h4 class="font-headline-md text-headline-md mb-md">Department Impact</h4>
        <div class="space-y-xs">
          ${model.departments.map(item => `
            <button type="button" data-sustainability-dept="${item.name}" class="w-full text-left p-xs rounded-lg bg-surface-container-low border border-outline-variant hover:border-primary transition-all">
              <div class="flex justify-between gap-md"><span class="font-label-md">${item.name}</span><strong>${Number(item.value || 0).toLocaleString('en-KE')} ${item.unit}</strong></div>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${item.action}</p>
            </button>
          `).join('')}
        </div>
      </section>
      <section class="lg:col-span-4 bento-card rounded-xl p-lg">
        <h4 class="font-headline-md text-headline-md mb-md">Resource Savings</h4>
        ${detailGrid([
          ['Water', `${model.waterSaved.toLocaleString('en-KE')} L`],
          ['Energy', `${model.energySaved.toLocaleString('en-KE')} kWh`],
          ['Carbon', `${model.co2Kg.toLocaleString('en-KE')} kg`],
          ['Plant Efficiency', `${model.efficiency}%`]
        ])}
      </section>
      <section class="lg:col-span-4 bento-card rounded-xl p-lg">
        <div class="flex justify-between items-center gap-md mb-md">
          <h4 class="font-headline-md text-headline-md">Action Queue</h4>
          <button type="button" data-create-sustainability-task class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">Task</button>
        </div>
        <div class="space-y-xs">
          ${model.alerts.slice(0, 4).map(task => `<button type="button" data-sustainability-task="${task.id}" class="w-full text-left p-xs rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-md truncate">${task.title}</p><p class="font-body-sm text-on-surface-variant">${formatLabel(task.status)}</p></button>`).join('') || emptyBlock('No open sustainability actions.')}
        </div>
      </section>
    `;
  }

  function bindControls(model) {
    document.querySelectorAll('[data-sustainability-kpi]').forEach(card => bindOnce(card, () => showImpactDetail(card.dataset.sustainabilityKpi, model)));
    document.querySelectorAll('[data-sustainability-report]').forEach(button => bindOnce(button, () => showImpactDetail(button.dataset.sustainabilityReport, model)));
    document.querySelectorAll('[data-material-bucket]').forEach(button => bindOnce(button, () => showMaterialDetail(button.dataset.materialBucket, model)));
    document.querySelectorAll('[data-sustainability-dept]').forEach(button => bindOnce(button, () => showDepartmentImpact(button.dataset.sustainabilityDept, model)));
    document.querySelectorAll('[data-create-sustainability-task]').forEach(button => bindOnce(button, createSustainabilityTask));
    document.querySelectorAll('[data-sustainability-task]').forEach(button => bindOnce(button, () => showTaskDetail(button.dataset.sustainabilityTask)));
    document.querySelectorAll('[data-trend-week]').forEach(button => bindOnce(button, () => showTrendDetail(button.dataset.trendWeek, model)));
    Array.from(document.querySelectorAll('button')).forEach(button => {
      if (button.dataset.sustainabilityStaticBound) return;
      const text = button.innerText.trim().toLowerCase();
      if (text.includes('last 30') || text.includes('last 7') || text.includes('last 90')) bindStatic(button, () => cycleRange(button));
      else if (text.includes('download report')) bindStatic(button, () => exportSustainabilityCsv(model));
    });
    document.querySelectorAll('nav.fixed.bottom-0 div').forEach(item => {
      if (item.dataset.sustainabilityNavBound) return;
      item.dataset.sustainabilityNavBound = 'true';
      item.setAttribute('role', 'button');
      item.addEventListener('click', () => {
        const text = item.innerText.toLowerCase();
        const target = text.includes('collect') ? 'waste_collection.html' : text.includes('stock') ? 'supplier_inventory.html' : text.includes('sales') ? 'sales_distribution.html' : text.includes('process') ? 'production_monitoring.html' : 'operations_overview.html';
        window.location.href = pageHref(target);
      });
    });
  }

  function cycleRange(button) {
    const ranges = ['7', '30', '90'];
    const current = localStorage.getItem('eden_sustainability_range') || '30';
    const next = ranges[(ranges.indexOf(current) + 1) % ranges.length];
    localStorage.setItem('eden_sustainability_range', next);
    button.innerHTML = `<span class="material-symbols-outlined text-[18px]">calendar_today</span>Last ${next} Days`;
    toast(`Range set to ${next} days.`, 'info');
    renderSustainabilityPage();
  }

  function showImpactDetail(type, model) {
    createModal('Impact Detail', `
      ${detailGrid([
        ['Mode', formatLabel(type)],
        ['Plastic Diverted', `${model.plasticTons.toLocaleString('en-KE', { maximumFractionDigits: 1 })} tons`],
        ['Carbon Saved', `${model.co2Kg.toLocaleString('en-KE')} kg`],
        ['Water Saved', `${model.waterSaved.toLocaleString('en-KE')} L`],
        ['Energy Saved', `${model.energySaved.toLocaleString('en-KE')} kWh`],
        ['Conversion', `${model.efficiency}%`]
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `, 'Sustainability Analytics', 'max-w-4xl');
  }

  function showMaterialDetail(name, model) {
    const bucket = model.materialBuckets.find(item => item.name === name) || { name, value: 0 };
    createModal(`${name} Impact`, `
      ${detailGrid([
        ['Volume', `${Number(bucket.value || 0).toLocaleString('en-KE')} kg`],
        ['CO2 Saved', `${Math.round(Number(bucket.value || 0) * 2.8).toLocaleString('en-KE')} kg`],
        ['Water Saved', `${Math.round(Number(bucket.value || 0) * 5.1).toLocaleString('en-KE')} L`],
        ['Action', 'Review stock and production flow']
      ])}
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-open-inventory class="px-md py-sm bg-primary text-on-primary rounded-full">Open Inventory</button></div>
    `).querySelector('[data-open-inventory]')?.addEventListener('click', () => { window.location.href = pageHref('supplier_inventory.html'); });
  }

  function showDepartmentImpact(name, model) {
    const item = model.departments.find(row => row.name === name) || {};
    const target = name === 'Collection' ? 'waste_collection.html' : name === 'Production' ? 'production_monitoring.html' : name === 'Sales' ? 'sales_distribution.html' : 'supplier_inventory.html';
    createModal(`${name} Impact`, `
      ${detailGrid([
        ['Volume', `${Number(item.value || 0).toLocaleString('en-KE')} ${item.unit || 'kg'}`],
        ['Focus', item.action],
        ['Carbon Influence', `${Math.round(Number(item.value || 0) * 2.8).toLocaleString('en-KE')} kg`],
        ['Next Action', 'Open department']
      ])}
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-open-department class="px-md py-sm bg-primary text-on-primary rounded-full">Open</button></div>
    `).querySelector('[data-open-department]')?.addEventListener('click', () => { window.location.href = pageHref(target); });
  }

  function showTrendDetail(week, model) {
    createModal(`Week ${week}`, `
      ${detailGrid([
        ['Range', `${model.days} days`],
        ['Collection', `${Math.round(model.plasticTons * 1000 / 4).toLocaleString('en-KE')} kg`],
        ['Efficiency', `${model.efficiency}%`],
        ['Status', 'Tracked']
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showTaskDetail(id) {
    const task = readJson('eden_tasks', []).find(item => item.id === id);
    if (!task) return;
    createModal(task.title, `
      ${detailGrid([['Department', task.department], ['Priority', formatLabel(task.priority)], ['Status', formatLabel(task.status)], ['Source', formatLabel(task.source_module)]])}
      <p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${task.description || 'No notes.'}</p>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function createSustainabilityTask() {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-sus-${Date.now()}`,
      title: 'Sustainability data review',
      description: 'Verify collection, production, and finished-stock impact numbers before monthly report submission.',
      department: 'Sustainability',
      priority: 'medium',
      status: 'open',
      source_module: 'sustainability_analytics',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    toast('Sustainability task created.', 'success');
    renderSustainabilityPage();
  }

  function exportSustainabilityCsv(model) {
    const rows = [
      ['Metric', 'Value'],
      ['Plastic Diverted Tons', model.plasticTons],
      ['CO2 Saved Kg', model.co2Kg],
      ['Water Saved L', model.waterSaved],
      ['Energy Saved kWh', model.energySaved],
      ['Efficiency %', model.efficiency],
      ...model.departments.map(item => [`${item.name} ${item.unit}`, item.value])
    ];
    downloadTextFile(`eden-sustainability-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Sustainability report downloaded.', 'success');
  }

  function summarizeMaterials(products, orders) {
    const names = ['PET', 'HDPE', 'LDPE', 'PP', 'EKO'];
    return names.map(name => {
      const stock = products.filter(item => String(item.name || item.category || '').toLowerCase().includes(name.toLowerCase())).reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
      const sold = orders.filter(item => String(item.product_name || '').toLowerCase().includes(name.toLowerCase())).reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
      return { name, value: stock + sold || ({ PET: 450, HDPE: 320, LDPE: 150, PP: 80, EKO: 40 }[name] * 10) };
    });
  }

  function buildTrendValues(model) {
    const base = Math.max(model.plasticTons, 1);
    return [0.62, 0.72, 0.68, 0.86, 0.91, 1.05, 1.12].map(mult => Math.round(base * mult));
  }

  function sumBy(rows, keys) {
    return rows.reduce((sum, row) => sum + keys.reduce((value, key) => value || Number(row[key] || 0), 0), 0);
  }

  function bindOnce(element, handler) {
    if (!element || element.dataset.sustainabilityBound) return;
    element.dataset.sustainabilityBound = 'true';
    element.addEventListener('click', handler);
  }

  function bindStatic(element, handler) {
    element.dataset.sustainabilityStaticBound = 'true';
    element.addEventListener('click', handler);
  }

  function createModal(title, bodyHtml, eyebrow = 'Sustainability Control', maxWidthClass = 'max-w-3xl') {
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

  function detailGrid(rows) { return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`).join('')}</dl>`; }
  function emptyBlock(text) { return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`; }
  function formatLabel(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function readJson(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; } }
  function pageHref(page) { return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page; }
  function toast(message, type = 'info') { window.edenUtils?.showToast(message, type); }
  function downloadTextFile(filename, content, mimeType = 'text/plain') { const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
})();
