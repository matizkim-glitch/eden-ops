// js/routes/inventory/page.js
// Inventory page controller: stock batches, raw materials, suppliers, and reorder workflows.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['supplier_inventory.html'] = bindInventoryPage;

  const escapeHTML = value => window.edenUtils?.escapeHTML
    ? window.edenUtils.escapeHTML(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  async function bindInventoryPage() {
    if (!window.inventoryModule) return;
    bindInventoryButtons();
    await renderInventoryPage();
  }

  function bindInventoryButtons() {
    const buttons = Array.from(document.querySelectorAll('button'));
    bindMany([
      ...buttons.filter(button => button.innerText.trim().includes('Add Batch')),
      ...document.querySelectorAll('[data-inventory-action="add-batch"]'),
      ...buttons.filter(button => button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'add')
    ], 'add-batch', showBatchModal);

    bindMany([
      ...buttons.filter(button => button.innerText.includes('Export PDF')),
      ...document.querySelectorAll('[data-inventory-action="export"]')
    ], 'export', exportInventoryCsv, button => {
      if (button.innerText.includes('PDF')) button.innerHTML = 'Export CSV';
    });

    const reorderButton = buttons.find(button => button.innerText.includes('Trigger Reorder'));
    bindOne(reorderButton, 'trigger-reorder', async () => {
      const lowStock = await window.inventoryModule.getLowStockMaterials();
      if (!lowStock.length) {
        toast('No low stock items need reordering.', 'success');
        return;
      }
      showReorderModal(lowStock[0]);
    });

    const automateButton = buttons.find(button => button.innerText.includes('Automate Restock Flow'));
    bindOne(automateButton, 'restock-flow', async () => {
      const lowStock = await window.inventoryModule.getLowStockMaterials();
      if (!lowStock.length) {
        toast('All material levels are healthy.', 'success');
        return;
      }
      const workflows = lowStock.map(material => createRestockWorkflow(material, 'flow'));
      toast(`${workflows.length} restock workflow${workflows.length === 1 ? '' : 's'} queued for procurement.`, 'success');
      await renderInventoryPage();
    });

    const linkSupplier = buttons.find(button => button.innerText.includes('Link New Supplier'));
    bindOne(linkSupplier, 'link-supplier', showSupplierModal);

    buttons
      .filter(button => button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'search')
      .forEach(button => bindOne(button, 'search', () => {
        const input = document.querySelector('[data-inventory-search]');
        if (input && input.getBoundingClientRect().width > 0) input.focus();
        else showSearchModal();
      }));

    document.querySelectorAll('[data-inventory-search]').forEach(input => {
      if (input.dataset.inventoryBound) return;
      input.dataset.inventoryBound = 'search';
      input.addEventListener('input', () => renderInventoryPage(input.value.trim().toLowerCase()));
    });
  }

  async function renderInventoryPage(filter = '') {
    const [materials, suppliers, batches, stats, products] = await Promise.all([
      window.inventoryModule.getRawMaterials(),
      window.inventoryModule.getSuppliers(),
      window.inventoryModule.getBatches(),
      window.inventoryModule.getSummaryStats(),
      window.inventoryModule.getFinishedProducts()
    ]);

    renderKpis(materials, batches, stats);
    renderInventoryUrgentInbox();
    renderRawMaterials(materials, suppliers, filter);
    renderFinishedProducts(products, filter);
    renderBatches(batches, filter);
    renderSuppliers(suppliers, filter);
    renderForecast(materials, suppliers);
    renderProductionMaterialRequests(materials);
    renderWorkflowPanel();
    bindInventoryButtons();
  }

  function renderKpis(materials, batches, stats) {
    const rawCard = cardByLabel('Raw Plastics');
    const totalRaw = Number(stats.totalRawKg || 0);
    const capacity = 65000;
    setCardValue(rawCard, `${totalRaw.toLocaleString('en-KE')} kg`);
    const rawBar = rawCard?.querySelector('.h-full');
    if (rawBar) rawBar.style.width = `${Math.min(100, Math.round((totalRaw / capacity) * 100))}%`;
    const rawCaption = rawCard?.querySelector('.font-label-sm.text-outline');
    if (rawCaption) rawCaption.innerText = `${Math.min(100, Math.round((totalRaw / capacity) * 100))}% of warehouse capacity`;

    const activeBatches = batches.filter(batch => ['processing', 'in_transit', 'stored'].includes(String(batch.status).toLowerCase()));
    const batchCard = cardByLabel('Processing Batches');
    setCardValue(batchCard, `${activeBatches.length} Active`);
    const batchCaption = batchCard?.querySelector('.font-label-sm.text-outline');
    if (batchCaption) batchCaption.innerText = `${batches.filter(batch => batch.status === 'in_transit').length} inbound batch${batches.filter(batch => batch.status === 'in_transit').length === 1 ? '' : 'es'}`;

    const lowItems = stats.lowStockItems || [];
    const alertCard = cardByLabel('Low Stock Alerts');
    setCardValue(alertCard, lowItems[0]?.name || 'None');
    const detail = alertCard?.querySelector('.font-body-sm');
    if (detail) {
      detail.innerText = lowItems[0]
        ? `Current: ${Number(lowItems[0].quantity_kg || 0).toLocaleString('en-KE')}kg | Threshold: ${Number(lowItems[0].reorder_threshold_kg || 0).toLocaleString('en-KE')}kg`
        : 'Every tracked raw material is above its reorder threshold.';
    }
    const alertChip = document.querySelector('header .bg-error-container .font-label-sm');
    if (alertChip) alertChip.innerText = `${lowItems.length} LOW STOCK ALERT${lowItems.length === 1 ? '' : 'S'}`;

    if (alertCard && !alertCard.querySelector('[data-configure-reorder]')) {
      const config = document.createElement('button');
      config.type = 'button';
      config.dataset.configureReorder = 'true';
      config.className = 'w-full py-xs border border-outline text-on-surface-variant font-label-md text-label-md rounded-full hover:bg-surface-container-low transition-colors';
      config.innerText = 'Set Reorder Rules';
      alertCard.appendChild(config);
      config.addEventListener('click', async () => {
        const currentLow = await window.inventoryModule.getLowStockMaterials();
        showReorderSettingsModal(currentLow[0] || materials[0]);
      });
    }
  }

  function renderInventoryUrgentInbox() {
    const main = document.querySelector('main');
    if (!main) return;
    const container = main.querySelector(':scope > .mt-20') || main;
    let panel = document.querySelector('[data-inventory-urgent-inbox]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.inventoryUrgentInbox = 'true';
      panel.className = 'fixed right-3 top-24 z-40 w-auto max-w-[calc(100vw-1.5rem)] overflow-visible';
    }
    if (!panel.isConnected) document.body.appendChild(panel);

    const tasks = crossDepartmentTasks('Inventory');
    const demands = readJson('eden_sales_demand_requests', [])
      .filter(demand => ['queued_for_production', 'production_review', 'materials_requested', 'in_production', 'inventory_review', 'partially_reserved', 'inventory_ready'].includes(String(demand.status || '').toLowerCase()))
      .slice(0, 6);
    const urgentItems = [
      ...demands.map(demand => ({ type: 'demand', id: demand.id, title: `${demand.customer_name} stock demand`, description: demandSummary(demand), status: demand.status, created_at: demand.created_at })),
      ...tasks.map(task => ({ type: 'task', id: task.id, title: task.title, description: task.description, status: task.status, created_at: task.created_at }))
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);

    const collapsed = sessionStorage.getItem('eden_inventory_inbox_open') !== 'true';
    panel.innerHTML = collapsed ? `
      <button type="button" data-inventory-inbox-toggle class="group flex items-center gap-xs rounded-full border border-error/25 bg-white/85 backdrop-blur-xl px-xs py-xs shadow-xl hover:shadow-2xl hover:-translate-x-1 transition-all">
        <span class="grid place-items-center w-9 h-9 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]">priority_high</span>
        <span class="hidden sm:block pr-xs font-label-md text-label-md text-on-surface">Inventory</span>
        <span class="min-w-6 h-6 px-2 rounded-full bg-error-container text-on-error-container text-[11px] font-bold grid place-items-center">${urgentItems.length}</span>
      </button>
    ` : `
      <div class="w-[min(300px,calc(100vw-1.5rem))] rounded-2xl border border-error/20 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div class="flex items-center justify-between gap-sm p-sm bg-gradient-to-r from-error-container/70 to-white/30">
        <div class="flex items-center gap-xs min-w-0">
          <span class="grid place-items-center w-9 h-9 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]">priority_high</span>
          <div class="min-w-0">
            <p class="font-label-md text-label-md text-on-surface">Inventory</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${urgentItems.length} handoff${urgentItems.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div class="flex items-center gap-xs">
          <button type="button" data-inventory-inbox-all class="grid place-items-center w-8 h-8 rounded-full bg-error text-on-error material-symbols-outlined text-[18px]" title="Open inbox">open_in_new</button>
          <button type="button" data-inventory-inbox-toggle class="grid place-items-center w-8 h-8 rounded-full bg-white/70 text-on-surface-variant material-symbols-outlined text-[18px]" title="Collapse">close</button>
        </div>
      </div>
      <div class="p-xs space-y-xs max-h-[48vh] overflow-y-auto">
        ${urgentItems.map(item => `
          <button type="button" data-inventory-inbox-item="${item.type}:${item.id}" class="w-full text-left p-xs rounded-xl bg-surface-container-lowest/90 border border-outline-variant hover:border-error hover:-translate-y-0.5 transition-all">
            <div class="flex items-center justify-between gap-sm">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate">${item.title}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${escapeHTML(compactInboxText(item.description))}</p>
              </div>
              ${statusBadge(item.status || 'open')}
            </div>
          </button>
        `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant bg-surface-container-lowest">No urgent handoffs.</div>'}
      </div>
      </div>
    `;

    bindOne(panel.querySelector('[data-inventory-inbox-toggle]'), 'inventory-inbox-toggle', () => {
      sessionStorage.setItem('eden_inventory_inbox_open', collapsed ? 'true' : 'false');
      renderInventoryUrgentInbox();
    });
    bindOne(panel.querySelector('[data-inventory-inbox-all]'), 'inventory-inbox-all', showInventoryInboxModal);
    panel.querySelectorAll('[data-inventory-inbox-item]').forEach(button => {
      bindOne(button, `inventory-inbox-${button.dataset.inventoryInboxItem}`, () => showInventoryInboxDetail(button.dataset.inventoryInboxItem));
    });
  }

  function renderBatches(batches, filter) {
    const tbody = Array.from(document.querySelectorAll('table tbody')).find(body => body.closest('section')?.innerText.includes('Material Batch Tracking'));
    if (!tbody) return;
    const rows = batches.filter(batch => `${batch.id} ${batch.material_name || ''} ${batch.supplier_name || ''} ${batch.status || ''}`.toLowerCase().includes(filter));
    tbody.innerHTML = rows.length ? rows.map((batch, index) => {
      const status = String(batch.status || 'stored').toLowerCase();
      const dot = status === 'processing' ? 'bg-secondary' : status === 'in_transit' ? 'bg-tertiary' : 'bg-primary';
      return `
        <tr class="${index % 2 ? 'bg-surface-container-low' : ''} hover:bg-surface-container-high transition-colors" data-batch-id="${batch.id}">
          <td class="px-lg py-md font-body-md text-body-md font-bold">#${String(batch.id || '').toUpperCase()}</td>
          <td class="px-lg py-md"><div class="flex items-center gap-xs"><span class="w-2 h-2 rounded-full ${dot}"></span><span class="font-body-md text-body-md">${batch.material_name || 'Unassigned'}</span></div></td>
          <td class="px-lg py-md font-body-md text-body-md">${Number(batch.weight_kg || 0).toLocaleString('en-KE')} kg</td>
          <td class="px-lg py-md font-body-md text-body-md">${batch.supplier_name || 'Internal transfer'}</td>
          <td class="px-lg py-md">
            <button type="button" class="hover:scale-105 transition-transform" data-status-edit="${batch.id}" title="Change status">${statusBadge(status)}</button>
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="5" class="px-lg py-xl text-center text-on-surface-variant">No matching batches found.</td></tr>';

    tbody.querySelectorAll('[data-status-edit]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const batch = batches.find(item => item.id === button.dataset.statusEdit);
        if (batch) showBatchStatusModal(batch);
      });
    });
    tbody.querySelectorAll('[data-batch-id]').forEach(row => {
      row.addEventListener('click', () => {
        const batch = batches.find(item => item.id === row.dataset.batchId);
        if (batch) showBatchStatusModal(batch);
      });
    });
  }

  function renderRawMaterials(materials, suppliers, filter) {
    const batchSection = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Material Batch Tracking'));
    if (!batchSection) return;

    let panel = document.getElementById('raw-materials-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'raw-materials-panel';
      panel.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm';
      panel.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
          <div>
            <h4 class="font-headline-sm text-headline-sm text-on-surface">Raw Materials In Stock</h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant">All inputs available for production, packaging, and procurement planning.</p>
          </div>
          <div class="flex items-center gap-sm">
            <span data-raw-total class="px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">0 kg</span>
            <button type="button" data-export-raw-materials class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">Export Raw</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left min-w-[860px]">
            <thead>
              <tr class="bg-surface-container-high">
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Material</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Category</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Quantity</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Threshold</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Preferred Supplier</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Unit Cost</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody data-raw-materials-body class="divide-y divide-outline-variant"></tbody>
          </table>
        </div>
      `;
      batchSection.insertAdjacentElement('beforebegin', panel);
    }

    const rows = materials.filter(material => {
      const haystack = `${material.name} ${material.category || ''} ${material.supplier_name || ''}`.toLowerCase();
      return !filter || haystack.includes(filter);
    });
    const totalKg = materials.reduce((sum, material) => sum + Number(material.quantity_kg || 0), 0);
    const totalBadge = panel.querySelector('[data-raw-total]');
    if (totalBadge) totalBadge.innerText = `${totalKg.toLocaleString('en-KE')} kg total`;

    const tbody = panel.querySelector('[data-raw-materials-body]');
    if (!tbody) return;
    tbody.innerHTML = rows.length ? rows.map(material => {
      const quantity = Number(material.quantity_kg || 0);
      const threshold = Number(material.reorder_threshold_kg || 0);
      const low = threshold > 0 && quantity <= threshold;
      const supplier = suppliers.find(item => item.id === material.supplier_id || item.id === material.preferred_supplier_id);
      return `
        <tr class="hover:bg-surface-container-low transition-colors cursor-pointer" data-material-id="${material.id}">
          <td class="px-md py-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined p-xs rounded-lg ${low ? 'bg-error-container text-error' : 'bg-primary-container text-on-primary-container'}">${rawMaterialIcon(material.category)}</span>
              <div>
                <p class="font-label-md text-label-md text-on-surface">${escapeHTML(material.name)}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHTML(material.id)}</p>
              </div>
            </div>
          </td>
          <td class="px-md py-md font-body-md text-body-md">${formatLabel(material.category || 'general')}</td>
          <td class="px-md py-md font-body-md text-body-md">${quantity.toLocaleString('en-KE')} kg</td>
          <td class="px-md py-md font-body-md text-body-md">${threshold.toLocaleString('en-KE')} kg</td>
          <td class="px-md py-md font-body-md text-body-md">${escapeHTML(supplier?.name || material.supplier_name || 'Not assigned')}</td>
          <td class="px-md py-md font-body-md text-body-md">KES ${Number(material.unit_cost || 0).toLocaleString('en-KE')}</td>
          <td class="px-md py-md">${statusBadge(low ? 'low_stock' : 'in_stock')}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7" class="px-md py-xl text-center text-on-surface-variant">No raw materials match the current search.</td></tr>';

    tbody.querySelectorAll('[data-material-id]').forEach(row => {
      row.addEventListener('click', () => {
        const material = materials.find(item => item.id === row.dataset.materialId);
        if (material) showRawMaterialDetail(material, suppliers);
      });
    });

    const exportButton = panel.querySelector('[data-export-raw-materials]');
    if (exportButton && !exportButton.dataset.inventoryBound) {
      exportButton.dataset.inventoryBound = 'export-raw';
      exportButton.addEventListener('click', () => exportRawMaterials(materials, suppliers));
    }
  }

  function renderFinishedProducts(products, filter) {
    const batchSection = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Material Batch Tracking'));
    if (!batchSection) return;

    let panel = document.getElementById('finished-products-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'finished-products-panel';
      panel.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm';
      panel.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
          <div>
            <h4 class="font-headline-sm text-headline-sm text-on-surface">Finished Products In Stock</h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Sale-ready products, SKUs, quantities, value, and stock status.</p>
          </div>
          <div class="flex items-center gap-sm">
            <span data-finished-total class="px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">0 kg</span>
            <button type="button" data-adjust-finished-stock class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 transition-colors">Update Stock</button>
            <button type="button" data-export-products class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low transition-colors">Export Products</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left min-w-[760px]">
            <thead>
              <tr class="bg-surface-container-high">
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Product</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">SKU</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Category</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Quantity</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Unit Price</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Stock Value</th>
                <th class="px-md py-sm font-label-md text-label-md text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody data-finished-products-body class="divide-y divide-outline-variant"></tbody>
          </table>
        </div>
      `;
      batchSection.insertAdjacentElement('beforebegin', panel);
    }

    const rows = products.filter(product => {
      const haystack = `${product.name} ${product.sku || ''} ${product.category || ''} ${product.status || ''}`.toLowerCase();
      return !filter || haystack.includes(filter);
    });
    const totalKg = products.reduce((sum, product) => sum + productQuantity(product), 0);
    const totalBadge = panel.querySelector('[data-finished-total]');
    if (totalBadge) totalBadge.innerText = `${totalKg.toLocaleString('en-KE')} kg total`;

    const tbody = panel.querySelector('[data-finished-products-body]');
    if (!tbody) return;
    tbody.innerHTML = rows.length ? rows.map(product => {
      const quantity = productQuantity(product);
      const unitPrice = Number(product.unit_price || product.price || 0);
      const value = quantity * unitPrice;
      return `
        <tr class="hover:bg-surface-container-low transition-colors cursor-pointer" data-product-id="${product.id}">
          <td class="px-md py-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined p-xs rounded-lg bg-primary-container text-on-primary-container">${product.category === 'shoe_polish' ? 'inventory' : 'sell'}</span>
              <div>
                <p class="font-label-md text-label-md text-on-surface">${product.name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${product.category || 'finished product'}</p>
              </div>
            </div>
          </td>
          <td class="px-md py-md font-body-md text-body-md">${product.sku || 'Unassigned'}</td>
          <td class="px-md py-md font-body-md text-body-md">${formatLabel(product.category || 'general')}</td>
          <td class="px-md py-md font-body-md text-body-md">${quantity.toLocaleString('en-KE')} kg</td>
          <td class="px-md py-md font-body-md text-body-md">KES ${unitPrice.toLocaleString('en-KE')}</td>
          <td class="px-md py-md font-body-md text-body-md">KES ${value.toLocaleString('en-KE')}</td>
          <td class="px-md py-md">${statusBadge(product.status || inferProductStatus(quantity))}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7" class="px-md py-xl text-center text-on-surface-variant">No finished products match the current search.</td></tr>';

    tbody.querySelectorAll('[data-product-id]').forEach(row => {
      row.addEventListener('click', () => {
        const product = products.find(item => item.id === row.dataset.productId);
        if (product) showProductDetail(product);
      });
    });

    const exportButton = panel.querySelector('[data-export-products]');
    if (exportButton && !exportButton.dataset.inventoryBound) {
      exportButton.dataset.inventoryBound = 'export-products';
      exportButton.addEventListener('click', () => exportFinishedProducts(products));
    }
    const adjustButton = panel.querySelector('[data-adjust-finished-stock]');
    if (adjustButton && !adjustButton.dataset.inventoryBound) {
      adjustButton.dataset.inventoryBound = 'adjust-finished-stock';
      adjustButton.addEventListener('click', () => showFinishedStockPicker(products));
    }
  }

  function renderSuppliers(suppliers, filter) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Supplier Directory'));
    const list = section?.querySelector('.space-y-md');
    if (!list) return;
    const rows = suppliers.filter(supplier => `${supplier.name} ${supplier.material_type} ${supplier.contact_name} ${supplier.email} ${supplier.status}`.toLowerCase().includes(filter));
    list.innerHTML = rows.length ? rows.map((supplier, index) => {
      const status = String(supplier.status || 'active').toLowerCase();
      const label = status === 'delayed' ? 'Delayed' : Number(supplier.rating || 0) >= 4.5 ? 'Reliable' : 'In Process';
      const textClass = status === 'delayed' ? 'text-error' : Number(supplier.rating || 0) >= 4.5 ? 'text-primary' : 'text-secondary';
      const icon = status === 'delayed' ? 'report_problem' : Number(supplier.rating || 0) >= 4.5 ? 'verified' : 'schedule';
      const image = [
        'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=96&q=70',
        'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=96&q=70',
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=96&q=70'
      ][index % 3];
      return `
        <button type="button" class="glass-card p-md rounded-xl flex items-center gap-md hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-left w-full" data-supplier-id="${supplier.id}">
          <div class="w-12 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0"><img alt="${escapeHTML(supplier.name)}" class="w-full h-full object-cover" src="${image}"></div>
          <div class="flex-1 min-w-0">
            <p class="font-label-md text-label-md text-on-surface truncate">${escapeHTML(supplier.name)}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${escapeHTML(supplier.material_type || 'Mixed supply')} • ${escapeHTML(supplier.email || 'No email captured')}</p>
          </div>
          <div class="flex flex-col items-end"><span class="font-label-sm text-label-sm ${textClass}">${label}</span><span class="material-symbols-outlined text-sm ${textClass}">${icon}</span></div>
        </button>
      `;
    }).join('') : '<div class="p-lg text-center border border-dashed border-outline rounded-xl text-on-surface-variant">No matching suppliers.</div>';

    list.querySelectorAll('[data-supplier-id]').forEach(button => {
      button.addEventListener('click', () => {
        const supplier = suppliers.find(item => item.id === button.dataset.supplierId);
        if (supplier) showSupplierDetail(supplier);
      });
    });
  }

  function renderForecast(materials, suppliers) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Stock Forecast Analysis'));
    const copy = section?.querySelector('p.font-body-md');
    if (!copy) return;
    const ranked = materials.map(material => ({
      ...material,
      daysRemaining: Math.max(1, Math.round(Number(material.quantity_kg || 0) / Math.max(5, Number(material.reorder_threshold_kg || 1) / 10)))
    })).sort((a, b) => a.daysRemaining - b.daysRemaining);
    const material = ranked[0];
    const supplier = suppliers.find(item => item.id === material?.supplier_id);
    copy.innerHTML = material
      ? `Based on current production speed, <span class="font-bold">${escapeHTML(material.name)}</span> inventory will reach critical levels in <span class="font-bold">${material.daysRemaining} days</span>. Preferred reorder: <span class="font-bold">${Number(material.reorder_quantity_kg || material.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg</span> from ${escapeHTML(supplier?.name || material.supplier_name || 'the preferred supplier')}.`
      : 'Inventory forecasting will appear once raw materials are configured.';
  }

  function renderWorkflowPanel() {
    const forecast = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Stock Forecast Analysis'));
    if (!forecast) return;
    if (document.getElementById('inventory-workflow-panel')) {
      updateWorkflowList();
      return;
    }
    const workflows = readJson('eden_restock_workflows', []);
    const panel = document.createElement('section');
    panel.id = 'inventory-workflow-panel';
    panel.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm';
    panel.innerHTML = `
      <div class="flex items-center justify-between gap-md mb-md">
        <div>
          <h4 class="font-headline-sm text-headline-sm text-on-surface">Procurement Workflows</h4>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Restock requests created from Inventory alerts appear here and in task storage.</p>
        </div>
        <span class="px-sm py-xs rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm">${workflows.length} Open</span>
      </div>
      <div class="space-y-sm" data-workflow-list></div>
    `;
    forecast.insertAdjacentElement('afterend', panel);
    updateWorkflowList();
  }

  function renderProductionMaterialRequests(materials) {
    const forecast = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Stock Forecast Analysis'));
    if (!forecast) return;
    let panel = document.getElementById('production-material-requests-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'production-material-requests-panel';
      panel.className = 'bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm';
      panel.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
          <div>
            <h4 class="font-headline-sm text-headline-sm text-on-surface">Production Material Requests</h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Raw-material requests raised by Production for Inventory issue.</p>
          </div>
          <span data-production-request-count class="px-sm py-xs rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">0 Open</span>
        </div>
        <div class="space-y-sm" data-production-request-list></div>
      `;
      forecast.insertAdjacentElement('afterend', panel);
    }

    const requests = readJson('eden_material_requests', []);
    const open = requests.filter(request => request.status !== 'issued').length;
    const count = panel.querySelector('[data-production-request-count]');
    if (count) count.innerText = `${open} Open`;
    const list = panel.querySelector('[data-production-request-list]');
    if (!list) return;
    list.innerHTML = requests.length ? requests.slice(0, 8).map(request => {
      const shortfall = request.requirements.reduce((sum, item) => {
        const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
        return sum + Math.max(0, Number(item.required_kg || 0) - Number(material?.quantity_kg || 0));
      }, 0);
      return `
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-sm">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${request.product_name} - ${Number(request.output_qty_kg || 0).toLocaleString('en-KE')} kg target</p>
              <p class="font-body-sm text-body-sm ${shortfall > 0 ? 'text-error' : 'text-on-surface-variant'}">${request.requirements.map(item => `${item.material_name}: ${Number(item.required_kg || 0).toLocaleString('en-KE')} kg`).join(' | ')}</p>
            </div>
            <div class="flex items-center gap-sm">
              <span class="px-xs py-1 rounded-full ${request.status === 'issued' ? 'bg-primary/10 text-primary' : shortfall > 0 ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'} font-label-sm text-label-sm">${request.status === 'issued' ? 'Issued' : shortfall > 0 ? 'Short' : 'Requested'}</span>
              ${request.status === 'issued'
                ? ''
                : `<button type="button" data-issue-materials="${request.id}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">Issue</button>`}
            </div>
          </div>
        </div>
      `;
    }).join('') : '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant text-body-sm">No production material requests yet.</div>';

    list.querySelectorAll('[data-issue-materials]').forEach(button => {
      button.addEventListener('click', async () => {
        const request = requests.find(item => item.id === button.dataset.issueMaterials);
        if (!request) return;
        const issued = await issueProductionMaterials(request);
        toast(issued ? `Materials issued for ${request.product_name}.` : 'Could not issue materials. Check stock levels.', issued ? 'success' : 'error');
        if (issued) await renderInventoryPage();
      });
    });
  }

  async function issueProductionMaterials(request) {
    const materials = await window.inventoryModule.getRawMaterials();
    const hasEnough = request.requirements.every(item => {
      const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
      return material && Number(material.quantity_kg || 0) >= Number(item.required_kg || 0);
    });
    if (!hasEnough) return false;

    for (const item of request.requirements) {
      const material = materials.find(row => row.id === item.material_id || row.name === item.material_name);
      await window.inventoryModule.updateRawMaterial(material.id, {
        quantity_kg: Math.max(0, Number(material.quantity_kg || 0) - Number(item.required_kg || 0))
      });
      material.quantity_kg = Math.max(0, Number(material.quantity_kg || 0) - Number(item.required_kg || 0));
    }

    const requests = readJson('eden_material_requests', []);
    const idx = requests.findIndex(item => item.id === request.id);
    if (idx !== -1) {
      requests[idx] = { ...requests[idx], status: 'issued', issued_at: new Date().toISOString(), issued_by: window.appState?.user?.name || 'Inventory Lead' };
      localStorage.setItem('eden_material_requests', JSON.stringify(requests));
    }
    const cycles = readJson('eden_production_cycles', []).map(cycle => cycle.material_request_id === request.id
      ? { ...cycle, status: 'materials_issued', owner: 'Production Lead', updated_at: new Date().toISOString() }
      : cycle);
    localStorage.setItem('eden_production_cycles', JSON.stringify(cycles));
    const reservations = readJson('eden_inventory_reservations', []).map(item => item.request_id === request.id ? { ...item, status: 'issued' } : item);
    localStorage.setItem('eden_inventory_reservations', JSON.stringify(reservations));
    const tasks = readJson('eden_tasks', []).map(task => task.material_request_id === request.id ? { ...task, status: 'completed', completed_at: new Date().toISOString() } : task);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    return true;
  }

  function updateWorkflowList() {
    const list = document.querySelector('[data-workflow-list]');
    if (!list) return;
    const workflows = readJson('eden_restock_workflows', []);
    const badge = document.querySelector('#inventory-workflow-panel .bg-primary-container');
    if (badge) badge.innerText = `${workflows.length} Open`;
    list.innerHTML = workflows.length ? workflows.slice(0, 5).map(item => `
      <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-md">
        <div>
          <p class="font-label-md text-label-md text-on-surface">${item.material_name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg • ${item.supplier_name || 'Preferred supplier'} • Due ${item.due_date}</p>
        </div>
        <span class="px-xs py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">${item.status}</span>
      </div>
    `).join('') : '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant text-body-sm">No restock workflows yet. Trigger Reorder or Automate Restock Flow to create one.</div>';
  }

  function showBatchModal() {
    Promise.all([window.inventoryModule.getRawMaterials(), window.inventoryModule.getSuppliers()]).then(([materials, suppliers]) => {
      const overlay = createModal('Add Stock Batch', `
        <form data-batch-form class="space-y-md">
          ${selectField('material_id', 'Material', materials.map(material => [material.id, material.name]))}
          ${numberField('weight_kg', 'Weight (kg)', 500)}
          ${selectField('supplier_id', 'Supplier', suppliers.map(supplier => [supplier.id, supplier.name]))}
          ${selectField('status', 'Status', [['stored', 'Stored'], ['processing', 'Processing'], ['in_transit', 'In Transit']])}
          ${modalActions('Save Batch')}
        </form>
      `);
      overlay.querySelector('[data-batch-form]').addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const material = materials.find(item => item.id === data.get('material_id'));
        const supplier = suppliers.find(item => item.id === data.get('supplier_id'));
        const saved = await window.inventoryModule.addBatch({
          material_id: material?.id,
          material_name: material?.name,
          supplier_id: supplier?.id,
          supplier_name: supplier?.name,
          weight_kg: Number(data.get('weight_kg')),
          status: data.get('status')
        });
        overlay.remove();
        toast(saved ? `Stock batch ${String(saved.id).toUpperCase()} added.` : 'Could not save stock batch.', saved ? 'success' : 'error');
        if (saved) await renderInventoryPage();
      });
    });
  }

  function showBatchStatusModal(batch) {
    const overlay = createModal('Change Batch Status', `
      <form data-status-form class="space-y-md">
        <div class="p-sm rounded-lg bg-surface-container-low">
          <p class="font-label-md text-label-md">${String(batch.id).toUpperCase()}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${batch.material_name} • ${Number(batch.weight_kg || 0).toLocaleString('en-KE')} kg</p>
        </div>
        ${selectField('status', 'Status', [['stored', 'Stored'], ['processing', 'Processing'], ['in_transit', 'In Transit'], ['quarantine', 'Quality Hold'], ['consumed', 'Consumed']], batch.status)}
        ${modalActions('Update Status')}
      </form>
    `);
    overlay.querySelector('[data-status-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const status = new FormData(event.currentTarget).get('status');
      const updated = await window.inventoryModule.updateBatchStatus(batch.id, status);
      overlay.remove();
      toast(updated ? `Batch status changed to ${status.replace(/_/g, ' ')}.` : 'Could not update batch status.', updated ? 'success' : 'error');
      if (updated) await renderInventoryPage();
    });
  }

  async function showReorderModal(material) {
    const suppliers = await window.inventoryModule.getSuppliers();
    const quantity = Number(material.reorder_quantity_kg || material.reorder_threshold_kg || 0);
    const overlay = createModal('Create Reorder Workflow', `
      <form data-reorder-form class="space-y-md">
        <div class="p-sm rounded-lg bg-error-container text-on-error-container">
          <p class="font-label-md text-label-md">${material.name}</p>
          <p class="font-body-sm text-body-sm">Current ${Number(material.quantity_kg || 0).toLocaleString('en-KE')} kg • Threshold ${Number(material.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg</p>
        </div>
        ${numberField('quantity_kg', 'Reorder amount (kg)', quantity || 100)}
        ${selectField('supplier_id', 'Supplier', suppliers.map(supplier => [supplier.id, supplier.name]), material.supplier_id)}
        ${modalActions('Queue Reorder')}
      </form>
    `);
    overlay.querySelector('[data-reorder-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const supplier = suppliers.find(item => item.id === data.get('supplier_id'));
      const workflow = createRestockWorkflow({ ...material, supplier_id: supplier?.id, supplier_name: supplier?.name, reorder_quantity_kg: Number(data.get('quantity_kg')) }, 'single');
      overlay.remove();
      toast(`Reorder workflow ${workflow.id} queued.`, 'success');
      await renderInventoryPage();
    });
  }

  async function showReorderSettingsModal(material) {
    if (!material) return;
    const [materials, suppliers] = await Promise.all([window.inventoryModule.getRawMaterials(), window.inventoryModule.getSuppliers()]);
    const overlay = createModal('Set Reorder Rules', `
      <form data-rules-form class="space-y-md">
        ${selectField('material_id', 'Material', materials.map(item => [item.id, item.name]), material.id)}
        ${numberField('reorder_threshold_kg', 'Alert threshold (kg)', material.reorder_threshold_kg || 0)}
        ${numberField('reorder_quantity_kg', 'Default reorder amount (kg)', material.reorder_quantity_kg || material.reorder_threshold_kg || 100)}
        ${selectField('supplier_id', 'Preferred supplier', suppliers.map(supplier => [supplier.id, supplier.name]), material.supplier_id)}
        ${modalActions('Save Rules')}
      </form>
    `);
    overlay.querySelector('[data-rules-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const supplier = suppliers.find(item => item.id === data.get('supplier_id'));
      const updated = await window.inventoryModule.updateReorderSettings(data.get('material_id'), {
        reorder_threshold_kg: data.get('reorder_threshold_kg'),
        reorder_quantity_kg: data.get('reorder_quantity_kg'),
        supplier_id: supplier?.id,
        supplier_name: supplier?.name
      });
      overlay.remove();
      toast(updated ? 'Reorder rules saved.' : 'Could not save reorder rules.', updated ? 'success' : 'error');
      if (updated) await renderInventoryPage();
    });
  }

  function showSupplierModal() {
    const overlay = createModal('Link New Supplier', `
      <form data-supplier-form class="space-y-md">
        ${textField('name', 'Supplier name', 'Supplier Ltd', true)}
        ${textField('material_type', 'Primary material', 'PET Flakes, Waste Paper, EKO inputs', true)}
        ${textField('contact_name', 'Contact person', 'Operations contact')}
        ${textField('contact_phone', 'Phone', '+254...')}
        ${textField('email', 'Email', 'orders@supplier.co.ke', true, 'email')}
        ${modalActions('Link Supplier')}
      </form>
    `);
    overlay.querySelector('[data-supplier-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const supplier = await window.inventoryModule.addSupplier({ ...data, status: 'active', rating: 4.0 });
      overlay.remove();
      toast(supplier ? `${supplier.name} linked to Inventory.` : 'Could not link supplier.', supplier ? 'success' : 'error');
      if (supplier) await renderInventoryPage();
    });
  }

  function showSupplierDetail(supplier) {
    createModal('Supplier Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Supplier', supplier.name],
          ['Contact', supplier.contact_name || 'Not assigned'],
          ['Phone', supplier.contact_phone || 'Not captured'],
          ['Email', supplier.email || 'Not captured'],
          ['Material', supplier.material_type || 'Mixed supply'],
          ['Rating', `${Number(supplier.rating || 0).toFixed(1)} / 5`],
          ['Status', String(supplier.status || 'active').replace(/_/g, ' ')]
        ])}
      </dl>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showRawMaterialDetail(material, suppliers) {
    const supplier = suppliers.find(item => item.id === material.supplier_id || item.id === material.preferred_supplier_id);
    const quantity = Number(material.quantity_kg || 0);
    const threshold = Number(material.reorder_threshold_kg || 0);
    const unitCost = Number(material.unit_cost || 0);
    createModal('Raw Material Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Material', material.name],
          ['Category', formatLabel(material.category || 'general')],
          ['Quantity', `${quantity.toLocaleString('en-KE')} kg`],
          ['Reorder Threshold', `${threshold.toLocaleString('en-KE')} kg`],
          ['Default Reorder', `${Number(material.reorder_quantity_kg || threshold || 0).toLocaleString('en-KE')} kg`],
          ['Supplier', supplier?.name || material.supplier_name || 'Not assigned'],
          ['Unit Cost', `KES ${unitCost.toLocaleString('en-KE')}`],
          ['Stock Value', `KES ${(quantity * unitCost).toLocaleString('en-KE')}`],
          ['Status', quantity <= threshold ? 'Low Stock' : 'In Stock']
        ])}
      </dl>
      <div class="flex justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Done</button>
        <button type="button" data-edit-raw-rules class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Set Rules</button>
      </div>
    `).querySelector('[data-edit-raw-rules]')?.addEventListener('click', event => {
      event.target.closest('.fixed')?.remove();
      showReorderSettingsModal(material);
    });
  }

  function showProductDetail(product) {
    const quantity = productQuantity(product);
    const unitPrice = Number(product.unit_price || product.price || 0);
    const productRecipe = getProductRecipe(product);
    const recipe = productRecipe.length
      ? `
        <div class="mt-md pt-md border-t border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Production Recipe</p>
          <div class="space-y-xs">
            ${productRecipe.map(item => `
              <div class="flex justify-between gap-md text-body-sm">
                <span>${item.material_name}</span>
                <span class="font-bold">${Number(item.kg_per_kg || 0).toLocaleString('en-KE')} kg/kg</span>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    createModal('Finished Product Detail', `
      <dl class="divide-y divide-outline-variant">
        ${detailRows([
          ['Product', product.name],
          ['SKU', product.sku || 'Unassigned'],
          ['Category', formatLabel(product.category || 'general')],
          ['Quantity', `${quantity.toLocaleString('en-KE')} kg`],
          ['Unit Price', `KES ${unitPrice.toLocaleString('en-KE')}`],
          ['Stock Value', `KES ${(quantity * unitPrice).toLocaleString('en-KE')}`],
          ['Status', formatLabel(product.status || inferProductStatus(quantity))]
        ])}
      </dl>
      ${recipe}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `);
  }

  function showSearchModal() {
    const overlay = createModal('Search Inventory', `
      <input data-floating-inventory-search class="w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Search batches, suppliers, or EKO inputs" type="search" autofocus>
      <p class="mt-sm text-body-sm text-on-surface-variant">Results update on the Inventory page as you type.</p>
    `);
    const input = overlay.querySelector('[data-floating-inventory-search]');
    input.addEventListener('input', () => renderInventoryPage(input.value.trim().toLowerCase()));
    setTimeout(() => input.focus(), 50);
  }

  function createRestockWorkflow(material, mode) {
    const workflows = readJson('eden_restock_workflows', []);
    const tasks = readJson('eden_tasks', []);
    const id = `RW-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const quantity = Number(material.reorder_quantity_kg || material.reorder_threshold_kg || 0);
    const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const workflow = {
      id,
      material_id: material.id,
      material_name: material.name,
      quantity_kg: quantity,
      supplier_id: material.supplier_id || material.preferred_supplier_id || null,
      supplier_name: material.supplier_name || '',
      status: 'queued',
      mode,
      due_date: due,
      created_at: new Date().toISOString()
    };
    workflows.unshift(workflow);
    tasks.unshift({
      id: `task-${id}`,
      title: `Procure ${material.name}`,
      description: `Order ${quantity.toLocaleString('en-KE')} kg for Inventory. Current stock is ${Number(material.quantity_kg || 0).toLocaleString('en-KE')} kg; threshold is ${Number(material.reorder_threshold_kg || 0).toLocaleString('en-KE')} kg.`,
      department: 'Inventory',
      priority: 'high',
      status: 'open',
      assigned_to: 'Procurement Lead',
      source_module: 'supplier_inventory',
      workflow_id: id,
      related_material_id: material.id,
      due_date: due,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_restock_workflows', JSON.stringify(workflows));
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    const notificationKey = `eden_notifications_${window.appState?.user?.id || 'local'}`;
    const notifications = readJson(notificationKey, []);
    notifications.unshift({
      id: `notif-${id}`,
      type: 'inventory_reorder',
      title: 'Restock workflow queued',
      message: `${quantity.toLocaleString('en-KE')} kg of ${material.name} is ready for procurement follow-up.`,
      read: false,
      created_at: new Date().toISOString(),
      workflow_id: id
    });
    localStorage.setItem(notificationKey, JSON.stringify(notifications));
    return workflow;
  }

  function showInventoryInboxModal() {
    const tasks = crossDepartmentTasks('Inventory');
    const demands = inventoryDemandRequests();
    const overlay = createModal('Urgent Inventory Inbox', `
      <div class="space-y-md">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Demand requests</p><p class="font-headline-sm text-headline-sm">${demands.length}</p></div>
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Inventory tasks</p><p class="font-headline-sm text-headline-sm">${tasks.length}</p></div>
          <div class="p-sm rounded-lg bg-error-container text-on-error-container"><p class="font-label-sm text-label-sm uppercase">Priority</p><p class="font-body-sm text-body-sm">Reserve, reconcile, or escalate first.</p></div>
        </div>
        <div class="space-y-sm">
          ${demands.map(demand => inboxButton('demand', demand.id, `${demand.customer_name} stock demand`, demandSummary(demand), demand.status)).join('')}
          ${tasks.map(task => inboxButton('task', task.id, task.title, task.description, task.status)).join('')}
          ${!demands.length && !tasks.length ? '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No urgent Inventory handoffs.</div>' : ''}
        </div>
      </div>
    `);
    overlay.querySelectorAll('[data-inbox-open]').forEach(button => {
      button.addEventListener('click', () => showInventoryInboxDetail(button.dataset.inboxOpen));
    });
  }

  function showInventoryInboxDetail(value) {
    const [type, id] = String(value || '').split(':');
    const demands = readJson('eden_sales_demand_requests', []);
    const tasks = readJson('eden_tasks', []);
    const item = type === 'demand' ? demands.find(demand => demand.id === id) : tasks.find(task => task.id === id);
    if (!item) {
      toast('This inbox item is no longer available.', 'info');
      return;
    }
    const lines = type === 'demand' ? (item.lines || []) : [];
    const products = readJson('eden_finished_products', window.inventoryModule?.MOCK_FINISHED_PRODUCTS || []);
    const overlay = createModal(type === 'demand' ? item.id : item.title, `
      <div class="space-y-md">
        <dl class="divide-y divide-outline-variant">
          ${detailRows([
            ['Source', formatLabel(item.source_module || 'cross_department')],
            ['Status', formatLabel(item.status || 'open')],
            ['Customer', item.customer_name || item.related_customer_id || 'Not linked'],
            ['Created', formatDate(item.created_at)]
          ])}
        </dl>
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Inventory action</p>
          <p class="font-body-md text-body-md text-on-surface">${escapeHTML(type === 'demand' ? demandSummary(item) : item.description)}</p>
        </div>
        ${lines.length ? `
          <div class="space-y-sm">
            <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Stock lines</p>
            ${lines.map(line => `
              <div class="p-sm rounded-lg border border-outline-variant bg-surface-container-low space-y-sm">
                <div class="flex items-center justify-between gap-md">
                  <div><p class="font-label-md text-label-md">${escapeHTML(line.product_name)}</p><p class="font-body-sm text-body-sm text-on-surface-variant">Requested ${Number(line.requested_kg || 0).toLocaleString('en-KE')} kg - Available ${currentProductQuantity(products, line.product_id, line.available_kg).toLocaleString('en-KE')} kg - Reserved ${Number(line.reserved_kg || 0).toLocaleString('en-KE')} kg</p></div>
                  <span class="font-label-md text-label-md text-error">${Math.max(0, Number(line.requested_kg || 0) - currentProductQuantity(products, line.product_id, line.available_kg) - Number(line.reserved_kg || 0)).toLocaleString('en-KE')} kg short</span>
                </div>
                <div class="flex flex-wrap gap-xs justify-end">
                  <button type="button" data-demand-reserve="${line.product_id}" class="px-sm py-xs border border-primary text-primary rounded-full font-label-sm text-label-sm">Reserve Available</button>
                  <button type="button" data-demand-stock-update="${line.product_id}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">Post Stock Receipt</button>
                  <button type="button" data-demand-production="${line.product_id}" class="px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm">Send To Production</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="flex flex-wrap justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Close</button>
          <button type="button" data-inventory-inbox-review class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Start Stock Review</button>
          <button type="button" data-inventory-inbox-done class="px-md py-sm border border-primary text-primary rounded-full font-label-md text-label-md">Mark Inventory Updated</button>
        </div>
      </div>
    `);
    overlay.querySelector('[data-inventory-inbox-review]')?.addEventListener('click', async () => {
      updateInboxItem(type, id, type === 'demand' ? 'inventory_review' : 'in_progress');
      overlay.remove();
      toast('Inventory review started.', 'success');
      await renderInventoryPage();
    });
    overlay.querySelector('[data-inventory-inbox-done]')?.addEventListener('click', async () => {
      updateInboxItem(type, id, type === 'demand' ? 'in_production' : 'completed');
      overlay.remove();
      toast('Inventory update recorded.', 'success');
      await renderInventoryPage();
    });
    overlay.querySelectorAll('[data-demand-reserve]').forEach(button => {
      button.addEventListener('click', async () => {
        const result = reserveDemandStock(id, button.dataset.demandReserve);
        overlay.remove();
        toast(result.message, result.ok ? 'success' : 'warning');
        await renderInventoryPage();
      });
    });
    overlay.querySelectorAll('[data-demand-stock-update]').forEach(button => {
      button.addEventListener('click', async () => {
        const product = products.find(item => item.id === button.dataset.demandStockUpdate);
        const line = lines.find(item => item.product_id === button.dataset.demandStockUpdate);
        overlay.remove();
        if (!product) {
          toast('Finished product record was not found.', 'error');
          return;
        }
        showFinishedStockAdjustmentModal(product, { demandId: id, line });
      });
    });
    overlay.querySelectorAll('[data-demand-production]').forEach(button => {
      button.addEventListener('click', async () => {
        const line = lines.find(item => item.product_id === button.dataset.demandProduction);
        queueProductionEscalation(item, line);
        updateInboxItem(type, id, 'in_production');
        overlay.remove();
        toast('Production has the shortage with customer context.', 'success');
        await renderInventoryPage();
      });
    });
  }

  function showFinishedStockPicker(products) {
    const overlay = createModal('Update Finished Stock', `
      <div class="space-y-sm">
        <p class="font-body-sm text-body-sm text-on-surface-variant">Stock is updated from the finished product record using a stock movement. Pick the product, then post a receipt, correction, or dispatch adjustment.</p>
        ${products.map(product => `
          <button type="button" data-stock-picker="${product.id}" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all">
            <div class="flex items-center justify-between gap-md">
              <div><p class="font-label-md text-label-md">${product.name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${product.sku || product.id}</p></div>
              <span class="font-label-md text-label-md">${productQuantity(product).toLocaleString('en-KE')} kg</span>
            </div>
          </button>
        `).join('')}
      </div>
    `);
    overlay.querySelectorAll('[data-stock-picker]').forEach(button => {
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.stockPicker);
        overlay.remove();
        if (product) showFinishedStockAdjustmentModal(product);
      });
    });
  }

  function showFinishedStockAdjustmentModal(product, context = {}) {
    const shortage = Number(context.line?.shortage_kg || context.line?.requested_kg || 0);
    const overlay = createModal(`Update ${product.name}`, `
      <form data-finished-stock-form class="space-y-md">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Current</p><p class="font-headline-sm text-headline-sm">${productQuantity(product).toLocaleString('en-KE')} kg</p></div>
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Demand</p><p class="font-headline-sm text-headline-sm">${Number(context.line?.requested_kg || 0).toLocaleString('en-KE')} kg</p></div>
          <div class="p-sm rounded-lg bg-error-container text-on-error-container"><p class="font-label-sm text-label-sm uppercase">Short</p><p class="font-headline-sm text-headline-sm">${shortage.toLocaleString('en-KE')} kg</p></div>
        </div>
        ${selectField('movement_type', 'Movement Type', [
          ['finished_receipt', 'Finished receipt / production output'],
          ['manual_adjustment', 'Inventory correction'],
          ['finished_dispatch', 'Dispatch correction']
        ], 'finished_receipt')}
        ${numberField('quantity_kg', 'Quantity Kg', shortage || 0)}
        ${textField('notes', 'Reason / Evidence', context.demandId ? `Resolve ${context.demandId}` : 'Cycle count, production completion, or correction note', true)}
        ${textField('expected_date', 'Expected Completion Date', new Date(Date.now() + 86400000).toISOString().slice(0, 10), false, 'date')}
        <label class="flex items-start gap-sm p-sm rounded-lg border border-outline-variant bg-surface-container-low">
          <input name="notify_sales" type="checkbox" checked class="mt-1">
          <span><span class="block font-label-md text-label-md">Notify Sales</span><span class="block font-body-sm text-body-sm text-on-surface-variant">Update the blocked demand so Sales can recreate the order when enough stock exists.</span></span>
        </label>
        ${modalActions('Post Stock Movement')}
      </form>
    `);
    overlay.querySelector('[data-finished-stock-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const rawQty = Number(data.quantity_kg || 0);
      const quantity = data.movement_type === 'finished_dispatch' ? -Math.abs(rawQty) : Math.abs(rawQty);
      const updated = await window.inventoryModule.updateFinishedProductStock(product.id, quantity, {
        source_module: 'inventory',
        source_type: context.demandId ? 'sales_demand' : 'manual_adjustment',
        source_id: context.demandId ? `${context.demandId}:${product.id}:${data.movement_type}` : `manual:${product.id}:${Date.now()}`,
        notes: data.notes || 'Inventory stock update'
      });
      if (!updated) {
        toast('Stock movement failed.', 'error');
        return;
      }
      if (context.demandId) {
        refreshDemandLineAfterStockUpdate(context.demandId, product.id, Number(data.expected_date ? 0 : 0), data);
      }
      overlay.remove();
      toast(`${product.name} stock movement posted.`, 'success');
      await renderInventoryPage();
    });
  }

  function reserveDemandStock(demandId, productId) {
    const products = readJson('eden_finished_products', []);
    const product = products.find(item => item.id === productId);
    const demands = readJson('eden_sales_demand_requests', []);
    const demand = demands.find(item => item.id === demandId);
    const line = demand?.lines?.find(item => item.product_id === productId);
    if (!product || !demand || !line) return { ok: false, message: 'Reservation target was not found.' };
    const alreadyReserved = Number(line.reserved_kg || 0);
    const canReserve = Math.max(0, Math.min(productQuantity(product) - alreadyReserved, Number(line.requested_kg || 0) - alreadyReserved));
    if (canReserve <= 0) return { ok: false, message: 'No available finished stock can be reserved yet.' };
    line.reserved_kg = alreadyReserved + canReserve;
    line.shortage_kg = Math.max(0, Number(line.requested_kg || 0) - Number(line.available_kg || 0) - Number(line.reserved_kg || 0));
    demand.status = line.shortage_kg > 0 ? 'partially_reserved' : 'inventory_ready';
    demand.inventory_updated_at = new Date().toISOString();
    localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));
    const reservations = readJson('eden_stock_reservations', []);
    reservations.unshift({ id: `RSV-${Date.now()}`, demand_id: demandId, product_id: productId, quantity_kg: canReserve, status: 'reserved', created_at: new Date().toISOString() });
    localStorage.setItem('eden_stock_reservations', JSON.stringify(reservations));
    notifySales(`Inventory reserved ${canReserve.toLocaleString('en-KE')} kg`, `${demand.id}: ${product.name} has ${canReserve.toLocaleString('en-KE')} kg reserved. Remaining shortage is ${line.shortage_kg.toLocaleString('en-KE')} kg.`);
    return { ok: true, message: `${canReserve.toLocaleString('en-KE')} kg reserved for ${demand.id}.` };
  }

  function refreshDemandLineAfterStockUpdate(demandId, productId, _unused, formData = {}) {
    const products = readJson('eden_finished_products', []);
    const product = products.find(item => item.id === productId);
    const demands = readJson('eden_sales_demand_requests', []);
    const demand = demands.find(item => item.id === demandId);
    const line = demand?.lines?.find(item => item.product_id === productId);
    if (!product || !demand || !line) return;
    line.available_kg = productQuantity(product);
    line.shortage_kg = Math.max(0, Number(line.requested_kg || 0) - Number(line.available_kg || 0) - Number(line.reserved_kg || 0));
    line.expected_completion_date = formData.expected_date || line.expected_completion_date || null;
    line.inventory_notes = formData.notes || line.inventory_notes || '';
    demand.status = demand.lines.every(item => Number(item.shortage_kg || 0) <= 0) ? 'inventory_ready' : 'inventory_review';
    demand.inventory_updated_at = new Date().toISOString();
    localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));
    if (formData.notify_sales) {
      notifySales(`Inventory updated ${product.name}`, `${demand.id}: available stock is now ${line.available_kg.toLocaleString('en-KE')} kg; shortage is ${line.shortage_kg.toLocaleString('en-KE')} kg. Expected date: ${line.expected_completion_date || 'not set'}.`);
    }
  }

  function queueProductionEscalation(demand, line = {}) {
    const tasks = readJson('eden_tasks', []);
    const existing = tasks.find(task => task.source_module === 'supplier_inventory' && task.related_demand_id === demand.id && task.related_product_id === line.product_id);
    if (existing) return existing;
    const task = {
      id: `task-prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Produce ${line.product_name || 'finished product'} for blocked sale`,
      description: `${demand.id} still needs ${Number(line.shortage_kg || line.requested_kg || 0).toLocaleString('en-KE')} kg. Start the production material request flow and update Inventory/Sales when QC passes.`,
      department: 'Production',
      priority: 'high',
      status: 'open',
      assigned_to: 'Production Lead',
      source_module: 'supplier_inventory',
      related_demand_id: demand.id,
      related_product_id: line.product_id,
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };
    tasks.unshift(task);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    notifySales(`Production escalation sent for ${line.product_name || 'stock'}`, `${demand.id}: Inventory escalated the shortage to Production.`);
    return task;
  }

  function notifySales(title, message) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-sales-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: message,
      department: 'Sales',
      priority: 'high',
      status: 'open',
      assigned_to: 'Sales Coordinator',
      source_module: 'supplier_inventory',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function currentProductQuantity(products, productId, fallback = 0) {
    const product = products.find(item => item.id === productId);
    return product ? productQuantity(product) : Number(fallback || 0);
  }

  function updateInboxItem(type, id, status) {
    if (type === 'demand') {
      const demands = readJson('eden_sales_demand_requests', []).map(demand => demand.id === id ? { ...demand, status, inventory_updated_at: new Date().toISOString() } : demand);
      localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));
      return;
    }
    const tasks = readJson('eden_tasks', []).map(task => task.id === id ? { ...task, status, updated_at: new Date().toISOString() } : task);
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function inventoryDemandRequests() {
    return readJson('eden_sales_demand_requests', [])
      .filter(demand => ['queued_for_production', 'production_review', 'materials_requested', 'in_production', 'inventory_review', 'partially_reserved', 'inventory_ready'].includes(String(demand.status || '').toLowerCase()))
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
          <div class="min-w-0"><p class="font-label-md text-label-md text-on-surface truncate">${escapeHTML(title)}</p><p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${escapeHTML(description)}</p></div>
          ${statusBadge(status || 'open')}
        </div>
      </button>
    `;
  }

  function compactInboxText(value) {
    return String(value || '')
      .replace(/Confirm finished stock, expected completion date, and notify Sales before an order is created\.?/i, 'Confirm stock for Sales.')
      .replace(/Reconcile stock, reserve any available quantity, and update Sales before order creation\.?/i, 'Reserve or escalate stock.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function exportInventoryCsv() {
    const [materials, batches, suppliers, workflows, products] = await Promise.all([
      window.inventoryModule.getRawMaterials(),
      window.inventoryModule.getBatches(),
      window.inventoryModule.getSuppliers(),
      Promise.resolve(readJson('eden_restock_workflows', [])),
      window.inventoryModule.getFinishedProducts()
    ]);
    const rows = [
      ['Type', 'Name/ID', 'Material', 'Quantity/Weight Kg', 'Supplier', 'Status'],
      ...products.map(product => ['Finished Product', product.sku || product.id, product.name, productQuantity(product), '', product.status || inferProductStatus(productQuantity(product))]),
      ...materials.map(material => ['Material', material.id, material.name, material.quantity_kg, material.supplier_name || '', material.quantity_kg <= material.reorder_threshold_kg ? 'low_stock' : 'healthy']),
      ...batches.map(batch => ['Batch', batch.id, batch.material_name || '', batch.weight_kg || '', batch.supplier_name || '', batch.status || 'stored']),
      ...suppliers.map(supplier => ['Supplier', supplier.id, supplier.material_type || '', '', supplier.name, supplier.status || 'active']),
      ...workflows.map(workflow => ['Restock Workflow', workflow.id, workflow.material_name, workflow.quantity_kg, workflow.supplier_name, workflow.status])
    ];
    downloadTextFile(`eden-inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Inventory export downloaded.', 'success');
  }

  function exportFinishedProducts(products) {
    const rows = [
      ['Product', 'SKU', 'Category', 'Quantity Kg', 'Unit Price KES', 'Stock Value KES', 'Status'],
      ...products.map(product => {
        const quantity = productQuantity(product);
        const unitPrice = Number(product.unit_price || product.price || 0);
        return [
          product.name,
          product.sku || product.id,
          formatLabel(product.category || 'general'),
          quantity,
          unitPrice,
          quantity * unitPrice,
          formatLabel(product.status || inferProductStatus(quantity))
        ];
      })
    ];
    downloadTextFile(`eden-finished-products-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Finished products export downloaded.', 'success');
  }

  function exportRawMaterials(materials, suppliers) {
    const rows = [
      ['Material', 'Category', 'Quantity Kg', 'Threshold Kg', 'Default Reorder Kg', 'Supplier', 'Unit Cost KES', 'Stock Value KES', 'Status'],
      ...materials.map(material => {
        const quantity = Number(material.quantity_kg || 0);
        const threshold = Number(material.reorder_threshold_kg || 0);
        const unitCost = Number(material.unit_cost || 0);
        const supplier = suppliers.find(item => item.id === material.supplier_id || item.id === material.preferred_supplier_id);
        return [
          material.name,
          formatLabel(material.category || 'general'),
          quantity,
          threshold,
          Number(material.reorder_quantity_kg || threshold || 0),
          supplier?.name || material.supplier_name || '',
          unitCost,
          quantity * unitCost,
          quantity <= threshold ? 'Low Stock' : 'In Stock'
        ];
      })
    ];
    downloadTextFile(`eden-raw-materials-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Raw materials export downloaded.', 'success');
  }

  function bindOne(element, key, handler) {
    if (!element || element.dataset.inventoryBound === key) return;
    element.dataset.inventoryBound = key;
    element.addEventListener('click', handler);
  }

  function bindMany(elements, key, handler, beforeBind) {
    elements.forEach(element => {
      if (!element || element.dataset.inventoryBound === key) return;
      if (beforeBind) beforeBind(element);
      bindOne(element, key, handler);
    });
  }

  function cardByLabel(label) {
    return Array.from(document.querySelectorAll('section .rounded-xl')).find(card => card.innerText.toLowerCase().includes(label.toLowerCase()));
  }

  function setCardValue(card, value) {
    const el = card?.querySelector('h3');
    if (el) el.innerText = value;
  }

  function productQuantity(product) {
    return Number(product.quantity_kg ?? product.quantity ?? product.units ?? 0);
  }

  function getProductRecipe(product) {
    if (Array.isArray(product.recipe) && product.recipe.length) return product.recipe;
    if (String(product.name || '').toLowerCase().includes('eko shoe polish')) {
      return [
        { material_name: 'Paraffin Wax', kg_per_kg: 0.28 },
        { material_name: 'Carnauba Wax', kg_per_kg: 0.12 },
        { material_name: 'Beeswax', kg_per_kg: 0.10 },
        { material_name: 'Carbon Black Pigment', kg_per_kg: 0.08 },
        { material_name: 'Mineral Oil', kg_per_kg: 0.22 },
        { material_name: 'Turpentine Solvent', kg_per_kg: 0.18 },
        { material_name: 'Polish Tins & Labels', kg_per_kg: 0.02 }
      ];
    }
    return [];
  }

  function inferProductStatus(quantity) {
    if (quantity <= 0) return 'out_of_stock';
    if (quantity < 500) return 'low_stock';
    return 'in_stock';
  }

  function formatLabel(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function rawMaterialIcon(category) {
    const key = String(category || '').toLowerCase();
    if (key.includes('paper')) return 'description';
    if (key.includes('shoe') || key.includes('wax')) return 'science';
    if (key.includes('packaging')) return 'inventory_2';
    if (key.includes('plastic') || key.includes('hdpe') || key.includes('ldpe')) return 'recycling';
    return 'category';
  }

  function createModal(title, bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full max-w-lg bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div><p class="font-label-sm text-label-sm text-primary uppercase">Inventory Control</p><h3 class="font-headline-md text-headline-md text-on-surface">${escapeHTML(title)}</h3></div>
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
        <span class="font-label-sm text-label-sm text-on-surface-variant">${escapeHTML(label)}</span>
        <select name="${escapeHTML(name)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
          ${options.map(([value, text]) => `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(text)}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function numberField(name, label, value) {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <input name="${name}" required min="0" step="0.1" type="number" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
      </label>
    `;
  }

  function textField(name, label, placeholder, required = false, type = 'text') {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <input name="${name}" ${required ? 'required' : ''} type="${type}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="${placeholder}">
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

  function detailRows(rows) {
    return rows.map(([label, value]) => `
      <div class="py-sm flex justify-between gap-md">
        <dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${escapeHTML(label)}</dt>
        <dd class="font-body-md text-body-md text-on-surface text-right">${escapeHTML(value)}</dd>
      </div>
    `).join('');
  }

  function statusBadge(status = 'stored') {
    const label = String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const key = String(status).toLowerCase();
    const positive = ['stored', 'received', 'completed', 'consumed'].includes(key);
    const warning = ['in_transit', 'processing', 'queued'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${label}</span>`;
  }

  function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
  }
})();
