// js/routes/sales/page.js
// Sales & Distribution controller: orders, invoices, payments, deliveries, and stock handoff.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['sales_distribution.html'] = bindSalesPage;

  async function bindSalesPage() {
    if (!window.salesModule) return;
    bindHeaderActions();
    await renderSalesPage();
  }

  async function renderSalesPage() {
    const [orders, customers, invoices, deliveries, products, stats] = await Promise.all([
      window.salesModule.getOrders(),
      window.salesModule.getCustomers(),
      window.salesModule.getInvoices(),
      window.salesModule.getDeliveries(),
      getProducts(),
      window.salesModule.getSalesStats()
    ]);

    renderKpis(stats, orders, deliveries, products);
    renderOrders(orders, invoices, deliveries, products);
    renderDistribution(deliveries, orders);
    renderClients(customers, orders, invoices);
    renderTimeline(orders, invoices, deliveries);
    renderSalesPanels(orders, invoices, deliveries, products);
    bindStaticButtons();
  }

  function bindHeaderActions() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-sales-context-actions]')) return;
    const rightCluster = Array.from(header.querySelectorAll('.flex.items-center')).pop();
    if (!rightCluster) return;

    const actions = document.createElement('div');
    actions.dataset.salesContextActions = 'true';
    actions.className = 'hidden lg:flex items-center gap-sm';
    actions.innerHTML = `
      <button type="button" data-sales-action="new-sale" class="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all">
        <span class="material-symbols-outlined text-[18px]">add</span>New Sale
      </button>
      <button type="button" data-sales-action="orders" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">receipt_long</span>Orders
      </button>
      <button type="button" data-sales-action="invoices" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">payments</span>Invoices
      </button>
      <button type="button" data-sales-action="export" class="flex items-center gap-xs px-sm py-xs border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">download</span>Export
      </button>
    `;
    rightCluster.insertBefore(actions, rightCluster.firstChild);

    actions.querySelector('[data-sales-action="new-sale"]').addEventListener('click', showNewSaleModal);
    actions.querySelector('[data-sales-action="orders"]').addEventListener('click', () => scrollToPanel('Active Orders'));
    actions.querySelector('[data-sales-action="invoices"]').addEventListener('click', () => scrollToPanel('Invoices & Payments'));
    actions.querySelector('[data-sales-action="export"]').addEventListener('click', exportSalesCsv);
  }

  function bindStaticButtons() {
    Array.from(document.querySelectorAll('button')).forEach(button => {
      const text = button.innerText.trim().toLowerCase();
      if (button.dataset.salesBound) return;
      if (text.includes('new sale') || button.querySelector('.material-symbols-outlined')?.innerText.trim() === 'add') {
        button.dataset.salesBound = 'true';
        button.addEventListener('click', showNewSaleModal);
      }
      if (text.includes('view all')) {
        button.dataset.salesBound = 'true';
        button.addEventListener('click', showOrdersModal);
      }
    });
  }

  function renderKpis(stats, orders, deliveries, products) {
    const cards = Array.from(document.querySelectorAll('main .grid.grid-cols-1.md\\:grid-cols-3 > div'));
    const shippedKg = orders
      .filter(order => ['dispatched', 'delivered'].includes(String(order.status).toLowerCase()))
      .reduce((sum, order) => sum + Number(order.quantity_kg || 0), 0);
    const stockValue = products.reduce((sum, product) => sum + Number(product.quantity_kg || 0) * Number(product.unit_price || 0), 0);
    const values = [
      {
        icon: 'payments',
        key: 'revenue',
        label: 'Revenue Collected',
        value: money(stats.totalRevenue),
        hint: `${money(stats.outstanding)} outstanding`,
        action: 'Open invoice aging and collection status'
      },
      {
        icon: 'pending_actions',
        key: 'orders',
        label: 'Orders Needing Action',
        value: String(orders.filter(order => !['delivered', 'cancelled'].includes(String(order.status).toLowerCase())).length),
        hint: `${stats.pendingOrders} pending confirmation`,
        action: 'Open confirmed, processing, and dispatch queue'
      },
      {
        icon: 'local_shipping',
        key: 'stock',
        label: 'Shipped Volume',
        value: `${shippedKg.toLocaleString('en-KE')} kg`,
        hint: `${money(stockValue)} sellable stock`,
        action: 'Open delivery and sellable stock analysis'
      }
    ];

    cards.forEach((card, index) => {
      const item = values[index];
      if (!item) return;
      card.dataset.salesKpi = item.key;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = item.action;
      card.innerHTML = `
        <div class="flex justify-between items-start mb-sm">
          <span class="p-xs bg-primary-fixed text-on-primary-fixed rounded-lg material-symbols-outlined">${item.icon}</span>
          <span class="text-primary font-label-md text-label-md text-right">${item.hint}</span>
        </div>
        <h3 class="font-label-md text-label-md text-on-surface-variant">${item.label}</h3>
        <p class="font-headline-lg text-headline-lg text-on-surface">${item.value}</p>
        <p class="mt-xs font-body-sm text-body-sm text-on-surface-variant">${item.action}</p>
      `;
      if (card.dataset.kpiBound !== 'true') {
        card.dataset.kpiBound = 'true';
        card.addEventListener('click', () => showKpiDrilldown(card.dataset.salesKpi));
        card.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') showKpiDrilldown(card.dataset.salesKpi);
        });
      }
    });
  }

  function renderOrders(orders, invoices, deliveries, products) {
    const section = findSection('Active Orders');
    const tbody = section?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = orders.map(order => {
      const items = getOrderItems(order);
      const invoice = invoices.find(item => item.id === order.invoice_id || item.order_id === order.id);
      const delivery = deliveries.find(item => item.order_id === order.id);
      const shortage = getOrderShortages(order, products).reduce((sum, item) => sum + item.shortage, 0);
      return `
        <tr data-sales-order="${order.id}" class="hover:bg-surface-container-low transition-colors">
          <td class="px-lg py-md">
            <p class="font-body-md text-body-md text-on-surface font-semibold">${order.customer_name}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${order.order_number} • ${formatDate(order.delivery_date)}</p>
          </td>
          <td class="px-lg py-md">
            <span class="px-sm py-base bg-surface-container text-on-surface-variant rounded-full font-label-sm text-label-sm">${orderProductSummary(order)}</span>
            <p class="mt-xs text-body-sm text-on-surface-variant">${Number(order.quantity_kg || 0).toLocaleString('en-KE')} kg${shortage ? ` • ${shortage.toLocaleString('en-KE')} kg short` : ''}</p>
          </td>
          <td class="px-lg py-md font-body-md text-body-md text-on-surface">${money(order.total_ksh)}</td>
          <td class="px-lg py-md">
            ${statusBadge(order.status)}
            <p class="mt-xs text-[11px] text-on-surface-variant">${invoice ? formatStatus(invoice.status) : 'No invoice'} • ${delivery ? formatStatus(delivery.status) : 'No delivery'}</p>
          </td>
        </tr>
      `;
    }).join('') || emptyRow('No sales orders yet. Create a new sale to begin.');

    tbody.querySelectorAll('[data-sales-order]').forEach(row => {
      row.addEventListener('click', () => {
        const order = orders.find(item => item.id === row.dataset.salesOrder);
        if (order) showOrderDetail(order);
      });
    });
  }

  function renderDistribution(deliveries, orders) {
    const section = findSection('Distribution Status');
    if (!section) return;
    const active = deliveries.find(item => item.status === 'in_transit') || deliveries[0];
    const order = orders.find(item => item.id === active?.order_id);
    const body = section.querySelector('.flex-grow');
    if (!body) return;
    body.innerHTML = `
      <iframe title="Sales delivery map" class="w-full h-full min-h-[320px] border-0" loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=36.728%2C-1.335%2C36.93%2C-1.205&layer=mapnik&marker=-1.286389%2C36.817223"></iframe>
      <div class="absolute bottom-md left-md right-md bg-white/95 backdrop-blur-sm border border-outline-variant p-md rounded-xl shadow-lg">
        <div class="flex items-center justify-between gap-md">
          <div class="flex items-center gap-md min-w-0">
            <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
              <span class="material-symbols-outlined">local_shipping</span>
            </div>
            <div class="min-w-0">
              <p class="font-label-md text-label-md text-on-surface truncate">${active?.truck_plate || 'Delivery fleet ready'}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${active ? `${formatStatus(active.status)}: ${active.destination}` : 'No active delivery assigned'}</p>
            </div>
          </div>
          <button type="button" data-open-delivery="${active?.id || ''}" class="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">Open</button>
        </div>
      </div>
    `;
    body.querySelector('[data-open-delivery]')?.addEventListener('click', () => {
      if (!active) return showOrdersModal();
      showDeliveryDetail(active, order);
    });
  }

  function renderClients(customers, orders, invoices) {
    const section = findSection('Client Highlights');
    const list = section?.querySelector('.p-lg');
    if (!list) return;
    const ranked = customers
      .map(customer => {
        const customerOrders = orders.filter(order => order.customer_id === customer.id);
        const customerInvoices = invoices.filter(invoice => invoice.customer_id === customer.id);
        return {
          ...customer,
          orderCount: customerOrders.length,
          volume: customerOrders.reduce((sum, order) => sum + Number(order.total_ksh || 0), 0),
          outstanding: customerInvoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || 0), 0)
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 4);

    list.innerHTML = ranked.map(customer => `
      <button type="button" data-sales-customer="${customer.id}" class="w-full text-left flex items-center justify-between p-sm rounded-xl border border-outline-variant bg-surface-container-low transition-all hover:border-primary cursor-pointer">
        <div class="flex items-center gap-md min-w-0">
          <div class="w-10 h-10 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold">${initials(customer.company_name)}</div>
          <div class="min-w-0">
            <p class="font-body-md text-body-md text-on-surface font-semibold truncate">${customer.company_name}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${formatStatus(customer.category)} • ${formatStatus(customer.status)}</p>
          </div>
        </div>
        <div class="text-right shrink-0">
          <p class="font-label-md text-label-md text-primary">${money(customer.volume)}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${customer.orderCount} orders</p>
        </div>
      </button>
    `).join('');
    list.querySelectorAll('[data-sales-customer]').forEach(button => {
      button.addEventListener('click', () => {
        const customer = customers.find(item => item.id === button.dataset.salesCustomer);
        if (customer) showCustomerDetail(customer, orders, invoices);
      });
    });
  }

  function renderTimeline(orders, invoices, deliveries) {
    const section = findSection('Recent Shipments Timeline');
    const timeline = section?.querySelector('.relative.pl-8');
    if (!timeline) return;
    const events = [
      ...deliveries.map(item => ({
        title: `${item.truck_plate || 'Truck'} ${formatStatus(item.status)}`,
        detail: `${item.customer_name} • ${item.destination}`,
        time: item.delivery_time || item.dispatch_time,
        status: item.status,
        id: item.id,
        type: 'delivery'
      })),
      ...invoices.map(item => ({
        title: `${item.invoice_number} ${formatStatus(item.status)}`,
        detail: `${item.customer_name} • ${money(item.total_ksh || item.amount_ksh)}`,
        time: item.payment_date || item.issued_date,
        status: item.status,
        id: item.id,
        type: 'invoice'
      })),
      ...orders.map(item => ({
        title: `${item.order_number} ${formatStatus(item.status)}`,
        detail: `${item.customer_name} • ${item.product_name}`,
        time: item.delivery_date || item.order_date,
        status: item.status,
        id: item.id,
        type: 'order'
      }))
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 5);

    timeline.innerHTML = events.map(event => `
      <div class="relative" data-sales-event="${event.type}:${event.id}">
        <div class="absolute -left-10 top-0 w-4 h-4 rounded-full ${event.status === 'paid' || event.status === 'delivered' ? 'bg-primary' : 'bg-secondary'} border-4 border-surface"></div>
        <div class="bg-surface-container-low p-md rounded-xl border border-outline-variant">
          <div class="flex justify-between items-start gap-md">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${event.title}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${event.detail}</p>
            </div>
            <span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">${formatDate(event.time)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderSalesPanels(orders, invoices, deliveries, products) {
    let panel = document.querySelector('[data-sales-ops-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.salesOpsPanel = 'true';
      panel.className = 'mt-lg grid grid-cols-1 lg:grid-cols-12 gap-lg';
      document.querySelector('main')?.appendChild(panel);
    }
    const openInvoices = invoices.filter(invoice => invoice.status !== 'paid');
    const lowProducts = products.filter(product => Number(product.quantity_kg || 0) < 500);
    panel.innerHTML = `
      <section class="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Invoices & Payments</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Record money movement and close customer balances.</p>
          </div>
          <button type="button" data-open-invoices class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">View All</button>
        </div>
        <div class="space-y-sm">
          ${openInvoices.slice(0, 4).map(invoice => invoiceItem(invoice)).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No unpaid invoices.</div>'}
        </div>
      </section>
      <section class="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Sellable Stock</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Finished goods available for confirmed orders.</p>
          </div>
          <button type="button" data-open-stock class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Stock</button>
        </div>
        <div class="space-y-sm">
          ${products.map(product => `
            <button type="button" data-sales-product="${product.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-md">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate">${product.name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${product.sku || product.category}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-label-md text-label-md ${Number(product.quantity_kg || 0) < 500 ? 'text-error' : 'text-primary'}">${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${money(product.unit_price)}/kg</p>
              </div>
            </button>
          `).join('')}
        </div>
      </section>
      <section class="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Cross-Department Action Center</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Sales work that must be handled by Production, Inventory, Logistics, or Finance.</p>
        </div>
        <div class="mt-md space-y-sm">
          <button type="button" data-sales-handoff="production" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">
            <div class="flex items-center justify-between gap-md">
              <p class="font-label-md text-label-md text-on-surface">Production Requests</p>
              <span class="text-primary font-label-md text-label-md">${lowProducts.length}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Low finished stock and sales shortages to queue for Production.</p>
          </button>
          <button type="button" data-sales-handoff="logistics" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">
            <div class="flex items-center justify-between gap-md">
              <p class="font-label-md text-label-md text-on-surface">Dispatch Follow-Up</p>
              <span class="text-secondary font-label-md text-label-md">${deliveries.filter(d => d.status === 'in_transit').length}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Deliveries in transit and orders ready for vehicle assignment.</p>
          </button>
          <button type="button" data-sales-handoff="finance" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">
            <div class="flex items-center justify-between gap-md">
              <p class="font-label-md text-label-md text-on-surface">Finance Collections</p>
              <span class="text-error font-label-md text-label-md">${openInvoices.length}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Unpaid invoices that need reminders or payment recording.</p>
          </button>
        </div>
      </section>
      <section class="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Sales Analysis</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Revenue, order value, stock value, and delivery execution in one view.</p>
          </div>
          <button type="button" data-sales-analysis class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Open Analysis</button>
        </div>
        ${salesAnalysisPreview(orders, invoices, deliveries, products)}
      </section>
    `;

    panel.querySelector('[data-open-invoices]')?.addEventListener('click', showInvoicesModal);
    panel.querySelector('[data-open-stock]')?.addEventListener('click', showStockModal);
    panel.querySelector('[data-sales-handoff="production"]')?.addEventListener('click', () => showProductionHandoff(products));
    panel.querySelector('[data-sales-handoff="logistics"]')?.addEventListener('click', showDeliveriesModal);
    panel.querySelector('[data-sales-handoff="finance"]')?.addEventListener('click', showInvoicesModal);
    panel.querySelector('[data-sales-analysis]')?.addEventListener('click', showSalesAnalysisModal);
    panel.querySelectorAll('[data-sales-invoice]').forEach(button => {
      button.addEventListener('click', () => {
        const invoice = invoices.find(item => item.id === button.dataset.salesInvoice);
        if (invoice) showInvoiceDetail(invoice);
      });
    });
    panel.querySelectorAll('[data-sales-product]').forEach(button => {
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.salesProduct);
        if (product) showProductDetail(product);
      });
    });
  }

  async function showNewSaleModal() {
    const [customers, products] = await Promise.all([window.salesModule.getCustomers(), getProducts()]);
    const overlay = createModal('New Sale Order', `
      <form data-new-sale-form class="space-y-md">
        ${selectField('customer_id', 'Customer', customers.map(customer => [customer.id, `${customer.company_name} (${formatStatus(customer.status)})`]))}
        <div>
          <div class="flex items-center justify-between gap-md mb-sm">
            <div>
              <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Invoice lines</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Add one or more finished products to the same invoice.</p>
            </div>
            <button type="button" data-add-sale-line class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Add Product</button>
          </div>
          <div data-sale-lines class="space-y-sm"></div>
        </div>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Delivery date</span>
          <input name="delivery_date" type="date" required value="${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Notes</span>
          <textarea name="notes" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Delivery instructions, credit approval, or packaging notes"></textarea>
        </label>
        <div data-sale-stock-note class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-body-sm text-on-surface-variant"></div>
        ${modalActions('Create Order')}
      </form>
    `, 'Sales Control');

    const form = overlay.querySelector('[data-new-sale-form]');
    const linesEl = form.querySelector('[data-sale-lines]');
    const note = form.querySelector('[data-sale-stock-note]');
    const addLine = (productId = products[0]?.id, qty = 100) => {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-sm p-sm rounded-lg bg-surface-container-low border border-outline-variant';
      row.dataset.saleLine = 'true';
      row.innerHTML = `
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Product</span>
          <select name="line_product_id" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
            ${products.map(product => `<option value="${product.id}" ${product.id === productId ? 'selected' : ''}>${product.name} - ${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg</option>`).join('')}
          </select>
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Qty kg</span>
          <input name="line_quantity_kg" required min="0.1" step="0.1" type="number" value="${qty}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">KES/kg</span>
          <input name="line_unit_price" required min="0" step="0.1" type="number" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
        </label>
        <button type="button" data-remove-sale-line class="self-end px-sm py-sm border border-outline text-on-surface-variant rounded-full font-label-sm text-label-sm">Remove</button>
      `;
      linesEl.appendChild(row);
      const productSelect = row.querySelector('[name="line_product_id"]');
      const priceInput = row.querySelector('[name="line_unit_price"]');
      const syncPrice = () => {
        const product = products.find(item => item.id === productSelect.value);
        priceInput.value = Number(product?.unit_price || 0);
        updateQuote();
      };
      productSelect.addEventListener('change', syncPrice);
      row.querySelector('[name="line_quantity_kg"]').addEventListener('input', updateQuote);
      priceInput.addEventListener('input', updateQuote);
      row.querySelector('[data-remove-sale-line]').addEventListener('click', () => {
        if (linesEl.querySelectorAll('[data-sale-line]').length > 1) row.remove();
        updateQuote();
      });
      syncPrice();
      document.dispatchEvent(new CustomEvent('eden:content-updated'));
    };
    const getLines = () => Array.from(linesEl.querySelectorAll('[data-sale-line]')).map(row => {
      const product = products.find(item => item.id === row.querySelector('[name="line_product_id"]').value);
      const quantity = Number(row.querySelector('[name="line_quantity_kg"]').value || 0);
      const unitPrice = Number(row.querySelector('[name="line_unit_price"]').value || product?.unit_price || 0);
      return {
        product_id: product?.id,
        product_name: product?.name,
        quantity_kg: quantity,
        unit_price: unitPrice,
        line_total_ksh: quantity * unitPrice,
        available_kg: Number(product?.quantity_kg || 0)
      };
    }).filter(line => line.product_id && line.quantity_kg > 0);
    const updateQuote = () => {
      const lines = getLines();
      const total = lines.reduce((sum, line) => sum + line.line_total_ksh, 0);
      const shortageLines = lines.filter(line => line.quantity_kg > line.available_kg);
      note.innerHTML = shortageLines.length
        ? `<span class="text-error font-bold">${shortageLines.length} line${shortageLines.length === 1 ? '' : 's'} short.</span> This sale will be blocked until Production or Inventory restores stock. Estimated demand: <span class="font-bold">${money(total)}</span>.`
        : `${lines.length} product line${lines.length === 1 ? '' : 's'} ready. Estimated invoice: <span class="font-bold">${money(total)}</span>.`;
    };
    form.querySelector('[data-add-sale-line]').addEventListener('click', () => addLine());
    addLine();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const customer = customers.find(item => item.id === data.customer_id);
      const lines = getLines();
      if (!lines.length) {
        toast('Add at least one product line.', 'error');
        return;
      }
      const stockDecision = evaluateSaleStock(lines);
      if (stockDecision.blocked) {
        const demand = queueUnfulfilledSaleDemand({
          customer,
          lines,
          delivery_date: data.delivery_date,
          notes: data.notes,
          reason: stockDecision.reason
        });
        overlay.remove();
        toast(`${stockDecision.message} Demand ${demand.id} was sent to Production and Inventory.`, 'warning');
        await renderSalesPage();
        return;
      }
      const totalQty = lines.reduce((sum, line) => sum + line.quantity_kg, 0);
      const total = lines.reduce((sum, line) => sum + line.line_total_ksh, 0);
      const order = await window.salesModule.createOrder({
        customer_id: customer?.id,
        customer_name: customer?.company_name,
        items: lines,
        product_id: lines[0]?.product_id,
        product_name: lines.length > 1 ? `${lines.length} products` : lines[0]?.product_name,
        quantity_kg: totalQty,
        unit_price: lines[0]?.unit_price,
        total_ksh: total,
        delivery_date: data.delivery_date,
        notes: data.notes
      });
      overlay.remove();
      toast(order ? `${order.order_number} created.` : 'Could not create order.', order ? 'success' : 'error');
      await renderSalesPage();
    });
  }

  async function showOrderDetail(order) {
    const [invoices, deliveries, products] = await Promise.all([
      window.salesModule.getInvoices(),
      window.salesModule.getDeliveries(),
      getProducts()
    ]);
    const invoice = invoices.find(item => item.id === order.invoice_id || item.order_id === order.id);
    const delivery = deliveries.find(item => item.order_id === order.id);
    const items = getOrderItems(order);
    const shortages = getOrderShortages(order, products);
    const canDispatch = !delivery && !['dispatched', 'delivered', 'cancelled'].includes(String(order.status).toLowerCase());

    const overlay = createModal(order.order_number, `
      <div class="space-y-md">
        ${detailGrid([
          ['Customer', order.customer_name],
          ['Products', orderProductSummary(order)],
          ['Quantity', `${Number(order.quantity_kg || 0).toLocaleString('en-KE')} kg`],
          ['Order Value', money(order.total_ksh)],
          ['Order Status', formatStatus(order.status)],
          ['Payment', invoice ? formatStatus(invoice.status) : 'No invoice'],
          ['Delivery', delivery ? formatStatus(delivery.status) : 'Not dispatched'],
          ['Finished Stock', shortages.length ? `${shortages.length} product shortage${shortages.length === 1 ? '' : 's'}` : 'All lines available']
        ])}
        <div class="rounded-xl border border-outline-variant overflow-hidden">
          <div class="px-md py-sm bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase">Invoice Lines</div>
          <div class="divide-y divide-outline-variant">
            ${items.map(item => {
              const product = products.find(entry => entry.id === item.product_id);
              const available = Number(product?.quantity_kg || 0);
              const shortage = Math.max(0, Number(item.quantity_kg || 0) - available);
              return `
                <div class="p-sm flex items-center justify-between gap-md">
                  <div>
                    <p class="font-label-md text-label-md text-on-surface">${item.product_name}</p>
                    <p class="font-body-sm text-body-sm text-on-surface-variant">${Number(item.quantity_kg || 0).toLocaleString('en-KE')} kg at ${money(item.unit_price)}/kg • ${available.toLocaleString('en-KE')} kg available</p>
                  </div>
                  <div class="text-right">
                    <p class="font-label-md text-label-md text-on-surface">${money(item.line_total_ksh)}</p>
                    ${shortage ? `<p class="font-body-sm text-body-sm text-error">${shortage.toLocaleString('en-KE')} kg short</p>` : '<p class="font-body-sm text-body-sm text-primary">Ready</p>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Update status</span>
          <select data-order-status class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
            ${['confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'].map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${formatStatus(status)}</option>`).join('')}
          </select>
        </label>
        <div class="flex flex-wrap justify-end gap-sm">
          <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Close</button>
          ${invoice ? `<button type="button" data-record-payment="${invoice.id}" class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md">Record Payment</button>` : `<button type="button" data-generate-invoice class="px-md py-sm border border-outline text-on-surface-variant rounded-full font-label-md text-label-md">Generate Invoice</button>`}
          ${canDispatch ? '<button type="button" data-dispatch-order class="px-md py-sm bg-secondary text-on-secondary rounded-full font-label-md text-label-md">Dispatch</button>' : ''}
          ${delivery && delivery.status !== 'delivered' ? '<button type="button" data-mark-delivered class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Mark Delivered</button>' : ''}
        </div>
      </div>
    `, 'Order Control', 'max-w-2xl');

    overlay.querySelector('[data-order-status]').addEventListener('change', async event => {
      await window.salesModule.updateOrderStatus(order.id, event.target.value);
      toast('Order status updated.', 'success');
      overlay.remove();
      await renderSalesPage();
    });
    overlay.querySelector('[data-generate-invoice]')?.addEventListener('click', async () => {
      const created = await window.salesModule.generateInvoice(order.id);
      overlay.remove();
      toast(created ? `${created.invoice_number} generated.` : 'Could not generate invoice.', created ? 'success' : 'error');
      await renderSalesPage();
    });
    overlay.querySelector('[data-record-payment]')?.addEventListener('click', () => {
      overlay.remove();
      showPaymentModal(invoice);
    });
    overlay.querySelector('[data-dispatch-order]')?.addEventListener('click', async () => {
      const dispatched = await dispatchOrder(order, products);
      overlay.remove();
      toast(dispatched ? `${order.order_number} dispatched and stock issued.` : 'Could not dispatch. Check stock.', dispatched ? 'success' : 'error');
      await renderSalesPage();
    });
    overlay.querySelector('[data-mark-delivered]')?.addEventListener('click', async () => {
      await updateDelivery(delivery.id, { status: 'delivered', delivery_time: new Date().toISOString() });
      await window.salesModule.updateOrderStatus(order.id, 'delivered');
      overlay.remove();
      toast('Delivery marked complete.', 'success');
      await renderSalesPage();
    });
  }

  async function dispatchOrder(order, products) {
    const shortages = getOrderShortages(order, products);
    if (shortages.length) {
      shortages.forEach(item => queueProductionTask({ id: item.product_id, name: item.product_name }, item.shortage, order));
      return false;
    }
    if (!window.authManager?.isMockMode?.() && window.salesModule?.dispatchOrder) {
      return Boolean(await window.salesModule.dispatchOrder(order.id, {
        driver_name: 'Dispatch Team',
        truck_plate: `EDN-${Math.floor(100 + Math.random() * 899)}`,
        idempotency_key: `dispatch:${order.id}`
      }));
    }
    if (!order.stock_issued && window.inventoryModule?.updateFinishedProductStock) {
      for (const item of getOrderItems(order)) {
        await window.inventoryModule.updateFinishedProductStock(item.product_id, -Number(item.quantity_kg || 0));
      }
      updateOrderLocal(order.id, { stock_issued: true });
    }
    await window.salesModule.updateOrderStatus(order.id, 'dispatched');
    createDelivery(order);
    return true;
  }

  function createDelivery(order) {
    const deliveries = readJson('eden_deliveries', []);
    const existing = deliveries.find(item => item.order_id === order.id);
    if (existing) return existing;
    const delivery = {
      id: `del-${Date.now()}`,
      order_id: order.id,
      driver_name: 'Dispatch Team',
      truck_plate: `EDN-${Math.floor(100 + Math.random() * 899)}`,
      dispatch_time: new Date().toISOString(),
      delivery_time: null,
      status: 'in_transit',
      customer_name: order.customer_name,
      destination: order.notes || 'Customer delivery address'
    };
    deliveries.unshift(delivery);
    localStorage.setItem('eden_deliveries', JSON.stringify(deliveries));
    return delivery;
  }

  async function updateDelivery(id, updates) {
    const deliveries = readJson('eden_deliveries', []);
    const index = deliveries.findIndex(item => item.id === id);
    if (index !== -1) deliveries[index] = { ...deliveries[index], ...updates };
    localStorage.setItem('eden_deliveries', JSON.stringify(deliveries));
    return deliveries[index] || null;
  }

  function updateOrderLocal(id, updates) {
    const orders = readJson('eden_orders', []);
    const index = orders.findIndex(item => item.id === id);
    if (index !== -1) orders[index] = { ...orders[index], ...updates };
    localStorage.setItem('eden_orders', JSON.stringify(orders));
    return orders[index] || null;
  }

  function showPaymentModal(invoice) {
    const overlay = createModal('Record Payment', `
      <form data-payment-form class="space-y-md">
        ${detailGrid([
          ['Invoice', invoice.invoice_number],
          ['Customer', invoice.customer_name],
          ['Amount Due', money(invoice.total_ksh || invoice.amount_ksh)]
        ])}
        ${numberField('amount_ksh', 'Amount paid (KES)', invoice.total_ksh || invoice.amount_ksh || 0)}
        ${modalActions('Record Payment')}
      </form>
    `, 'Finance Handoff');
    overlay.querySelector('[data-payment-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const amount = Number(new FormData(event.currentTarget).get('amount_ksh') || 0);
      const paid = await window.salesModule.recordPayment(invoice.id, amount);
      overlay.remove();
      toast(paid ? `${invoice.invoice_number} marked paid.` : 'Could not record payment.', paid ? 'success' : 'error');
      await renderSalesPage();
    });
  }

  async function showOrdersModal() {
    const orders = await window.salesModule.getOrders();
    const overlay = createModal('All Sales Orders', `
      <div data-sort-list data-sort-default="order:desc" class="space-y-sm">
        ${orders.map(order => `
          <button type="button" data-modal-order="${order.id}" data-sort-name="${order.customer_name}" data-sort-status="${order.status}" data-sort-value="${Number(order.total_ksh || 0)}" data-sort-date="${order.order_date}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${order.order_number} • ${order.customer_name}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${order.product_name} • ${Number(order.quantity_kg || 0).toLocaleString('en-KE')} kg</p>
            </div>
            <div class="text-right">${statusBadge(order.status)}<p class="mt-xs font-label-sm text-label-sm">${money(order.total_ksh)}</p></div>
          </button>
        `).join('')}
      </div>
    `, 'Sales Orders', 'max-w-3xl');
    overlay.querySelectorAll('[data-modal-order]').forEach(button => {
      button.addEventListener('click', () => {
        const order = orders.find(item => item.id === button.dataset.modalOrder);
        overlay.remove();
        if (order) showOrderDetail(order);
      });
    });
  }

  async function showInvoicesModal() {
    const invoices = await window.salesModule.getInvoices();
    const overlay = createModal('Invoices & Payments', `
      <div data-sort-list class="space-y-sm">
        ${invoices.map(invoice => invoiceItem(invoice)).join('')}
      </div>
    `, 'Finance Handoff', 'max-w-3xl');
    overlay.querySelectorAll('[data-sales-invoice]').forEach(button => {
      button.addEventListener('click', () => {
        const invoice = invoices.find(item => item.id === button.dataset.salesInvoice);
        overlay.remove();
        if (invoice) showInvoiceDetail(invoice);
      });
    });
  }

  function showInvoiceDetail(invoice) {
    const overlay = createModal(invoice.invoice_number, `
      ${detailGrid([
        ['Customer', invoice.customer_name],
        ['Issued', formatDate(invoice.issued_date)],
        ['Due', formatDate(invoice.due_date)],
        ['Amount', money(invoice.amount_ksh)],
        ['VAT', money(invoice.tax_ksh)],
        ['Total', money(invoice.total_ksh)],
        ['Status', formatStatus(invoice.status)]
      ])}
      <div class="mt-md rounded-xl border border-outline-variant overflow-hidden">
        <div class="px-md py-sm bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase">Invoice Products</div>
        <div class="divide-y divide-outline-variant">
          ${(Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [{ product_name: 'Order total', quantity_kg: '', unit_price: '', line_total_ksh: invoice.amount_ksh }]).map(item => `
            <div class="p-sm flex items-center justify-between gap-md">
              <div>
                <p class="font-label-md text-label-md text-on-surface">${item.product_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${item.quantity_kg ? `${Number(item.quantity_kg).toLocaleString('en-KE')} kg at ${money(item.unit_price)}/kg` : 'Legacy invoice line'}</p>
              </div>
              <p class="font-label-md text-label-md text-on-surface">${money(item.line_total_ksh)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="flex justify-end gap-sm pt-md">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Close</button>
        ${invoice.status !== 'paid' ? `<button type="button" data-pay-invoice class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Record Payment</button>` : ''}
      </div>
    `, 'Invoice Detail');
    overlay.querySelector('[data-pay-invoice]')?.addEventListener('click', () => {
      overlay.remove();
      showPaymentModal(invoice);
    });
  }

  async function showDeliveriesModal() {
    const [deliveries, orders] = await Promise.all([window.salesModule.getDeliveries(), window.salesModule.getOrders()]);
    createModal('Deliveries', `
      <div class="space-y-sm">
        ${deliveries.map(delivery => {
          const order = orders.find(item => item.id === delivery.order_id);
          return `
            <button type="button" data-delivery-id="${delivery.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
              <div>
                <p class="font-label-md text-label-md text-on-surface">${delivery.truck_plate} • ${delivery.customer_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${delivery.destination}</p>
              </div>
              <div class="text-right">${statusBadge(delivery.status)}<p class="mt-xs text-body-sm">${order?.order_number || ''}</p></div>
            </button>
          `;
        }).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No deliveries yet.</div>'}
      </div>
    `, 'Logistics Handoff', 'max-w-3xl');
  }

  function showDeliveryDetail(delivery, order) {
    createModal('Delivery Detail', `
      ${detailGrid([
        ['Truck', delivery.truck_plate],
        ['Driver', delivery.driver_name],
        ['Customer', delivery.customer_name],
        ['Destination', delivery.destination],
        ['Status', formatStatus(delivery.status)],
        ['Order', order?.order_number || delivery.order_id],
        ['Dispatched', formatDate(delivery.dispatch_time)]
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `, 'Delivery Tracking');
  }

  async function showStockModal() {
    const products = await getProducts();
    createModal('Sellable Finished Stock', `
      <div data-sort-list class="space-y-sm">
        ${products.map(product => `
          <div data-sort-name="${product.name}" data-sort-value="${Number(product.quantity_kg || 0)}" data-sort-status="${product.status}" class="p-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${product.name}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${product.sku || product.category} • ${money(product.unit_price)}/kg</p>
            </div>
            <div class="text-right">
              <p class="font-label-md text-label-md">${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg</p>
              ${statusBadge(product.status)}
            </div>
          </div>
        `).join('')}
      </div>
    `, 'Inventory Handoff', 'max-w-3xl');
  }

  function showProductDetail(product) {
    createModal(product.name, `
      ${detailGrid([
        ['SKU', product.sku || product.id],
        ['Category', formatStatus(product.category)],
        ['Available', `${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg`],
        ['Unit Price', money(product.unit_price)],
        ['Stock Value', money(Number(product.quantity_kg || 0) * Number(product.unit_price || 0))],
        ['Status', formatStatus(product.status)]
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `, 'Finished Goods');
  }

  function showProductionHandoff(products) {
    const low = products.filter(product => Number(product.quantity_kg || 0) < 500);
    const overlay = createModal('Production Handoff', `
      <div class="space-y-sm">
        ${(low.length ? low : products.slice(0, 3)).map(product => `
          <button type="button" data-queue-product="${product.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
            <div>
              <p class="font-label-md text-label-md text-on-surface">${product.name}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg available</p>
            </div>
            <span class="material-symbols-outlined text-primary">add_task</span>
          </button>
        `).join('')}
      </div>
    `, 'Sales To Production');
    overlay.querySelectorAll('[data-queue-product]').forEach(button => {
      button.addEventListener('click', () => {
        const product = products.find(item => item.id === button.dataset.queueProduct);
        queueProductionTask(product, 500, { order_number: 'Sales stock buffer' });
        overlay.remove();
        toast(`Production task queued for ${product.name}.`, 'success');
      });
    });
  }

  function showCustomerDetail(customer, orders, invoices) {
    const customerOrders = orders.filter(order => order.customer_id === customer.id);
    const customerInvoices = invoices.filter(invoice => invoice.customer_id === customer.id);
    createModal(customer.company_name, `
      ${detailGrid([
        ['Contact', customer.contact_name],
        ['Phone', customer.contact_phone],
        ['Email', customer.email],
        ['Category', formatStatus(customer.category)],
        ['Credit Limit', money(customer.credit_limit_ksh)],
        ['Outstanding', money(customer.outstanding_ksh || customerInvoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.total_ksh || 0), 0))],
        ['Orders', customerOrders.length]
      ])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Done</button></div>
    `, 'Customer Detail');
  }

  async function showKpiDrilldown(type) {
    const [orders, invoices, deliveries, products] = await Promise.all([
      window.salesModule.getOrders(),
      window.salesModule.getInvoices(),
      window.salesModule.getDeliveries(),
      getProducts()
    ]);
    if (type === 'revenue') {
      const paid = invoices.filter(invoice => invoice.status === 'paid');
      const open = invoices.filter(invoice => invoice.status !== 'paid');
      createModal('Revenue & Collections', `
        ${detailGrid([
          ['Collected', money(paid.reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0))],
          ['Outstanding', money(open.reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0))],
          ['Paid Invoices', paid.length],
          ['Open Invoices', open.length]
        ])}
        <div class="mt-md space-y-sm">${open.map(invoice => invoiceItem(invoice)).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No outstanding invoices.</div>'}</div>
      `, 'KPI Drilldown', 'max-w-3xl');
      return;
    }
    if (type === 'orders') {
      const actionOrders = orders.filter(order => !['delivered', 'cancelled'].includes(String(order.status).toLowerCase()));
      createModal('Orders Needing Action', `
        <div class="space-y-sm">${actionOrders.map(order => `
          <button type="button" data-modal-order="${order.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
            <div><p class="font-label-md text-label-md text-on-surface">${order.order_number} • ${order.customer_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${orderProductSummary(order)} • ${formatDate(order.delivery_date)}</p></div>
            <div class="text-right">${statusBadge(order.status)}<p class="mt-xs">${money(order.total_ksh)}</p></div>
          </button>`).join('')}</div>
      `, 'KPI Drilldown', 'max-w-3xl');
      document.querySelectorAll('[data-modal-order]').forEach(button => {
        button.addEventListener('click', () => {
          const order = orders.find(item => item.id === button.dataset.modalOrder);
          document.querySelector('[data-modal-card]')?.closest('.fixed')?.remove();
          if (order) showOrderDetail(order);
        });
      });
      return;
    }
    createModal('Shipped Volume & Stock', `
      ${detailGrid([
        ['Shipped Kg', `${orders.filter(order => ['dispatched', 'delivered'].includes(String(order.status).toLowerCase())).reduce((sum, order) => sum + Number(order.quantity_kg || 0), 0).toLocaleString('en-KE')} kg`],
        ['Active Deliveries', deliveries.filter(delivery => delivery.status === 'in_transit').length],
        ['Sellable Stock Value', money(products.reduce((sum, product) => sum + Number(product.quantity_kg || 0) * Number(product.unit_price || 0), 0))],
        ['Low Stock Products', products.filter(product => Number(product.quantity_kg || 0) < 500).length]
      ])}
      <div class="mt-md">${salesAnalysisVisual(orders, invoices, deliveries, products)}</div>
    `, 'KPI Drilldown', 'max-w-4xl');
  }

  async function showSalesAnalysisModal() {
    const [orders, invoices, deliveries, products] = await Promise.all([
      window.salesModule.getOrders(),
      window.salesModule.getInvoices(),
      window.salesModule.getDeliveries(),
      getProducts()
    ]);
    createModal('Advanced Sales Intelligence', salesAnalysisVisual(orders, invoices, deliveries, products), 'Forecasts, Risk & Scenario Tools', 'max-w-6xl');
  }

  function salesAnalysisPreview(orders, invoices, deliveries, products) {
    const paid = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const outstanding = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const orderValue = orders.reduce((sum, order) => sum + Number(order.total_ksh || 0), 0);
    const stockValue = products.reduce((sum, product) => sum + Number(product.quantity_kg || 0) * Number(product.unit_price || 0), 0);
    const collectionRate = Math.round((paid / Math.max(paid + outstanding, 1)) * 100);
    const deliveryRate = Math.round((deliveries.filter(delivery => delivery.status === 'delivered').length / Math.max(deliveries.length, 1)) * 100);
    const productRows = productRevenueRows(orders, products).slice(0, 4);
    const maxProduct = Math.max(...productRows.map(row => row.value), 1);
    return `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-lg">
        <div class="xl:col-span-4 grid grid-cols-2 gap-sm">
          ${[
            ['Collection', `${collectionRate}%`, money(paid)],
            ['Pipeline', money(orderValue), `${orders.length} orders`],
            ['Delivery', `${deliveryRate}%`, `${deliveries.length} trips`],
            ['Stock Cover', money(stockValue), 'Finished goods']
          ].map(([label, value, hint]) => `
            <div class="p-md rounded-lg bg-surface-container-low border border-outline-variant">
              <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</p>
              <p class="font-headline-sm text-headline-sm text-primary">${value}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
            </div>
          `).join('')}
        </div>
        <div class="xl:col-span-5 p-md rounded-xl bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-sm">Top Product Mix</p>
          <div class="space-y-sm">
            ${productRows.map(row => `
              <div>
                <div class="flex items-center justify-between gap-sm mb-xs">
                  <p class="font-label-md text-label-md text-on-surface truncate">${row.name}</p>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">${money(row.value)}</span>
                </div>
                <div class="h-3 rounded-full bg-surface-container-high overflow-hidden">
                  <div class="h-full rounded-full bg-primary" style="width:${Math.max(5, Math.round((row.value / maxProduct) * 100))}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="xl:col-span-3 p-md rounded-xl bg-primary/10 border border-primary/20">
          <p class="font-label-sm text-label-sm text-primary uppercase">Advanced Workspace</p>
          <p class="mt-xs font-body-sm text-body-sm text-on-surface-variant">Open the full analytics view for trend charts, customer concentration, invoice aging, scenario planning, and recommended actions.</p>
        </div>
      </div>
    `;
  }

  function salesAnalysisVisual(orders, invoices, deliveries, products) {
    const paid = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const outstanding = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const orderValue = orders.reduce((sum, order) => sum + Number(order.total_ksh || 0), 0);
    const stockValue = products.reduce((sum, product) => sum + Number(product.quantity_kg || 0) * Number(product.unit_price || 0), 0);
    const collectionRate = Math.round((paid / Math.max(paid + outstanding, 1)) * 100);
    const deliveryRate = Math.round((deliveries.filter(delivery => delivery.status === 'delivered').length / Math.max(deliveries.length, 1)) * 100);
    const avgOrder = Math.round(orderValue / Math.max(orders.length, 1));
    const projected30 = Math.round(orderValue * 1.18 + outstanding * 0.35);
    const projected90 = Math.round(projected30 * 2.85);
    const requiredStockValue = Math.max(0, projected30 - stockValue);
    const trend = buildMonthlyTrend(orders, invoices);
    const trendMax = Math.max(...trend.map(item => item.orders + item.collected), 1);
    const productRows = productRevenueRows(orders, products);
    const productMax = Math.max(...productRows.map(item => item.value), 1);
    const customerRows = customerRevenueRows(orders, invoices);
    const agingRows = invoiceAgingRows(invoices);
    const statusCounts = ['confirmed', 'processing', 'dispatched', 'delivered'].map(status => ({
      status,
      count: orders.filter(order => String(order.status).toLowerCase() === status).length
    }));
    return `
      <div class="space-y-lg">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-sm">
          ${[
            ['Collection Rate', `${collectionRate}%`, `${money(paid)} paid`],
            ['Pipeline Value', money(orderValue), `${orders.length} orders`],
            ['Avg Order Value', money(avgOrder), 'Current book'],
            ['30-Day Forecast', money(projected30), '+18% pipeline model'],
            ['Stock Gap Risk', money(requiredStockValue), requiredStockValue ? 'Production follow-up' : 'Covered']
          ].map(([label, value, hint]) => `
            <div class="p-md rounded-lg bg-surface-container-low border border-outline-variant">
              <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</p>
              <p class="font-headline-sm text-headline-sm text-primary">${value}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
            </div>
          `).join('')}
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-lg">
          <section class="xl:col-span-7 p-md rounded-xl bg-surface-container-low border border-outline-variant">
            <div class="flex items-center justify-between gap-md mb-md">
              <div>
                <p class="font-headline-sm text-headline-sm text-on-surface">Revenue Trend & Forecast</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Orders booked vs cash collected with projected 90-day direction.</p>
              </div>
              <span class="px-sm py-xs rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">90D ${money(projected90)}</span>
            </div>
            <svg viewBox="0 0 680 260" class="w-full h-64" role="img" aria-label="Sales revenue trend">
              <defs>
                <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#006c03" stop-opacity="0.24"></stop>
                  <stop offset="100%" stop-color="#006c03" stop-opacity="0.02"></stop>
                </linearGradient>
              </defs>
              ${[0, 1, 2, 3].map(i => `<line x1="44" x2="650" y1="${42 + i * 52}" y2="${42 + i * 52}" stroke="#becab6" stroke-dasharray="4 8" />`).join('')}
              <polyline points="${trend.map((item, index) => `${60 + index * 95},${220 - (item.orders / trendMax) * 165}`).join(' ')}" fill="none" stroke="#805533" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
              <polyline points="${trend.map((item, index) => `${60 + index * 95},${220 - (item.collected / trendMax) * 165}`).join(' ')}" fill="none" stroke="#006c03" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
              ${trend.map((item, index) => `
                <g>
                  <circle cx="${60 + index * 95}" cy="${220 - (item.orders / trendMax) * 165}" r="5" fill="#805533"></circle>
                  <circle cx="${60 + index * 95}" cy="${220 - (item.collected / trendMax) * 165}" r="5" fill="#006c03"></circle>
                  <text x="${60 + index * 95}" y="245" text-anchor="middle" font-size="12" fill="#3f4a3b">${item.label}</text>
                </g>
              `).join('')}
            </svg>
            <div class="flex items-center gap-md text-body-sm text-body-sm text-on-surface-variant">
              <span class="inline-flex items-center gap-xs"><span class="w-3 h-3 rounded-full bg-secondary"></span>Booked orders</span>
              <span class="inline-flex items-center gap-xs"><span class="w-3 h-3 rounded-full bg-primary"></span>Collected cash</span>
            </div>
          </section>

          <section class="xl:col-span-5 p-md rounded-xl bg-surface-container-low border border-outline-variant">
            <p class="font-headline-sm text-headline-sm text-on-surface mb-md">Product Revenue Mix</p>
            <div class="space-y-sm">
              ${productRows.map(item => `
                <div>
                  <div class="flex items-center justify-between gap-md mb-xs">
                    <p class="font-label-md text-label-md text-on-surface truncate">${item.name}</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant">${money(item.value)}</p>
                  </div>
                  <div class="h-4 rounded-full bg-surface-container-high overflow-hidden">
                    <div class="h-full rounded-full bg-primary transition-all duration-500" style="width:${Math.max(5, Math.round((item.value / productMax) * 100))}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-lg">
          <section class="xl:col-span-5 rounded-xl bg-surface-container-low border border-outline-variant overflow-hidden">
            <div class="p-md border-b border-outline-variant">
              <p class="font-headline-sm text-headline-sm text-on-surface">Customer Concentration</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Shows dependency risk and best accounts by order value.</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-surface-container"><tr><th class="px-md py-sm font-label-sm text-label-sm">Customer</th><th class="px-md py-sm font-label-sm text-label-sm">Value</th><th class="px-md py-sm font-label-sm text-label-sm">Risk</th></tr></thead>
                <tbody>
                  ${customerRows.map(row => `<tr><td class="px-md py-sm">${row.name}</td><td class="px-md py-sm">${money(row.value)}</td><td class="px-md py-sm">${row.share > 45 ? statusBadge('high') : row.share > 25 ? statusBadge('medium') : statusBadge('low')}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="xl:col-span-4 rounded-xl bg-surface-container-low border border-outline-variant overflow-hidden">
            <div class="p-md border-b border-outline-variant">
              <p class="font-headline-sm text-headline-sm text-on-surface">Invoice Aging</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Collection urgency by due-date bucket.</p>
            </div>
            <div class="p-md space-y-sm">
              ${agingRows.map(row => `
                <div class="flex items-center justify-between gap-md p-sm rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <span class="font-label-md text-label-md text-on-surface">${row.label}</span>
                  <span class="font-label-md text-label-md ${row.color}">${money(row.value)}</span>
                </div>
              `).join('')}
            </div>
          </section>

          <section class="xl:col-span-3 rounded-xl bg-surface-container-low border border-outline-variant p-md">
            <p class="font-headline-sm text-headline-sm text-on-surface">Scenario Planner</p>
            <div class="mt-md space-y-sm">
              ${[
                ['Conservative', projected30 * 0.82, 'Slower collections, no price lift'],
                ['Expected', projected30, 'Current order rate plus partial collections'],
                ['Growth', projected30 * 1.32, 'Higher conversion and faster deliveries']
              ].map(([label, value, hint]) => `
                <div class="p-sm rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <p class="font-label-md text-label-md text-on-surface">${label}</p>
                  <p class="font-headline-sm text-headline-sm text-primary">${money(value)}</p>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-sm">
          ${statusCounts.map(item => `
            <div class="p-md rounded-lg bg-surface-container-low border border-outline-variant">
              <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">${formatStatus(item.status)}</p>
              <p class="font-headline-md text-headline-md text-primary">${item.count}</p>
            </div>
          `).join('')}
          <div class="p-md rounded-lg bg-surface-container-low border border-outline-variant">
            <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Delivery Rate</p>
            <p class="font-headline-md text-headline-md text-primary">${deliveryRate}%</p>
          </div>
        </div>
        <section class="rounded-xl bg-surface-container-low border border-outline-variant p-md">
          <p class="font-headline-sm text-headline-sm text-on-surface">Recommended Commercial Actions</p>
          <div class="mt-md grid grid-cols-1 md:grid-cols-3 gap-sm">
            ${[
              outstanding > paid * 0.4
                ? ['Finance', 'Prioritize collections', `${money(outstanding)} is still open. Send reminders and record partial payments.`]
                : ['Finance', 'Maintain collection cadence', `Collection rate is ${collectionRate}%. Keep payment follow-ups weekly.`],
              requiredStockValue > 0
                ? ['Production', 'Protect forecast stock', `${money(requiredStockValue)} projected stock gap. Queue finished-good production.`]
                : ['Inventory', 'Stock cover healthy', 'Finished stock value covers the 30-day forecast model.'],
              deliveryRate < 80
                ? ['Logistics', 'Improve delivery closure', `Delivery execution is ${deliveryRate}%. Review in-transit trips and mark delivered.`]
                : ['Sales Ops', 'Scale order conversion', 'Delivery execution is stable; focus on higher-value customers.']
            ].map(([owner, title, body]) => `
              <button type="button" class="text-left p-md rounded-lg bg-surface-container-lowest border border-outline-variant">
                <p class="font-label-sm text-label-sm text-primary uppercase">${owner}</p>
                <p class="font-label-md text-label-md text-on-surface">${title}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${body}</p>
              </button>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }

  function buildMonthlyTrend(orders, invoices) {
    const now = new Date();
    return Array.from({ length: 7 }).map((_, reverseIndex) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (6 - reverseIndex), 1);
      const key = date.toISOString().slice(0, 7);
      return {
        label: date.toLocaleDateString('en-KE', { month: 'short' }),
        orders: orders.filter(order => String(order.order_date || '').startsWith(key)).reduce((sum, order) => sum + Number(order.total_ksh || 0), 0),
        collected: invoices.filter(invoice => String(invoice.payment_date || invoice.issued_date || '').startsWith(key) && invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0)
      };
    });
  }

  function productRevenueRows(orders, products) {
    const totals = new Map();
    orders.forEach(order => {
      getOrderItems(order).forEach(item => {
        const name = item.product_name || products.find(product => product.id === item.product_id)?.name || 'Unknown product';
        totals.set(name, (totals.get(name) || 0) + Number(item.line_total_ksh || 0));
      });
    });
    products.forEach(product => {
      if (!totals.has(product.name)) totals.set(product.name, 0);
    });
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  function customerRevenueRows(orders) {
    const total = orders.reduce((sum, order) => sum + Number(order.total_ksh || 0), 0);
    const totals = new Map();
    orders.forEach(order => totals.set(order.customer_name, (totals.get(order.customer_name) || 0) + Number(order.total_ksh || 0)));
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value, share: Math.round((value / Math.max(total, 1)) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  function invoiceAgingRows(invoices) {
    const today = new Date();
    const rows = [
      { label: 'Current', min: -Infinity, max: 0, value: 0, color: 'text-primary' },
      { label: '1-15 Days Due', min: 1, max: 15, value: 0, color: 'text-secondary' },
      { label: '16+ Days Due', min: 16, max: Infinity, value: 0, color: 'text-error' }
    ];
    invoices.filter(invoice => invoice.status !== 'paid').forEach(invoice => {
      const due = new Date(invoice.due_date || today);
      const days = Math.floor((today - due) / 86400000);
      const row = rows.find(item => days >= item.min && days <= item.max) || rows[0];
      row.value += Number(invoice.total_ksh || invoice.amount_ksh || 0);
    });
    return rows;
  }

  async function exportSalesCsv() {
    const [orders, invoices, deliveries] = await Promise.all([
      window.salesModule.getOrders(),
      window.salesModule.getInvoices(),
      window.salesModule.getDeliveries()
    ]);
    const rows = [
      ['Type', 'ID', 'Customer', 'Product/Destination', 'Amount/Qty', 'Status', 'Date'],
      ...orders.map(order => ['Order', order.order_number, order.customer_name, order.product_name, order.quantity_kg, order.status, order.order_date]),
      ...invoices.map(invoice => ['Invoice', invoice.invoice_number, invoice.customer_name, '', invoice.total_ksh, invoice.status, invoice.issued_date]),
      ...deliveries.map(delivery => ['Delivery', delivery.id, delivery.customer_name, delivery.destination, '', delivery.status, delivery.dispatch_time])
    ];
    downloadTextFile(`eden-sales-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Sales export downloaded.', 'success');
  }

  function queueProductionTask(product, shortageKg, order) {
    const tasks = readJson('eden_tasks', []);
    const reference = order.order_number || order.id || 'Sales demand';
    tasks.unshift({
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Produce ${product?.name || 'finished product'} for Sales`,
      description: `${reference} needs ${Number(shortageKg || 0).toLocaleString('en-KE')} kg. Review raw materials, open a production batch, and update Sales when finished stock is available.`,
      department: 'Production',
      priority: 'high',
      status: 'open',
      assigned_to: 'Production Lead',
      source_module: 'sales_distribution',
      related_product_id: product?.id,
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function queueInventoryTask(line, shortageKg, demand) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Reserve or restock ${line.product_name}`,
      description: `${demand.id} was blocked because ${Number(shortageKg || 0).toLocaleString('en-KE')} kg is unavailable. Confirm finished stock, expected completion date, and notify Sales before an order is created.`,
      department: 'Inventory',
      priority: 'high',
      status: 'open',
      assigned_to: 'Inventory Controller',
      source_module: 'sales_distribution',
      related_product_id: line.product_id,
      related_customer_id: demand.customer_id,
      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function evaluateSaleStock(lines) {
    const outOfStock = lines.filter(line => Number(line.available_kg || 0) <= 0);
    const shortages = lines.filter(line => Number(line.quantity_kg || 0) > Number(line.available_kg || 0));
    if (outOfStock.length === lines.length) {
      return {
        blocked: true,
        reason: 'all_products_out_of_stock',
        message: 'No selected product is in stock, so no sale was created.'
      };
    }
    if (shortages.length) {
      return {
        blocked: true,
        reason: 'insufficient_finished_stock',
        message: 'Finished stock is insufficient, so no sale was created.'
      };
    }
    return { blocked: false };
  }

  function queueUnfulfilledSaleDemand({ customer, lines, delivery_date, notes, reason }) {
    const demands = readJson('eden_sales_demand_requests', []);
    const demand = {
      id: `DEMAND-${Date.now()}`,
      customer_id: customer?.id,
      customer_name: customer?.company_name || 'Unassigned customer',
      source_module: 'sales_distribution',
      status: 'queued_for_production',
      reason,
      delivery_date,
      notes,
      lines: lines.map(line => ({
        product_id: line.product_id,
        product_name: line.product_name,
        requested_kg: Number(line.quantity_kg || 0),
        available_kg: Number(line.available_kg || 0),
        shortage_kg: Math.max(0, Number(line.quantity_kg || 0) - Number(line.available_kg || 0)),
        unit_price: Number(line.unit_price || 0),
        line_total_ksh: Number(line.line_total_ksh || 0)
      })),
      estimated_value_ksh: lines.reduce((sum, line) => sum + Number(line.line_total_ksh || 0), 0),
      created_at: new Date().toISOString()
    };
    demands.unshift(demand);
    localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));

    demand.lines.forEach(line => {
      const shortage = Math.max(Number(line.requested_kg || 0), Number(line.shortage_kg || 0));
      queueProductionTask({ id: line.product_id, name: line.product_name }, shortage, demand);
      queueInventoryTask({
        product_id: line.product_id,
        product_name: line.product_name
      }, shortage, demand);
    });
    createSalesNotification(
      'Blocked sale demand sent to Production',
      `${demand.customer_name}: ${demand.lines.length} product line${demand.lines.length === 1 ? '' : 's'} require stock before order creation.`
    );
    return demand;
  }

  function createSalesNotification(title, message) {
    const userKey = window.appState?.user?.id || 'local';
    const key = `eden_notifications_${userKey}`;
    const notifications = readJson(key, []);
    notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type: 'warning',
      read: false,
      created_at: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(notifications));
  }

  async function getProducts() {
    if (window.inventoryModule?.getFinishedProducts) return window.inventoryModule.getFinishedProducts();
    return readJson('eden_finished_products', []);
  }

  function invoiceItem(invoice) {
    return `
      <button type="button" data-sales-invoice="${invoice.id}" data-sort-name="${invoice.customer_name}" data-sort-status="${invoice.status}" data-sort-value="${Number(invoice.total_ksh || 0)}" data-sort-date="${invoice.due_date}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-md">
        <div class="min-w-0">
          <p class="font-label-md text-label-md text-on-surface truncate">${invoice.invoice_number} • ${invoice.customer_name}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Due ${formatDate(invoice.due_date)}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-label-md text-label-md text-on-surface">${money(invoice.total_ksh || invoice.amount_ksh)}</p>
          ${statusBadge(invoice.status)}
        </div>
      </button>
    `;
  }

  function createModal(title, bodyHtml, eyebrow = 'Sales & Distribution', maxWidthClass = 'max-w-lg') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[260] bg-black/45 backdrop-blur-sm flex items-center justify-center p-md';
    overlay.innerHTML = `
      <div class="w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-lg transform transition-all scale-95 opacity-0" data-modal-card>
        <div class="flex items-start justify-between gap-md mb-md">
          <div>
            <p class="font-label-sm text-label-sm text-primary uppercase">${eyebrow}</p>
            <h3 class="font-headline-md text-headline-md text-on-surface">${title}</h3>
          </div>
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
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent('eden:content-updated'));
    }, 50);
    return overlay;
  }

  function selectField(name, label, options) {
    return `
      <label class="block">
        <span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span>
        <select name="${name}" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
          ${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}
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

  function modalActions(confirmLabel) {
    return `
      <div class="flex justify-end gap-sm pt-sm">
        <button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md hover:bg-surface-container-low">Cancel</button>
        <button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">${confirmLabel}</button>
      </div>
    `;
  }

  function detailGrid(rows) {
    return `
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        ${rows.map(([label, value]) => `
          <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
            <dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt>
            <dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd>
          </div>
        `).join('')}
      </dl>
    `;
  }

  function statusBadge(status = 'open') {
    const key = String(status || 'open').toLowerCase();
    const positive = ['paid', 'delivered', 'shipped', 'completed', 'in_stock', 'low'].includes(key);
    const warning = ['confirmed', 'processing', 'dispatched', 'sent', 'pending', 'in_transit', 'low_stock', 'medium'].includes(key);
    const cls = positive ? 'bg-primary/10 text-primary' : warning ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatStatus(status)}</span>`;
  }

  function getOrderItems(order) {
    if (Array.isArray(order.items) && order.items.length) {
      return order.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_kg: Number(item.quantity_kg || 0),
        unit_price: Number(item.unit_price || 0),
        line_total_ksh: Number(item.line_total_ksh || Number(item.quantity_kg || 0) * Number(item.unit_price || 0))
      }));
    }
    return [{
      product_id: order.product_id,
      product_name: order.product_name,
      quantity_kg: Number(order.quantity_kg || 0),
      unit_price: Number(order.unit_price || 0),
      line_total_ksh: Number(order.total_ksh || 0)
    }];
  }

  function getOrderShortages(order, products) {
    return getOrderItems(order)
      .map(item => {
        const product = products.find(productItem => productItem.id === item.product_id);
        const available = Number(product?.quantity_kg || 0);
        return { ...item, available, shortage: Math.max(0, Number(item.quantity_kg || 0) - available) };
      })
      .filter(item => item.shortage > 0);
  }

  function orderProductSummary(order) {
    const items = getOrderItems(order);
    if (items.length === 1) return items[0].product_name || order.product_name || 'Product';
    return `${items.length} products: ${items.slice(0, 2).map(item => item.product_name).join(', ')}${items.length > 2 ? '...' : ''}`;
  }

  function emptyRow(text) {
    return `<tr><td colspan="4" class="px-lg py-lg text-center text-on-surface-variant">${text}</td></tr>`;
  }

  function findSection(title) {
    return Array.from(document.querySelectorAll('main section')).find(section => section.innerText.includes(title));
  }

  function scrollToPanel(title) {
    findSection(title)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function money(value) {
    return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  }

  function formatStatus(value) {
    return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
  }

  function initials(value) {
    return String(value || 'ER').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
  }

  function readJson(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
      return fallback;
    }
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
})();
