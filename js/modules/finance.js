// js/modules/finance.js
// Finance summaries, invoice/payment helpers, and mock-mode seed data.

(function () {
  const financeModule = {
    init: function () {
      if (!window.authManager || !window.authManager.isMockMode()) return;

      if (!localStorage.getItem('eden_invoices')) {
        localStorage.setItem('eden_invoices', JSON.stringify([
          { id: 'inv-1', invoice_number: 'INV-2026-0021', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd', amount: 69600, paid_amount: 69600, status: 'paid', issued_date: '2026-05-20', due_date: '2026-06-19' },
          { id: 'inv-2', invoice_number: 'INV-2026-0022', customer_id: 'cust-3', customer_name: 'EcoPackaging Ltd', amount: 162400, paid_amount: 0, status: 'sent', issued_date: '2026-05-28', due_date: '2026-06-27' },
          { id: 'inv-3', invoice_number: 'INV-2026-0023', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd', amount: 25520, paid_amount: 0, status: 'sent', issued_date: '2026-05-29', due_date: '2026-06-28' }
        ]));
      }

      if (!localStorage.getItem('eden_payments')) {
        localStorage.setItem('eden_payments', JSON.stringify([
          { id: 'pay-1', invoice_id: 'inv-1', customer_id: 'cust-1', amount: 69600, payment_date: '2026-05-27', method: 'mpesa', reference_number: 'QER42MPESA' }
        ]));
      }
    },

    getInvoices: async function () {
      if (window.authManager.isMockMode()) {
        return (JSON.parse(localStorage.getItem('eden_invoices')) || []).map(this.normalizeInvoice);
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('invoices')
          .select('*, customers(name, type)')
          .order('issued_date', { ascending: false });
        if (error) throw error;
        return (data || []).map(i => this.normalizeInvoice({ ...i, customer_name: i.customers?.name || '' }));
      } catch (err) {
        console.error('Error fetching invoices:', err);
        return [];
      }
    },

    getPayments: async function () {
      if (window.authManager.isMockMode()) {
        return JSON.parse(localStorage.getItem('eden_payments')) || [];
      }
      try {
        const { data, error } = await window.supabaseClient
          .from('payments')
          .select('*')
          .order('payment_date', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching payments:', err);
        return [];
      }
    },

    recordPayment: async function (invoiceId, payment) {
      const amount = Number(payment.amount || payment.amount_ksh || 0);
      if (window.authManager.isMockMode()) {
        const payments = JSON.parse(localStorage.getItem('eden_payments')) || [];
        const invoices = JSON.parse(localStorage.getItem('eden_invoices')) || [];
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) return null;

        const item = {
          id: 'pay-' + Date.now(),
          invoice_id: invoiceId,
          customer_id: invoice.customer_id,
          amount,
          payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
          method: payment.method || 'mpesa',
          reference_number: payment.reference_number || ''
        };
        payments.unshift(item);
        invoice.paid_amount = Number(invoice.paid_amount || 0) + amount;
        invoice.status = invoice.paid_amount >= Number(invoice.amount || invoice.total_ksh || 0) ? 'paid' : 'partial';
        localStorage.setItem('eden_payments', JSON.stringify(payments));
        localStorage.setItem('eden_invoices', JSON.stringify(invoices));
        return item;
      }

      try {
        const { data, error } = await window.supabaseClient.rpc('record_invoice_payment', {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_method: payment.method || 'mpesa',
          p_reference_number: payment.reference_number || '',
          p_idempotency_key: payment.idempotency_key || `finance-payment:${invoiceId}:${payment.reference_number || Date.now()}`
        });
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error recording payment:', err);
        return null;
      }
    },

    getFinanceStats: async function () {
      const [invoices, payments] = await Promise.all([this.getInvoices(), this.getPayments()]);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthRevenue = payments
        .filter(p => (p.payment_date || '').startsWith(thisMonth))
        .reduce((sum, p) => sum + Number(p.amount || p.amount_ksh || 0), 0);
      const receivables = invoices
        .filter(i => i.status !== 'paid')
        .reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.paid_amount || 0)), 0);
      return {
        monthRevenue,
        receivables,
        overdueCount: invoices.filter(i => i.status === 'overdue').length,
        invoiceCount: invoices.length,
        paidCount: invoices.filter(i => i.status === 'paid').length
      };
    },

    normalizeInvoice: function (invoice) {
      const amount = Number(invoice.amount ?? invoice.total_ksh ?? invoice.amount_ksh ?? 0);
      return {
        ...invoice,
        amount,
        paid_amount: Number(invoice.paid_amount || (invoice.status === 'paid' ? amount : 0)),
        customer_name: invoice.customer_name || invoice.company_name || 'Unknown customer'
      };
    }
  };

  financeModule.init();
  window.financeModule = financeModule;
})();
