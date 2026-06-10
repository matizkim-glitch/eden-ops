// js/routes/finance/page.js
// Finance controller: cash, receivables, payroll, procurement approvals, and cross-department spend.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['finance_overview.html'] = bindFinancePage;
  window.edenPageControllers['infrastructure_facility.html'] = window.edenPageControllers['infrastructure_facility.html'] || bindFinancePage;

  async function bindFinancePage() {
    if (!window.financeModule) return;
    await renderFinancePage();
  }

  async function renderFinancePage() {
    const [invoices, payments, stats, payroll, tasks, workflows] = await Promise.all([
      window.financeModule.getInvoices(),
      window.financeModule.getPayments(),
      window.financeModule.getFinanceStats(),
      window.hrModule?.getPayrollSummary ? window.hrModule.getPayrollSummary() : Promise.resolve(readPayrollFallback()),
      Promise.resolve(readJson('eden_tasks', [])),
      Promise.resolve(readJson('eden_restock_workflows', []))
    ]);
    const model = buildFinanceModel(invoices, payments, stats, payroll, tasks, workflows);
    renderFinanceKpis(model);
    renderRevenueChart(model);
    renderPendingPayments(model);
    renderPayroll(model);
    renderTransactions(model);
    renderFinanceActionCenter(model);
    bindFinanceControls(model);
  }

  function buildFinanceModel(invoices, payments, stats, payroll, tasks, workflows) {
    const receivables = invoices.filter(item => item.status !== 'paid');
    const procurementTasks = tasks.filter(task => ['Inventory', 'Procurement'].includes(task.department) || task.workflow_id);
    const payrollTotal = Number(payroll.totalPayroll || 0);
    const expenseEstimate = payrollTotal + procurementTasks.length * 48000 + workflows.length * 35000;
    const collected = payments.reduce((sum, item) => sum + Number(item.amount || item.amount_ksh || 0), 0);
    const projected = collected + receivables.reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.paid_amount || 0), 0);
    return {
      invoices,
      payments,
      stats,
      payroll,
      tasks,
      workflows,
      receivables,
      procurementTasks,
      payrollTotal,
      expenseEstimate,
      collected,
      projected,
      balance: 1482904 + collected - expenseEstimate
    };
  }

  function renderFinanceKpis(model) {
    const balance = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('CURRENT BALANCE'));
    const amount = balance?.querySelector('.font-headline-xl');
    if (amount) amount.innerText = money(model.balance);
    const cards = Array.from(document.querySelectorAll('main > section.grid.grid-cols-1.md\\:grid-cols-3 > div'));
    const values = [
      ['Monthly Revenue', money(model.collected), `${money(model.projected)} projected`, 'payments', 'revenue'],
      ['Operational Expenses', money(model.expenseEstimate), `${model.procurementTasks.length} procurement items`, 'request_quote', 'expenses'],
      ['Net Profit', money(model.collected - model.expenseEstimate), `${Math.round(((model.collected - model.expenseEstimate) / Math.max(model.collected, 1)) * 100)}% margin`, 'savings', 'profit']
    ];
    values.forEach(([label, value, hint, icon, key], index) => {
      const card = cards[index];
      if (!card) return;
      card.dataset.financeKpi = key;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.classList.add('cursor-pointer');
      card.innerHTML = `
        <div class="flex items-center gap-md mb-md">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><span class="material-symbols-outlined text-primary">${icon}</span></div>
          <div><h3 class="font-label-md text-label-md text-on-surface-variant">${label}</h3><p class="font-headline-md text-headline-md text-on-surface">${value}</p></div>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant">${hint}</p>
      `;
    });
  }

  function renderRevenueChart(model) {
    const chart = Array.from(document.querySelectorAll('section .bg-white')).find(el => el.innerText.includes('Revenue by Material'));
    if (!chart) return;
    const orderItems = readJson('eden_orders', []).flatMap(order => Array.isArray(order.items) ? order.items : [{ product_name: order.product_name, line_total_ksh: order.total_ksh }]);
    const buckets = summarizeRevenueBuckets(orderItems);
    const max = Math.max(...buckets.map(item => item.value), 1);
    chart.innerHTML = `
      <div class="flex justify-between items-center mb-lg">
        <h3 class="font-headline-sm text-headline-sm">Revenue Mix</h3>
        <button type="button" data-finance-report="revenue" class="text-primary font-label-md text-label-md hover:underline">Details</button>
      </div>
      <div class="flex items-end gap-md h-48 px-md">
        ${buckets.map(item => `
          <button type="button" data-finance-bucket="${item.name}" class="flex flex-col items-center flex-1 gap-xs h-full justify-end">
            <div class="chart-bar bg-primary w-full rounded-t-lg hover:opacity-80 transition-all" style="height:${Math.max(8, Math.round((item.value / max) * 100))}%;"></div>
            <span class="font-label-sm text-label-sm">${item.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="mt-lg grid grid-cols-2 gap-md">
        ${buckets.slice(0, 4).map(item => `<button type="button" data-finance-bucket="${item.name}" class="flex items-center gap-xs text-left"><div class="w-3 h-3 rounded-full bg-primary"></div><span class="font-label-md text-label-md">${item.name}: ${money(item.value)}</span></button>`).join('')}
      </div>
    `;
  }

  function renderPendingPayments(model) {
    const panel = Array.from(document.querySelectorAll('section .bg-white')).find(el => el.innerText.includes('Pending Payments'));
    if (!panel) return;
    panel.innerHTML = `
      <div class="flex items-center justify-between mb-lg">
        <h3 class="font-headline-sm text-headline-sm">Pending Payments</h3>
        <button type="button" data-finance-action="collections" class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Collect</button>
      </div>
      <div class="space-y-sm flex-1 overflow-y-auto pr-xs">
        ${model.receivables.map(invoice => `
          <button type="button" data-finance-invoice="${invoice.id}" class="w-full text-left flex items-center justify-between p-sm border border-outline-variant rounded-lg bg-surface-container-low hover:border-primary transition-all">
            <div class="flex items-center gap-md min-w-0">
              <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary">${initials(invoice.customer_name)}</div>
              <div class="min-w-0"><p class="font-label-md text-label-md truncate">${invoice.customer_name}</p><p class="text-on-surface-variant text-body-sm font-body-sm">${invoice.invoice_number || invoice.id} • ${formatDate(invoice.due_date)}</p></div>
            </div>
            <div class="text-right shrink-0"><p class="font-headline-sm text-headline-sm text-on-surface">${money(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0))}</p>${statusBadge(invoice.status)}</div>
          </button>
        `).join('') || emptyBlock('No pending payments.')}
      </div>
    `;
  }

  function renderPayroll(model) {
    const panel = Array.from(document.querySelectorAll('section .bg-white')).find(el => el.innerText.includes('Payroll Summary'));
    if (!panel) return;
    const departments = Object.entries(model.payroll.byDepartment || {}).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...departments.map(([, value]) => Number(value || 0)), 1);
    panel.innerHTML = `
      <h3 class="font-headline-sm text-headline-sm mb-lg">Payroll Summary</h3>
      <div class="space-y-md">
        ${departments.slice(0, 5).map(([dept, value]) => `
          <button type="button" data-finance-payroll="${dept}" class="w-full text-left">
            <div class="flex justify-between font-label-md text-label-md text-on-surface-variant mb-xs"><span>${dept}</span><span>${money(value)}</span></div>
            <div class="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden"><div class="bg-primary h-full" style="width:${Math.round((Number(value || 0) / max) * 100)}%"></div></div>
          </button>
        `).join('')}
        <div class="pt-md border-t border-outline-variant">
          <div class="flex justify-between items-center mb-lg"><span class="font-label-md text-label-md">Total Period Payout</span><span class="font-headline-sm text-headline-sm">${money(model.payrollTotal)}</span></div>
          <button type="button" data-finance-action="payroll" class="w-full bg-primary text-on-primary py-md rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors flex items-center justify-center gap-xs"><span class="material-symbols-outlined">account_balance</span>Process Payroll</button>
        </div>
      </div>
    `;
  }

  function renderTransactions(model) {
    const table = document.querySelector('section table');
    if (!table) return;
    const rows = [
      ...model.payments.map(pay => ({ id: pay.id, entity: invoiceName(pay.invoice_id, model.invoices), date: pay.payment_date, category: 'Customer Payment', status: 'completed', amount: Number(pay.amount || 0) })),
      ...model.procurementTasks.slice(0, 6).map(task => ({ id: task.id, entity: task.title, date: task.due_date || task.created_at, category: 'Procurement / Task', status: task.status, amount: -48000 })),
      { id: 'payroll-current', entity: 'Payroll Period', date: new Date().toISOString(), category: 'Payroll', status: 'pending', amount: -model.payrollTotal }
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    table.querySelector('tbody').innerHTML = rows.map(row => `
      <tr data-finance-transaction="${row.id}" class="hover:bg-surface-container-low transition-colors cursor-pointer">
        <td class="p-md font-label-md text-label-md">${row.entity}</td>
        <td class="p-md text-body-sm font-body-sm">${formatDate(row.date)}</td>
        <td class="p-md text-body-sm font-body-sm">${row.category}</td>
        <td class="p-md">${statusBadge(row.status)}</td>
        <td class="p-md text-right font-label-md text-label-md ${row.amount < 0 ? 'text-error' : 'text-primary'}">${row.amount < 0 ? '-' : '+'}${money(Math.abs(row.amount))}</td>
      </tr>
    `).join('');
  }

  function renderFinanceActionCenter(model) {
    let panel = document.querySelector('[data-finance-action-center]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.financeActionCenter = 'true';
      panel.className = 'mt-xl grid grid-cols-1 lg:grid-cols-12 gap-lg';
      document.querySelector('main')?.appendChild(panel);
    }
    panel.innerHTML = `
      <section class="lg:col-span-4 bg-white border border-outline-variant rounded-xl p-lg shadow-sm">
        <h3 class="font-headline-sm text-headline-sm mb-md">Approvals</h3>
        <div class="space-y-xs">
          ${model.procurementTasks.slice(0, 5).map(task => actionButton('approval', task.id, task.title, task.department || 'Inventory')).join('') || emptyBlock('No approvals.')}
        </div>
      </section>
      <section class="lg:col-span-4 bg-white border border-outline-variant rounded-xl p-lg shadow-sm">
        <h3 class="font-headline-sm text-headline-sm mb-md">Collections</h3>
        <div class="space-y-xs">
          ${model.receivables.slice(0, 5).map(invoice => actionButton('invoice', invoice.id, invoice.customer_name, money(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0)))).join('') || emptyBlock('No receivables.')}
        </div>
      </section>
      <section class="lg:col-span-4 bg-white border border-outline-variant rounded-xl p-lg shadow-sm">
        <h3 class="font-headline-sm text-headline-sm mb-md">Forecast</h3>
        ${detailGrid([
          ['Cash', money(model.balance)],
          ['Receivables', money(model.stats.receivables)],
          ['Payroll', money(model.payrollTotal)],
          ['Expense Pressure', money(model.expenseEstimate)]
        ])}
      </section>
    `;
  }

  function bindFinanceControls(model) {
    document.querySelectorAll('[data-finance-kpi]').forEach(card => bindOnce(card, () => showFinanceReport(card.dataset.financeKpi, model)));
    document.querySelectorAll('[data-finance-report]').forEach(button => bindOnce(button, () => showFinanceReport(button.dataset.financeReport, model)));
    document.querySelectorAll('[data-finance-bucket]').forEach(button => bindOnce(button, () => showRevenueBucket(button.dataset.financeBucket, model)));
    document.querySelectorAll('[data-finance-invoice]').forEach(button => bindOnce(button, () => showInvoiceDetail(model.invoices.find(item => item.id === button.dataset.financeInvoice))));
    document.querySelectorAll('[data-finance-payroll]').forEach(button => bindOnce(button, () => showPayrollDetail(button.dataset.financePayroll, model)));
    document.querySelectorAll('[data-finance-action="payroll"]').forEach(button => bindOnce(button, () => processPayroll(model)));
    document.querySelectorAll('[data-finance-action="collections"]').forEach(button => bindOnce(button, () => showFinanceReport('collections', model)));
    document.querySelectorAll('[data-finance-approval]').forEach(button => bindOnce(button, () => showApprovalDetail(model.tasks.find(item => item.id === button.dataset.financeApproval), model)));
    document.querySelectorAll('[data-finance-transaction]').forEach(row => bindOnce(row, () => showTransactionDetail(row.dataset.financeTransaction, model)));
    Array.from(document.querySelectorAll('button')).forEach(button => {
      if (button.dataset.financeStaticBound) return;
      const text = button.innerText.trim().toLowerCase();
      const icon = button.querySelector('.material-symbols-outlined')?.innerText.trim();
      if (text.includes('process payroll')) bindStatic(button, () => processPayroll(model));
      else if (icon === 'filter_list') bindStatic(button, () => showTransactionFilter(model));
      else if (icon === 'download') bindStatic(button, () => exportFinanceCsv(model));
    });
    bindBottomNav();
  }

  function actionButton(type, id, title, meta) {
    return `<button type="button" data-finance-${type}="${id}" class="w-full text-left p-xs rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary transition-all"><p class="font-label-md text-label-md truncate">${title}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${meta}</p></button>`;
  }

  function showInvoiceDetail(invoice) {
    if (!invoice) return;
    const due = Math.max(0, Number(invoice.amount || 0) - Number(invoice.paid_amount || 0));
    const overlay = createModal(invoice.invoice_number || invoice.id, `
      ${detailGrid([['Customer', invoice.customer_name], ['Amount Due', money(due)], ['Status', formatLabel(invoice.status)], ['Due', formatDate(invoice.due_date)]])}
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-record-payment class="px-md py-sm bg-primary text-on-primary rounded-full">Record Payment</button><button type="button" data-finance-task class="px-md py-sm border border-primary text-primary rounded-full">Collection Task</button></div>
    `);
    overlay.querySelector('[data-record-payment]')?.addEventListener('click', () => showPaymentModal(invoice, due, overlay));
    overlay.querySelector('[data-finance-task]')?.addEventListener('click', () => {
      createFinanceTask(`Collect ${invoice.customer_name}`, `${invoice.customer_name} has ${money(due)} outstanding on ${invoice.invoice_number || invoice.id}.`, 'Sales / CRM', invoice.customer_id);
      overlay.remove();
      toast('Collection task created.', 'success');
    });
  }

  function showPaymentModal(invoice, due, parent) {
    parent?.remove();
    const overlay = createModal('Record Payment', `
      <form data-payment-form class="space-y-md">
        ${numberField('amount', 'Amount', due)}
        ${selectField('method', 'Method', [['mpesa', 'M-Pesa'], ['bank', 'Bank'], ['cash', 'Cash']])}
        ${textField('reference_number', 'Reference', 'REF')}
        ${modalActions('Save Payment')}
      </form>
    `);
    overlay.querySelector('[data-payment-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.financeModule.recordPayment(invoice.id, Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? 'Payment recorded.' : 'Could not record payment.', saved ? 'success' : 'error');
      if (saved) await renderFinancePage();
    });
  }

  function showApprovalDetail(task = {}, model) {
    const overlay = createModal('Finance Approval', `
      ${detailGrid([['Request', task.title], ['Department', task.department], ['Priority', formatLabel(task.priority)], ['Status', formatLabel(task.status)]])}
      <p class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">${task.description || 'No notes.'}</p>
      <div class="flex justify-end gap-sm pt-md"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Close</button><button type="button" data-approve-spend class="px-md py-sm bg-primary text-on-primary rounded-full">Approve Spend</button></div>
    `);
    overlay.querySelector('[data-approve-spend]')?.addEventListener('click', async () => {
      updateTask(task.id, 'approved');
      overlay.remove();
      toast('Spend approved and task updated.', 'success');
      await renderFinancePage();
    });
  }

  function processPayroll(model) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-payroll-${Date.now()}`,
      title: 'Payroll processed',
      description: `${money(model.payrollTotal)} payroll period approved by Finance.`,
      department: 'HR',
      priority: 'medium',
      status: 'completed',
      source_module: 'finance_overview',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
    toast('Payroll processed and HR notified.', 'success');
  }

  function showFinanceReport(type, model) {
    createModal('Finance Analysis', `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-sm">
        ${detailCard('Revenue', money(model.collected))}
        ${detailCard('Receivables', money(model.stats.receivables))}
        ${detailCard('Expenses', money(model.expenseEstimate))}
        ${detailCard('Projected Cash', money(model.balance + model.stats.receivables))}
      </div>
      <div class="mt-md p-sm rounded-lg bg-surface-container-low border border-outline-variant">Mode: ${formatLabel(type)}. Projection includes sales invoices, payroll, procurement tasks, and recorded payments.</div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `, 'Finance Analytics', 'max-w-5xl');
  }

  function showRevenueBucket(name, model) {
    createModal(`${name} Revenue`, `
      ${detailGrid([['Bucket', name], ['Orders', readJson('eden_orders', []).filter(order => String(order.product_name || '').toLowerCase().includes(name.toLowerCase())).length], ['Forecast', money(model.projected)], ['Action', 'Review Sales pipeline']])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showPayrollDetail(dept, model) {
    createModal(`${dept} Payroll`, `
      ${detailGrid([['Department', dept], ['Period Cost', money(model.payroll.byDepartment?.[dept] || 0)], ['Company Payroll', money(model.payrollTotal)], ['Action', 'Coordinate with HR']])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showTransactionDetail(id, model) {
    const transaction = [...model.payments, ...model.tasks].find(item => item.id === id) || { id, title: id };
    createModal('Transaction Detail', `
      ${detailGrid([['Reference', transaction.id], ['Entity', transaction.customer_name || transaction.title || transaction.invoice_id], ['Status', formatLabel(transaction.status || 'completed')], ['Source', formatLabel(transaction.source_module || 'finance')]])}
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function showTransactionFilter(model) {
    createModal('Filter Transactions', `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
        ${['Payments', 'Procurement', 'Payroll'].map(item => `<button type="button" class="p-sm rounded-lg border border-outline-variant bg-surface-container-low text-left">${item}</button>`).join('')}
      </div>
      <div class="flex justify-end pt-md"><button type="button" data-modal-close class="px-md py-sm bg-primary text-on-primary rounded-full">Done</button></div>
    `);
  }

  function exportFinanceCsv(model) {
    const rows = [
      ['Type', 'Reference', 'Entity', 'Status', 'Amount'],
      ...model.invoices.map(item => ['Invoice', item.invoice_number || item.id, item.customer_name, item.status, item.amount]),
      ...model.payments.map(item => ['Payment', item.id, invoiceName(item.invoice_id, model.invoices), 'completed', item.amount]),
      ...model.tasks.map(item => ['Task', item.id, item.title, item.status, ''])
    ];
    downloadTextFile(`eden-finance-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Finance export downloaded.', 'success');
  }

  function bindBottomNav() {
    const map = { Collect: 'waste_collection.html', Stock: 'supplier_inventory.html', Process: 'production_monitoring.html', Sales: 'sales_distribution.html', More: 'operations_overview.html' };
    document.querySelectorAll('nav.fixed.bottom-0 div').forEach(item => {
      if (item.dataset.financeNavBound) return;
      const match = Object.keys(map).find(label => item.innerText.includes(label));
      if (!match) return;
      item.dataset.financeNavBound = 'true';
      item.setAttribute('role', 'button');
      item.addEventListener('click', () => { window.location.href = pageHref(map[match]); });
    });
  }

  function summarizeRevenueBuckets(items) {
    const defaults = ['PET', 'HDPE', 'LDPE', 'PP', 'EKO'];
    return defaults.map(name => ({
      name,
      value: items.filter(item => String(item.product_name || '').toLowerCase().includes(name.toLowerCase())).reduce((sum, item) => sum + Number(item.line_total_ksh || item.total_ksh || 0), 0) || ({ PET: 182000, HDPE: 128000, LDPE: 82000, PP: 64000, EKO: 42000 }[name] || 0)
    }));
  }

  function createFinanceTask(title, description, department, customerId) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({ id: `task-fin-${Date.now()}`, title, description, department, priority: 'high', status: 'open', source_module: 'finance_overview', related_customer_id: customerId, created_at: new Date().toISOString() });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function updateTask(id, status) {
    localStorage.setItem('eden_tasks', JSON.stringify(readJson('eden_tasks', []).map(task => task.id === id ? { ...task, status, finance_approved_at: new Date().toISOString() } : task)));
  }

  function readPayrollFallback() {
    const employees = readJson('eden_employees', []);
    const active = employees.filter(item => item.status !== 'inactive');
    return { totalPayroll: active.reduce((sum, item) => sum + Number(item.salary_ksh || 0), 0), byDepartment: active.reduce((acc, item) => ({ ...acc, [item.department || 'General']: (acc[item.department || 'General'] || 0) + Number(item.salary_ksh || 0) }), {}) };
  }

  function invoiceName(id, invoices) {
    const invoice = invoices.find(item => item.id === id);
    return invoice?.customer_name || invoice?.invoice_number || id;
  }

  function bindOnce(element, handler) {
    if (!element || element.dataset.financeBound) return;
    element.dataset.financeBound = 'true';
    element.addEventListener('click', handler);
  }

  function bindStatic(element, handler) {
    element.dataset.financeStaticBound = 'true';
    element.addEventListener('click', handler);
  }

  function createModal(title, bodyHtml, eyebrow = 'Finance Control', maxWidthClass = 'max-w-3xl') {
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

  function detailGrid(rows) { return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => detailCard(label, value)).join('')}</dl>`; }
  function detailCard(label, value) { return `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`; }
  function modalActions(label) { return `<div class="flex justify-end gap-sm pt-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full">Cancel</button><button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full">${label}</button></div>`; }
  function numberField(name, label, value) { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required min="0" step="0.1" type="number" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>`; }
  function textField(name, label, placeholder) { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="${placeholder}"></label>`; }
  function selectField(name, label, options) { return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`; }
  function statusBadge(status = 'open') { const key = String(status).toLowerCase(); const cls = ['paid', 'completed', 'approved'].includes(key) ? 'bg-primary/10 text-primary' : ['sent', 'pending', 'partial', 'open', 'in_progress'].includes(key) ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'; return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatLabel(status)}</span>`; }
  function emptyBlock(text) { return `<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">${text}</div>`; }
  function formatLabel(value) { return String(value || 'open').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function formatDate(value) { if (!value) return 'Not set'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }); }
  function money(value) { return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`; }
  function initials(value) { return String(value || 'ER').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  function readJson(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (err) { return fallback; } }
  function pageHref(page) { return ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? `${page}?fresh=${Date.now()}` : page; }
  function toast(message, type = 'info') { window.edenUtils?.showToast(message, type); }
  function downloadTextFile(filename, content, mimeType = 'text/plain') { const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
})();
