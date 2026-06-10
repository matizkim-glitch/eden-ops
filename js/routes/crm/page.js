// js/routes/crm/page.js
// Customer CRM controller: customer accounts, collections, segmentation, and sales handoffs.

(function () {
  window.edenPageControllers = window.edenPageControllers || {};
  window.edenPageControllers['customer_crm.html'] = bindCrmPage;

  async function bindCrmPage() {
    if (!window.salesModule) return;
    bindHeaderActions();
    await renderCrmPage();
  }

  async function renderCrmPage(search = '') {
    const [customers, orders, invoices] = await Promise.all([
      window.salesModule.getCustomers(),
      window.salesModule.getOrders(),
      window.salesModule.getInvoices()
    ]);
    const accountRows = buildAccounts(customers, orders, invoices);
    const filtered = search ? accountRows.filter(account => JSON.stringify(account).toLowerCase().includes(search.toLowerCase())) : accountRows;

    renderCrmKpis(accountRows, invoices);
    renderSegments(accountRows);
    renderCustomerTable(filtered, accountRows);
    renderNetworkMap(accountRows);
    renderCollectionTasks(accountRows, invoices);
    renderCrmIntelligence(accountRows, orders, invoices);
    bindStaticControls(accountRows, orders, invoices);
  }

  function bindHeaderActions() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('[data-crm-context-actions]')) return;
    const rightCluster = Array.from(header.querySelectorAll('.flex.items-center')).pop();
    if (!rightCluster) return;
    const actions = document.createElement('div');
    actions.dataset.crmContextActions = 'true';
    actions.className = 'hidden lg:flex items-center gap-sm';
    actions.innerHTML = `
      <button type="button" data-crm-action="add" class="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm hover:opacity-90">
        <span class="material-symbols-outlined text-[18px]">person_add</span>Add Customer
      </button>
      <button type="button" data-crm-action="tasks" class="flex items-center gap-xs px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">assignment</span>Collections
      </button>
      <button type="button" data-crm-action="segments" class="flex items-center gap-xs px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">donut_large</span>Segments
      </button>
      <button type="button" data-crm-action="export" class="flex items-center gap-xs px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-low">
        <span class="material-symbols-outlined text-[18px]">download</span>Export
      </button>
    `;
    rightCluster.insertBefore(actions, rightCluster.firstChild);
    actions.querySelector('[data-crm-action="add"]').addEventListener('click', showAddCustomerModal);
    actions.querySelector('[data-crm-action="tasks"]').addEventListener('click', showCollectionsDashboard);
    actions.querySelector('[data-crm-action="segments"]').addEventListener('click', showSegmentAnalysis);
    actions.querySelector('[data-crm-action="export"]').addEventListener('click', exportCrmCsv);
  }

  function bindStaticControls(accountRows, orders, invoices) {
    document.querySelectorAll('input[placeholder*="Search"]').forEach(input => {
      if (input.dataset.crmSearchBound === 'true') return;
      input.dataset.crmSearchBound = 'true';
      input.addEventListener('input', () => renderCrmPage(input.value.trim()));
    });
    Array.from(document.querySelectorAll('button')).forEach(button => {
      if (button.dataset.crmBound) return;
      const text = button.innerText.trim().toLowerCase();
      if (text.includes('add customer') || text.includes('person_add')) {
        button.dataset.crmBound = 'add';
        button.addEventListener('click', showAddCustomerModal);
      } else if (text.includes('export data')) {
        button.dataset.crmBound = 'export';
        button.addEventListener('click', exportCrmCsv);
      } else if (text.includes('view segment analysis')) {
        button.dataset.crmBound = 'segments';
        button.addEventListener('click', showSegmentAnalysis);
      } else if (text.includes('debt recovery dashboard')) {
        button.dataset.crmBound = 'debt';
        button.addEventListener('click', showCollectionsDashboard);
      }
    });
  }

  function renderCrmKpis(accounts, invoices) {
    const cards = Array.from(document.querySelectorAll('section')).find(section => section.innerText.includes('Revenue & AR Overview'))?.querySelectorAll('.grid > div') || [];
    const receivables = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const overdue = accounts.filter(account => account.risk !== 'healthy').reduce((sum, account) => sum + account.outstanding, 0);
    const collected = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), 0);
    const collectionRate = Math.round((collected / Math.max(collected + receivables, 1)) * 100);
    [
      ['Total Receivables', money(receivables), `${accounts.filter(account => account.outstanding > 0).length} open accounts`, 'payments'],
      ['At-Risk Balance', money(overdue), `${accounts.filter(account => account.risk !== 'healthy').length} accounts need action`, 'warning'],
      ['Collections Rate', `${collectionRate}%`, `${money(collected)} collected`, 'trending_up']
    ].forEach(([label, value, hint, icon], index) => {
      const card = cards[index];
      if (!card) return;
      card.dataset.crmKpi = label;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML = `
        <div class="flex items-center justify-between gap-md">
          <p class="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">${label}</p>
          <span class="material-symbols-outlined text-primary">${icon}</span>
        </div>
        <p class="font-headline-lg text-headline-lg ${label.includes('Risk') ? 'text-error' : 'text-primary'} mt-base">${value}</p>
        <p class="mt-sm text-body-sm text-body-sm text-on-surface-variant">${hint}</p>
      `;
      if (card.dataset.crmKpiBound !== 'true') {
        card.dataset.crmKpiBound = 'true';
        card.addEventListener('click', () => showCollectionsDashboard());
      }
    });
  }

  function renderSegments(accounts) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Account Categories'));
    const list = section?.querySelector('.space-y-md');
    if (!list) return;
    const segments = summarizeSegments(accounts);
    list.innerHTML = segments.map((segment, index) => `
      <button type="button" data-crm-segment="${segment.name}" class="w-full flex items-center justify-between p-sm rounded-lg border border-outline-variant bg-surface-container-low text-left">
        <div class="flex items-center gap-sm">
          <div class="w-3 h-3 rounded-full ${['bg-primary', 'bg-secondary', 'bg-tertiary-container', 'bg-error'][index % 4]}"></div>
          <span class="font-label-md text-label-md">${segment.name}</span>
        </div>
        <span class="font-body-md text-body-md">${segment.count} accounts</span>
      </button>
    `).join('');
    list.querySelectorAll('[data-crm-segment]').forEach(button => {
      button.addEventListener('click', () => showSegmentAnalysis(button.dataset.crmSegment));
    });
  }

  function renderCustomerTable(accounts, allAccounts) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Customer Database'));
    const tbody = section?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = accounts.map(account => `
      <tr data-crm-customer="${account.id}" class="hover:bg-surface-container-low transition-colors">
        <td class="px-lg py-4">
          <div class="flex items-center gap-md">
            <div class="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold">${initials(account.company_name)}</div>
            <div>
              <p class="font-headline-sm text-headline-sm text-on-surface">${account.company_name}</p>
              <p class="text-body-sm text-body-sm text-on-surface-variant">${account.id.toUpperCase()} • ${account.contact_name}</p>
            </div>
          </div>
        </td>
        <td class="px-lg py-4"><span class="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-label-sm font-label-sm">${formatStatus(account.category)}</span></td>
        <td class="px-lg py-4 font-body-md text-body-md">${account.region}</td>
        <td class="px-lg py-4">${riskBadge(account.risk)}</td>
        <td class="px-lg py-4 font-headline-sm text-headline-sm ${account.outstanding ? 'text-error' : 'text-primary'}">${money(account.outstanding)}</td>
        <td class="px-lg py-4 text-body-md text-body-md">${formatDate(account.lastActivity)}</td>
        <td class="px-lg py-4 text-right">
          <button type="button" data-crm-menu="${account.id}" class="material-symbols-outlined text-on-surface-variant hover:text-primary p-2 rounded-full transition-colors">more_vert</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="7" class="px-lg py-lg text-center text-on-surface-variant">No matching customers.</td></tr>`;
    const footer = section.querySelector('.p-lg.border-t span');
    if (footer) footer.innerText = `Showing ${accounts.length} of ${allAccounts.length} accounts`;
    tbody.querySelectorAll('[data-crm-customer]').forEach(row => {
      row.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        const account = allAccounts.find(item => item.id === row.dataset.crmCustomer);
        if (account) showCustomerDetail(account);
      });
    });
    tbody.querySelectorAll('[data-crm-menu]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const account = allAccounts.find(item => item.id === button.dataset.crmMenu);
        if (account) showCustomerActions(account);
      });
    });
  }

  function renderNetworkMap(accounts) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Distributor Network Coverage'));
    const map = section?.querySelector('.relative.h-64');
    if (!map) return;
    map.innerHTML = `
      <iframe title="CRM customer network map" class="w-full h-full border-0" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=36.70%2C-1.36%2C36.94%2C-1.18&layer=mapnik&marker=-1.286389%2C36.817223"></iframe>
      <div class="absolute inset-0 pointer-events-none">
        ${accounts.slice(0, 5).map((account, index) => `
          <button type="button" data-map-account="${account.id}" class="pointer-events-auto absolute w-4 h-4 rounded-full ${account.risk === 'healthy' ? 'bg-primary' : 'bg-error'} shadow-lg ring-4 ring-white/70 animate-pulse" style="left:${18 + index * 15}%; top:${32 + (index % 3) * 17}%;" title="${account.company_name}"></button>
        `).join('')}
      </div>
      <div class="absolute bottom-md left-md right-md bg-white/95 backdrop-blur p-md rounded-xl shadow-xl border border-primary/20">
        <p class="font-headline-sm text-headline-sm text-primary">Customer Coverage</p>
        <p class="text-body-sm text-body-sm text-on-surface-variant">${accounts.length} accounts • ${accounts.filter(account => account.risk !== 'healthy').length} collection risks</p>
      </div>
    `;
    map.querySelectorAll('[data-map-account]').forEach(pin => {
      pin.addEventListener('click', () => {
        const account = accounts.find(item => item.id === pin.dataset.mapAccount);
        if (account) showCustomerDetail(account);
      });
    });
  }

  function renderCollectionTasks(accounts, invoices) {
    const section = Array.from(document.querySelectorAll('section')).find(el => el.innerText.includes('Recent Collection Tasks'));
    const list = section?.querySelector('.space-y-md');
    if (!list) return;
    const tasks = accounts
      .filter(account => account.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 4);
    list.innerHTML = tasks.map(account => `
      <button type="button" data-crm-task="${account.id}" class="w-full text-left flex items-start gap-md p-md hover:bg-surface transition-colors rounded-lg border border-outline-variant bg-surface-container-low">
        <div class="mt-1 w-10 h-10 rounded-full ${account.risk === 'critical' ? 'bg-error-container' : 'bg-secondary-container'} flex items-center justify-center">
          <span class="material-symbols-outlined ${account.risk === 'critical' ? 'text-error' : 'text-on-secondary-container'}">${account.risk === 'critical' ? 'notification_important' : 'schedule'}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-label-md text-label-md ${account.risk === 'critical' ? 'text-error' : 'text-secondary'} uppercase">${account.risk === 'critical' ? 'Urgent Call Required' : 'Payment Follow-Up'}</p>
          <p class="font-headline-sm text-headline-sm text-on-surface truncate">${account.company_name}</p>
          <p class="text-body-sm text-body-sm text-on-surface-variant">Outstanding: ${money(account.outstanding)}</p>
        </div>
        <span class="text-primary material-symbols-outlined">call</span>
      </button>
    `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No open collection tasks.</div>';
    list.querySelectorAll('[data-crm-task]').forEach(button => {
      button.addEventListener('click', () => {
        const account = accounts.find(item => item.id === button.dataset.crmTask);
        if (account) showContactModal(account, 'call');
      });
    });
  }

  function renderCrmIntelligence(accounts, orders, invoices) {
    let panel = document.querySelector('[data-crm-intelligence]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.crmIntelligence = 'true';
      panel.className = 'col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-lg';
      document.querySelector('.bento-grid')?.appendChild(panel);
    }
    const highValue = accounts.sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 5);
    const risk = accounts.filter(account => account.risk !== 'healthy');
    panel.innerHTML = `
      <section class="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <div class="flex items-center justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Account Intelligence</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Sales value, receivables risk, and relationship priority.</p>
          </div>
          <button type="button" data-crm-intel-open class="px-sm py-xs border border-outline rounded-full font-label-sm text-label-sm">Open</button>
        </div>
        <div class="space-y-sm">
          ${highValue.map(account => `
            <button type="button" data-crm-customer-card="${account.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between gap-md">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate">${account.company_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${formatStatus(account.category)} • ${account.orderCount} orders</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-label-md text-label-md text-primary">${money(account.totalOrders)}</p>
                ${riskBadge(account.risk)}
              </div>
            </button>
          `).join('')}
        </div>
      </section>
      <section class="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Relationship Actions</h3>
        <div class="mt-md space-y-sm">
          <button type="button" data-crm-action-card="collections" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">
            <p class="font-label-md text-label-md text-on-surface">${risk.length} at-risk accounts</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Create Finance follow-ups and contact logs.</p>
          </button>
          <button type="button" data-crm-action-card="sales" class="w-full text-left p-sm rounded-lg border border-outline-variant bg-surface-container-low">
            <p class="font-label-md text-label-md text-on-surface">${accounts.filter(account => account.risk === 'healthy').length} growth-ready accounts</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Open upsell and reorder opportunities.</p>
          </button>
        </div>
      </section>
    `;
    panel.querySelector('[data-crm-intel-open]')?.addEventListener('click', showCrmIntelligenceModal);
    panel.querySelector('[data-crm-action-card="collections"]')?.addEventListener('click', showCollectionsDashboard);
    panel.querySelector('[data-crm-action-card="sales"]')?.addEventListener('click', showOpportunityWorkflow);
    panel.querySelectorAll('[data-crm-customer-card]').forEach(button => {
      button.addEventListener('click', () => {
        const account = accounts.find(item => item.id === button.dataset.crmCustomerCard);
        if (account) showCustomerDetail(account);
      });
    });
  }

  function buildAccounts(customers, orders, invoices) {
    return customers.map((customer, index) => {
      const customerOrders = orders.filter(order => order.customer_id === customer.id);
      const customerInvoices = invoices.filter(invoice => invoice.customer_id === customer.id);
      const outstanding = customerInvoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.total_ksh || invoice.amount_ksh || 0), Number(customer.outstanding_ksh || 0));
      const totalOrders = customerOrders.reduce((sum, order) => sum + Number(order.total_ksh || 0), 0);
      const risk = customer.status === 'on_hold' || outstanding > Number(customer.credit_limit_ksh || 0) * 0.75 ? 'critical' : outstanding > 0 ? 'overdue' : 'healthy';
      return {
        ...customer,
        region: ['Nairobi Central', 'Industrial Area', 'Westlands', 'Mombasa Route', 'Eastern Region'][index % 5],
        outstanding,
        totalOrders,
        orderCount: customerOrders.length,
        invoiceCount: customerInvoices.length,
        risk,
        lastActivity: customerOrders[0]?.order_date || customerInvoices[0]?.issued_date || new Date().toISOString().slice(0, 10)
      };
    });
  }

  function showCustomerDetail(account) {
    createModal(account.company_name, `
      ${detailGrid([
        ['Contact', account.contact_name],
        ['Phone', account.contact_phone],
        ['Email', account.email],
        ['Segment', formatStatus(account.category)],
        ['Region', account.region],
        ['Credit Limit', money(account.credit_limit_ksh)],
        ['Outstanding', money(account.outstanding)],
        ['Order Value', money(account.totalOrders)]
      ])}
      <div class="mt-md grid grid-cols-1 sm:grid-cols-3 gap-sm">
        <button type="button" data-contact-call class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">Log Call</button>
        <button type="button" data-contact-mail class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Send Email</button>
        <button type="button" data-create-task class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Finance Task</button>
      </div>
    `, 'Customer Account', 'max-w-2xl');
    const overlay = document.querySelector('[data-modal-card]')?.closest('.fixed');
    overlay?.querySelector('[data-contact-call]')?.addEventListener('click', () => {
      overlay.remove();
      showContactModal(account, 'call');
    });
    overlay?.querySelector('[data-contact-mail]')?.addEventListener('click', () => {
      overlay.remove();
      showContactModal(account, 'email');
    });
    overlay?.querySelector('[data-create-task]')?.addEventListener('click', () => {
      createFinanceTask(account);
      toast(`Finance follow-up queued for ${account.company_name}.`, 'success');
    });
  }

  function showCustomerActions(account) {
    createModal('Customer Actions', `
      <div class="space-y-sm">
        ${[
          ['profile', 'Open Profile', 'View credit, orders, and relationship notes'],
          ['call', 'Log Call', 'Record a customer conversation'],
          ['email', 'Send Email', 'Prepare a payment or reorder follow-up'],
          ['task', 'Create Finance Task', 'Queue collection follow-up for Finance']
        ].map(([key, title, body]) => `
          <button type="button" data-crm-menu-action="${key}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant">
            <p class="font-label-md text-label-md text-on-surface">${title}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${body}</p>
          </button>
        `).join('')}
      </div>
    `, account.company_name);
    const overlay = document.querySelector('[data-modal-card]')?.closest('.fixed');
    overlay?.querySelectorAll('[data-crm-menu-action]').forEach(button => {
      button.addEventListener('click', () => {
        overlay.remove();
        if (button.dataset.crmMenuAction === 'profile') showCustomerDetail(account);
        if (button.dataset.crmMenuAction === 'call') showContactModal(account, 'call');
        if (button.dataset.crmMenuAction === 'email') showContactModal(account, 'email');
        if (button.dataset.crmMenuAction === 'task') {
          createFinanceTask(account);
          toast(`Finance follow-up queued for ${account.company_name}.`, 'success');
        }
      });
    });
  }

  function showContactModal(account, mode) {
    const overlay = createModal(mode === 'email' ? 'Send Customer Email' : 'Log Customer Call', `
      <form data-crm-contact-form class="space-y-md">
        ${detailGrid([['Customer', account.company_name], ['Contact', account.contact_name], ['Phone', account.contact_phone], ['Email', account.email]])}
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Outcome</span>
          <select name="outcome" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">
            <option value="payment_promised">Payment promised</option>
            <option value="reorder_interest">Reorder interest</option>
            <option value="needs_visit">Needs site visit</option>
            <option value="no_response">No response</option>
          </select>
        </label>
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Notes</span>
          <textarea name="notes" rows="4" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Record next steps, promise date, contact sentiment, or reorder opportunity."></textarea>
        </label>
        ${modalActions('Save Interaction')}
      </form>
    `, 'Relationship Log', 'max-w-2xl');
    overlay.querySelector('[data-crm-contact-form]').addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const logs = readJson('eden_crm_logs', []);
      logs.unshift({ id: `crm-log-${Date.now()}`, customer_id: account.id, customer_name: account.company_name, mode, ...data, created_at: new Date().toISOString() });
      localStorage.setItem('eden_crm_logs', JSON.stringify(logs));
      overlay.remove();
      toast('Customer interaction saved.', 'success');
    });
  }

  async function showAddCustomerModal() {
    const overlay = createModal('Add Customer', `
      <form data-add-customer-form class="space-y-md">
        ${textField('company_name', 'Company name', 'Customer Ltd')}
        ${textField('contact_name', 'Contact person', 'Jane Doe')}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
          ${textField('contact_phone', 'Phone', '+254...', 'tel')}
          ${textField('email', 'Email', 'name@company.co.ke', 'email')}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">
          ${selectField('category', 'Category', [['manufacturer', 'Manufacturer'], ['distributor', 'Distributor'], ['retailer', 'Retailer'], ['municipal', 'Municipal Partner']])}
          ${numberField('credit_limit_ksh', 'Credit limit (KES)', 200000)}
        </div>
        ${modalActions('Save Customer')}
      </form>
    `, 'CRM Control');
    overlay.querySelector('[data-add-customer-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const saved = await window.salesModule.addCustomer(Object.fromEntries(new FormData(event.currentTarget).entries()));
      overlay.remove();
      toast(saved ? `${saved.company_name} added.` : 'Could not add customer.', saved ? 'success' : 'error');
      await renderCrmPage();
    });
  }

  async function showSegmentAnalysis(segmentName = '') {
    const accounts = buildAccounts(await window.salesModule.getCustomers(), await window.salesModule.getOrders(), await window.salesModule.getInvoices());
    const segments = summarizeSegments(accounts);
    createModal('Segment Analysis', `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
        ${segments.map(segment => `
          <div class="p-md rounded-xl border border-outline-variant bg-surface-container-low">
            <p class="font-headline-sm text-headline-sm text-on-surface">${segment.name}</p>
            <p class="font-headline-md text-headline-md text-primary">${segment.count} accounts</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${money(segment.value)} order value • ${money(segment.outstanding)} outstanding</p>
            <div class="mt-sm h-2 rounded-full bg-surface-container-high overflow-hidden"><div class="h-full bg-primary" style="width:${Math.min(100, segment.count * 18)}%"></div></div>
          </div>
        `).join('')}
      </div>
    `, segmentName || 'CRM Intelligence', 'max-w-4xl');
  }

  async function showCollectionsDashboard() {
    const accounts = buildAccounts(await window.salesModule.getCustomers(), await window.salesModule.getOrders(), await window.salesModule.getInvoices());
    const risky = accounts.filter(account => account.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    createModal('Collections Dashboard', `
      <div data-sort-list class="space-y-sm">
        ${risky.map(account => `
          <button type="button" data-collection-account="${account.id}" data-sort-name="${account.company_name}" data-sort-value="${account.outstanding}" data-sort-status="${account.risk}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
            <div><p class="font-label-md text-label-md text-on-surface">${account.company_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${account.contact_name} • ${account.contact_phone}</p></div>
            <div class="text-right"><p class="font-label-md text-label-md text-error">${money(account.outstanding)}</p>${riskBadge(account.risk)}</div>
          </button>
        `).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No accounts need collection action.</div>'}
      </div>
    `, 'Finance Handoff', 'max-w-4xl');
    const overlay = document.querySelector('[data-modal-card]')?.closest('.fixed');
    overlay?.querySelectorAll('[data-collection-account]').forEach(button => {
      button.addEventListener('click', () => {
        const account = risky.find(item => item.id === button.dataset.collectionAccount);
        overlay.remove();
        if (account) showContactModal(account, 'call');
      });
    });
  }

  async function showCrmIntelligenceModal() {
    const accounts = buildAccounts(await window.salesModule.getCustomers(), await window.salesModule.getOrders(), await window.salesModule.getInvoices());
    const total = accounts.reduce((sum, account) => sum + account.totalOrders, 0);
    const max = Math.max(...accounts.map(account => account.totalOrders), 1);
    createModal('CRM Intelligence', `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <section class="lg:col-span-7 p-md rounded-xl bg-surface-container-low border border-outline-variant">
          <p class="font-headline-sm text-headline-sm text-on-surface mb-md">Account Value Distribution</p>
          <div class="space-y-sm">
            ${accounts.sort((a, b) => b.totalOrders - a.totalOrders).map(account => `
              <div>
                <div class="flex items-center justify-between gap-md mb-xs"><span class="font-label-md text-label-md">${account.company_name}</span><span class="font-label-sm text-label-sm">${money(account.totalOrders)}</span></div>
                <div class="h-3 rounded-full bg-surface-container-high overflow-hidden"><div class="h-full rounded-full bg-primary" style="width:${Math.max(4, Math.round((account.totalOrders / max) * 100))}%"></div></div>
              </div>
            `).join('')}
          </div>
        </section>
        <section class="lg:col-span-5 p-md rounded-xl bg-surface-container-low border border-outline-variant">
          <p class="font-headline-sm text-headline-sm text-on-surface">Predicted Relationship Focus</p>
          <div class="mt-md space-y-sm">
            ${accounts.slice(0, 4).map(account => `
              <div class="p-sm rounded-lg bg-surface-container-lowest border border-outline-variant">
                <p class="font-label-md text-label-md text-on-surface">${account.company_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${account.risk === 'healthy' ? 'Upsell candidate' : 'Collection priority'} • ${Math.round((account.totalOrders / Math.max(total, 1)) * 100)}% value share</p>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `, 'Relationship Analytics', 'max-w-5xl');
  }

  async function showOpportunityModal() {
    const accounts = buildAccounts(await window.salesModule.getCustomers(), await window.salesModule.getOrders(), await window.salesModule.getInvoices()).filter(account => account.risk === 'healthy');
    createModal('Sales Opportunities', `
      <div class="space-y-sm">
        ${accounts.map(account => `
          <button type="button" data-opportunity-account="${account.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
            <div><p class="font-label-md text-label-md text-on-surface">${account.company_name}</p><p class="font-body-sm text-body-sm text-on-surface-variant">Healthy credit • ${formatStatus(account.category)}</p></div>
            <span class="material-symbols-outlined text-primary">trending_up</span>
          </button>
        `).join('')}
      </div>
    `, 'Sales Handoff', 'max-w-3xl');
  }

  async function showOpportunityWorkflow() {
    const [customers, orders, invoices, products] = await Promise.all([
      window.salesModule.getCustomers(),
      window.salesModule.getOrders(),
      window.salesModule.getInvoices(),
      getProducts()
    ]);
    const accounts = buildAccounts(customers, orders, invoices).filter(account => account.risk === 'healthy');
    const stocked = products.filter(product => Number(product.quantity_kg || 0) > 0).length;
    const overlay = createModal('Sales Opportunities', `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-sm mb-md">
        <div class="p-sm rounded-lg bg-primary/10 border border-primary/20">
          <p class="font-label-sm text-label-sm text-primary uppercase">Healthy accounts</p>
          <p class="font-headline-sm text-headline-sm text-on-surface">${accounts.length}</p>
        </div>
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Sellable products</p>
          <p class="font-headline-sm text-headline-sm text-on-surface">${stocked}/${products.length}</p>
        </div>
        <div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant">
          <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">Rule</p>
          <p class="font-body-sm text-body-sm text-on-surface">Only fully stocked opportunities become sales orders.</p>
        </div>
      </div>
      <div class="space-y-sm">
        ${accounts.map(account => {
          const recommendation = recommendProduct(account, products);
          return `
            <button type="button" data-opportunity-account="${account.id}" class="w-full text-left p-sm rounded-lg bg-surface-container-low border border-outline-variant flex justify-between gap-md">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-surface truncate">${account.company_name}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Healthy credit - ${formatStatus(account.category)} - Suggested: ${recommendation?.name || 'No product in catalog'}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-label-md text-label-md ${Number(recommendation?.quantity_kg || 0) > 0 ? 'text-primary' : 'text-error'}">${Number(recommendation?.quantity_kg || 0).toLocaleString('en-KE')} kg</p>
                <span class="material-symbols-outlined text-primary">trending_up</span>
              </div>
            </button>
          `;
        }).join('') || '<div class="p-md rounded-lg border border-dashed border-outline text-on-surface-variant">No healthy accounts are ready for upsell today.</div>'}
      </div>
    `, 'Sales Handoff', 'max-w-4xl');

    overlay.querySelectorAll('[data-opportunity-account]').forEach(button => {
      button.addEventListener('click', () => {
        const account = accounts.find(item => item.id === button.dataset.opportunityAccount);
        if (account) showOpportunityDetail(account, products);
      });
    });
  }

  function showOpportunityDetail(account, products) {
    const recommendation = recommendProduct(account, products);
    const overlay = createModal(`Opportunity: ${account.company_name}`, `
      <form data-crm-opportunity-form class="space-y-md">
        ${detailGrid([
          ['Credit status', account.risk === 'healthy' ? 'Cleared for sales conversation' : formatStatus(account.risk)],
          ['Outstanding balance', money(account.outstanding)],
          ['Historic value', money(account.totalOrders)],
          ['Contact', `${account.contact_name || 'Not captured'} - ${account.contact_phone || 'No phone'}`]
        ])}
        ${selectField('product_id', 'Product', products.map(product => [product.id, `${product.name} - ${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg available`]))}
        ${numberField('quantity_kg', 'Opportunity quantity kg', Math.min(100, Math.max(10, Number(recommendation?.quantity_kg || 0) ? 100 : 50)))}
        <label class="block">
          <span class="font-label-sm text-label-sm text-on-surface-variant">Sales note</span>
          <textarea name="notes" rows="3" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="Customer need, quote context, delivery preference, or follow-up note"></textarea>
        </label>
        <div data-opportunity-stock-note class="p-sm rounded-lg bg-surface-container-low border border-outline-variant text-body-sm text-on-surface-variant"></div>
        ${modalActions('Process Opportunity')}
      </form>
    `, 'CRM To Sales', 'max-w-3xl');

    const form = overlay.querySelector('[data-crm-opportunity-form]');
    const productSelect = form.querySelector('[name="product_id"]');
    const qtyInput = form.querySelector('[name="quantity_kg"]');
    const note = form.querySelector('[data-opportunity-stock-note]');
    const updateNote = () => {
      const product = products.find(item => item.id === productSelect.value);
      const qty = Number(qtyInput.value || 0);
      const available = Number(product?.quantity_kg || 0);
      note.innerHTML = qty > 0 && available >= qty
        ? `${product.name} is available. Submitting will create a confirmed sales order.`
        : `<span class="text-error font-bold">${product?.name || 'Product'} is short by ${Math.max(0, qty - available).toLocaleString('en-KE')} kg.</span> Submitting will not create a sale; it will notify Production and Inventory.`;
    };
    if (recommendation?.id) productSelect.value = recommendation.id;
    productSelect.addEventListener('change', updateNote);
    qtyInput.addEventListener('input', updateNote);
    updateNote();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const product = products.find(item => item.id === data.product_id);
      const quantity = Number(data.quantity_kg || 0);
      if (!product || quantity <= 0) {
        toast('Choose a product and quantity before processing the opportunity.', 'error');
        return;
      }
      const available = Number(product.quantity_kg || 0);
      if (available < quantity) {
        const demand = queueCrmStockDemand(account, product, quantity, data.notes);
        overlay.remove();
        toast(`No sale was created. ${demand.id} was sent to Production and Inventory.`, 'warning');
        return;
      }
      const order = await window.salesModule.createOrder({
        customer_id: account.id,
        customer_name: account.company_name,
        items: [{
          product_id: product.id,
          product_name: product.name,
          quantity_kg: quantity,
          unit_price: Number(product.unit_price || 0),
          line_total_ksh: quantity * Number(product.unit_price || 0)
        }],
        product_id: product.id,
        product_name: product.name,
        quantity_kg: quantity,
        unit_price: Number(product.unit_price || 0),
        total_ksh: quantity * Number(product.unit_price || 0),
        delivery_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        notes: `CRM opportunity: ${data.notes || 'No note'}`
      });
      recordOpportunity(account, product, quantity, data.notes, order ? 'order_created' : 'failed', order?.id);
      overlay.remove();
      toast(order ? `${order.order_number} created from CRM opportunity.` : 'Could not create sales order.', order ? 'success' : 'error');
      await renderCrmPage();
    });
  }

  function createFinanceTask(account) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-${Date.now()}`,
      title: `Collect payment: ${account.company_name}`,
      description: `${account.company_name} has ${money(account.outstanding)} outstanding. Contact ${account.contact_name} and update CRM notes.`,
      department: 'Finance',
      priority: account.risk === 'critical' ? 'high' : 'medium',
      status: 'open',
      assigned_to: 'Finance Lead',
      source_module: 'customer_crm',
      related_customer_id: account.id,
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  async function getProducts() {
    if (window.inventoryModule?.getFinishedProducts) return window.inventoryModule.getFinishedProducts();
    return readJson('eden_finished_products', []);
  }

  function recommendProduct(account, products) {
    if (!products.length) return null;
    const category = String(account.category || '').toLowerCase();
    const preferred = products.find(product => String(product.category || product.name || '').toLowerCase().includes(category));
    if (preferred) return preferred;
    return [...products].sort((a, b) => Number(b.quantity_kg || 0) - Number(a.quantity_kg || 0))[0] || products[0];
  }

  function queueCrmStockDemand(account, product, quantityKg, notes) {
    const shortage = Math.max(0, Number(quantityKg || 0) - Number(product.quantity_kg || 0));
    const demand = {
      id: `DEMAND-${Date.now()}`,
      customer_id: account.id,
      customer_name: account.company_name,
      source_module: 'customer_crm',
      status: 'queued_for_production',
      reason: Number(product.quantity_kg || 0) <= 0 ? 'product_out_of_stock' : 'insufficient_finished_stock',
      notes,
      lines: [{
        product_id: product.id,
        product_name: product.name,
        requested_kg: Number(quantityKg || 0),
        available_kg: Number(product.quantity_kg || 0),
        shortage_kg: shortage,
        unit_price: Number(product.unit_price || 0),
        line_total_ksh: Number(quantityKg || 0) * Number(product.unit_price || 0)
      }],
      estimated_value_ksh: Number(quantityKg || 0) * Number(product.unit_price || 0),
      created_at: new Date().toISOString()
    };
    const demands = readJson('eden_sales_demand_requests', []);
    demands.unshift(demand);
    localStorage.setItem('eden_sales_demand_requests', JSON.stringify(demands));

    recordOpportunity(account, product, quantityKg, notes, 'blocked_for_stock', null, demand.id);
    queueCrmTask('Production', `Produce ${product.name} for CRM opportunity`, `${account.company_name} requested ${Number(quantityKg || 0).toLocaleString('en-KE')} kg, but only ${Number(product.quantity_kg || 0).toLocaleString('en-KE')} kg is available. Open a batch and notify CRM/Sales when finished stock is ready.`, 'Production Lead', product.id, account.id);
    queueCrmTask('Inventory', `Confirm finished stock for ${product.name}`, `${demand.id} is blocked by ${shortage.toLocaleString('en-KE')} kg shortage. Reconcile stock, reserve any available quantity, and update Sales before order creation.`, 'Inventory Controller', product.id, account.id);
    createCrmNotification('CRM opportunity blocked by stock', `${account.company_name}: ${product.name} needs ${shortage.toLocaleString('en-KE')} kg before a sale can be created.`);
    return demand;
  }

  function recordOpportunity(account, product, quantityKg, notes, status, orderId = null, demandId = null) {
    const opportunities = readJson('eden_crm_opportunities', []);
    opportunities.unshift({
      id: `opp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customer_id: account.id,
      customer_name: account.company_name,
      product_id: product.id,
      product_name: product.name,
      quantity_kg: Number(quantityKg || 0),
      estimated_value_ksh: Number(quantityKg || 0) * Number(product.unit_price || 0),
      status,
      notes,
      order_id: orderId,
      demand_id: demandId,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_crm_opportunities', JSON.stringify(opportunities));
  }

  function queueCrmTask(department, title, description, owner, productId, customerId) {
    const tasks = readJson('eden_tasks', []);
    tasks.unshift({
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description,
      department,
      priority: 'high',
      status: 'open',
      assigned_to: owner,
      source_module: 'customer_crm',
      related_product_id: productId,
      related_customer_id: customerId,
      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('eden_tasks', JSON.stringify(tasks));
  }

  function createCrmNotification(title, message) {
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

  async function exportCrmCsv() {
    const accounts = buildAccounts(await window.salesModule.getCustomers(), await window.salesModule.getOrders(), await window.salesModule.getInvoices());
    const rows = [
      ['Customer', 'Contact', 'Phone', 'Email', 'Category', 'Region', 'Outstanding', 'Order Value', 'Risk'],
      ...accounts.map(account => [account.company_name, account.contact_name, account.contact_phone, account.email, account.category, account.region, account.outstanding, account.totalOrders, account.risk])
    ];
    downloadTextFile(`eden-crm-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    toast('CRM export downloaded.', 'success');
  }

  function summarizeSegments(accounts) {
    const map = new Map();
    accounts.forEach(account => {
      const key = formatStatus(account.category || 'Other');
      const current = map.get(key) || { name: key, count: 0, value: 0, outstanding: 0 };
      current.count += 1;
      current.value += account.totalOrders;
      current.outstanding += account.outstanding;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }

  function createModal(title, bodyHtml, eyebrow = 'Customer CRM', maxWidthClass = 'max-w-lg') {
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
    setTimeout(() => document.dispatchEvent(new CustomEvent('eden:content-updated')), 50);
    return overlay;
  }

  function riskBadge(risk) {
    const cls = risk === 'healthy' ? 'bg-primary/10 text-primary' : risk === 'critical' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container';
    return `<span class="${cls} text-[10px] px-2 py-0.5 rounded-full font-bold">${formatStatus(risk)}</span>`;
  }

  function detailGrid(rows) {
    return `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-sm">${rows.map(([label, value]) => `<div class="p-sm rounded-lg bg-surface-container-low border border-outline-variant"><dt class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</dt><dd class="font-body-md text-body-md text-on-surface">${value || 'Not captured'}</dd></div>`).join('')}</dl>`;
  }

  function textField(name, label, placeholder, type = 'text') {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required type="${type}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest" placeholder="${placeholder}"></label>`;
  }

  function numberField(name, label, value) {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><input name="${name}" required type="number" min="0" step="1" value="${Number(value || 0)}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest"></label>`;
  }

  function selectField(name, label, options) {
    return `<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant">${label}</span><select name="${name}" class="mt-xs w-full rounded-lg border-outline-variant bg-surface-container-lowest">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
  }

  function modalActions(label) {
    return `<div class="flex justify-end gap-sm pt-sm"><button type="button" data-modal-close class="px-md py-sm border border-outline rounded-full font-label-md text-label-md">Cancel</button><button type="submit" class="px-md py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md">${label}</button></div>`;
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

  function money(value) {
    return `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  }

  function readJson(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function toast(message, type = 'info') {
    window.edenUtils?.showToast(message, type);
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
