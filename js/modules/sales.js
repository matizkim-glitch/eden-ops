// js/modules/sales.js
// Handles customers, orders, invoices, payments, and distribution

(function () {
  const salesModule = {

    MOCK_CUSTOMERS: [
      { id: 'cust-1', company_name: 'PlastiCo Kenya Ltd',   contact_name: 'Grace Njeri',    contact_phone: '+254711222333', email: 'grace@plasticoke.co.ke',  category: 'manufacturer', credit_limit_ksh: 500000, outstanding_ksh: 120000, status: 'active' },
      { id: 'cust-2', company_name: 'BuildRight Materials', contact_name: 'Hassan Abdi',    contact_phone: '+254722333444', email: 'hassan@buildright.co.ke', category: 'distributor',  credit_limit_ksh: 300000, outstanding_ksh: 0,      status: 'active' },
      { id: 'cust-3', company_name: 'EcoPackaging Ltd',     contact_name: 'Irene Wambui',   contact_phone: '+254733444555', email: 'irene@ecopack.co.ke',     category: 'manufacturer', credit_limit_ksh: 750000, outstanding_ksh: 320000, status: 'active' },
      { id: 'cust-4', company_name: 'Metro Recyclers',      contact_name: 'John Kamau',     contact_phone: '+254744555666', email: 'john@metro.co.ke',        category: 'recycler',     credit_limit_ksh: 200000, outstanding_ksh: 200000, status: 'on_hold' }
    ],

    MOCK_ORDERS: [
      { id: 'ord-1', order_number: 'ORD-2026-0041', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd',   product_id: 'fin-1', product_name: 'PET Pellets (Clear)', quantity_kg: 500,  unit_price: 120, total_ksh: 60000,  status: 'delivered',   order_date: '2026-05-20', delivery_date: '2026-05-25', invoice_id: 'inv-1', payment_status: 'paid',    notes: '' },
      { id: 'ord-2', order_number: 'ORD-2026-0042', customer_id: 'cust-3', customer_name: 'EcoPackaging Ltd',     product_id: 'fin-2', product_name: 'HDPE Granules',       quantity_kg: 1000, unit_price: 140, total_ksh: 140000, status: 'processing',   order_date: '2026-05-28', delivery_date: '2026-06-02', invoice_id: 'inv-2', payment_status: 'pending', notes: 'Priority customer' },
      { id: 'ord-3', order_number: 'ORD-2026-0043', customer_id: 'cust-2', customer_name: 'BuildRight Materials', product_id: 'fin-2', product_name: 'HDPE Granules',       quantity_kg: 2000, unit_price: 138, total_ksh: 276000, status: 'confirmed',    order_date: '2026-05-29', delivery_date: '2026-06-05', invoice_id: null,    payment_status: 'pending', notes: '' },
      { id: 'ord-4', order_number: 'ORD-2026-0044', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd',   product_id: 'fin-3', product_name: 'LDPE Film Roll',       quantity_kg: 200,  unit_price: 110, total_ksh: 22000,  status: 'dispatched',   order_date: '2026-05-29', delivery_date: '2026-05-31', invoice_id: 'inv-3', payment_status: 'pending', notes: '' }
    ],

    MOCK_INVOICES: [
      { id: 'inv-1', invoice_number: 'INV-2026-0021', order_id: 'ord-1', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd',   amount_ksh: 60000,  tax_ksh: 9600,  total_ksh: 69600,  issued_date: '2026-05-20', due_date: '2026-06-19', status: 'paid',    payment_date: '2026-05-27' },
      { id: 'inv-2', invoice_number: 'INV-2026-0022', order_id: 'ord-2', customer_id: 'cust-3', customer_name: 'EcoPackaging Ltd',     amount_ksh: 140000, tax_ksh: 22400, total_ksh: 162400, issued_date: '2026-05-28', due_date: '2026-06-27', status: 'sent',    payment_date: null },
      { id: 'inv-3', invoice_number: 'INV-2026-0023', order_id: 'ord-4', customer_id: 'cust-1', customer_name: 'PlastiCo Kenya Ltd',   amount_ksh: 22000,  tax_ksh: 3520,  total_ksh: 25520,  issued_date: '2026-05-29', due_date: '2026-06-28', status: 'sent',    payment_date: null }
    ],

    MOCK_DELIVERIES: [
      { id: 'del-1', order_id: 'ord-1', driver_name: 'Samuel Otieno', truck_plate: 'KBZ 123A', dispatch_time: '2026-05-25T08:00:00Z', delivery_time: '2026-05-25T10:30:00Z', status: 'delivered', customer_name: 'PlastiCo Kenya Ltd',   destination: 'Industrial Area, Nairobi' },
      { id: 'del-2', order_id: 'ord-4', driver_name: 'Samuel Otieno', truck_plate: 'KBZ 123A', dispatch_time: new Date().toISOString(), delivery_time: null, status: 'in_transit', customer_name: 'PlastiCo Kenya Ltd', destination: 'Westlands, Nairobi' }
    ],

    init: function () {
      if (window.authManager.isMockMode()) {
        if (!localStorage.getItem('eden_customers'))  localStorage.setItem('eden_customers',  JSON.stringify(this.MOCK_CUSTOMERS));
        if (!localStorage.getItem('eden_orders'))     localStorage.setItem('eden_orders',     JSON.stringify(this.MOCK_ORDERS));
        if (!localStorage.getItem('eden_invoices'))   localStorage.setItem('eden_invoices',   JSON.stringify(this.MOCK_INVOICES));
        if (!localStorage.getItem('eden_deliveries')) localStorage.setItem('eden_deliveries', JSON.stringify(this.MOCK_DELIVERIES));
      }
    },

    // ---- CUSTOMERS ----
    getCustomers: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_customers')) || [];
      try {
        const { data, error } = await window.supabaseClient.from('customers').select('*').order('name');
        if (error) throw error;
        return data.map(c => ({ ...c, company_name: c.name, category: c.type, credit_limit_ksh: c.credit_limit, outstanding_ksh: c.outstanding_balance, status: c.active ? 'active' : 'inactive' }));
      } catch (err) { console.error(err); return []; }
    },

    addCustomer: async function (customer) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_customers')) || [];
        const item = { id: 'cust-' + Date.now(), status: 'active', outstanding_ksh: 0, ...customer };
        list.push(item);
        localStorage.setItem('eden_customers', JSON.stringify(list));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient.from('customers').insert([customer]).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateCustomer: async function (id, updates) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_customers')) || [];
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) { list[idx] = { ...list[idx], ...updates }; localStorage.setItem('eden_customers', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.from('customers').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- ORDERS ----
    getOrders: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_orders')) || [];
      try {
        const { data, error } = await window.supabaseClient
          .from('orders')
          .select('*, customers(name), order_items(quantity, unit_price, finished_products(name))')
          .order('order_date', { ascending: false });
        if (error) throw error;
        return data.map(o => {
          const firstItem = o.order_items?.[0];
          return {
            ...o,
            customer_name: o.customers?.name || '',
            product_name: firstItem?.finished_products?.name || '',
            quantity_kg: firstItem?.quantity || 0,
            total_ksh: o.total_amount
          };
        });
      } catch (err) { console.error(err); return []; }
    },

    createOrder: async function (order) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_orders')) || [];
        const num = 'ORD-2026-' + String(list.length + 45).padStart(4, '0');
        const customers = JSON.parse(localStorage.getItem('eden_customers')) || [];
        const cust = customers.find(c => c.id === order.customer_id);
        const items = Array.isArray(order.items) && order.items.length
          ? order.items.map(item => ({
              ...item,
              quantity_kg: Number(item.quantity_kg || 0),
              unit_price: Number(item.unit_price || 0),
              line_total_ksh: Number(item.line_total_ksh || Number(item.quantity_kg || 0) * Number(item.unit_price || 0))
            }))
          : [{
              product_id: order.product_id,
              product_name: order.product_name,
              quantity_kg: Number(order.quantity_kg || 0),
              unit_price: Number(order.unit_price || 0),
              line_total_ksh: Number(order.total_ksh || 0)
            }];
        const total = items.reduce((sum, item) => sum + Number(item.line_total_ksh || 0), 0);
        const totalQty = items.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
        const item = {
          id: 'ord-' + Date.now(),
          order_number: num,
          customer_name: cust ? cust.company_name : '',
          items,
          product_id: items[0]?.product_id || order.product_id,
          product_name: items.length > 1 ? `${items.length} products` : (items[0]?.product_name || order.product_name),
          quantity_kg: totalQty,
          total_ksh: total,
          status: 'confirmed',
          payment_status: 'pending',
          invoice_id: null,
          order_date: new Date().toISOString().split('T')[0],
          ...order
        };
        list.unshift(item);
        localStorage.setItem('eden_orders', JSON.stringify(list));
        return item;
      }
      try {
        const items = Array.isArray(order.items) && order.items.length
          ? order.items
          : [{
              product_id: order.product_id,
              quantity_kg: order.quantity_kg,
              unit_price: order.unit_price
            }];
        const { data, error } = await window.supabaseClient.rpc('create_sales_order', {
          p_customer_id: order.customer_id,
          p_items: items.map(item => ({
            product_id: item.product_id,
            quantity_kg: Number(item.quantity_kg || item.quantity || 0),
            unit_price: Number(item.unit_price || 0)
          })),
          p_delivery_date: order.delivery_date || null,
          p_notes: order.notes || '',
          p_idempotency_key: order.idempotency_key || `order:${order.customer_id}:${Date.now()}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    updateOrderStatus: async function (id, status) {
      if (window.authManager.isMockMode()) {
        const list = JSON.parse(localStorage.getItem('eden_orders')) || [];
        const idx = list.findIndex(o => o.id === id);
        if (idx !== -1) { list[idx].status = status; localStorage.setItem('eden_orders', JSON.stringify(list)); return list[idx]; }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.from('orders').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- INVOICES ----
    getInvoices: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_invoices')) || [];
      try {
        const { data, error } = await window.supabaseClient
          .from('invoices')
          .select('*, customers(name)')
          .order('issued_date', { ascending: false });
        if (error) throw error;
        return data.map(i => ({ ...i, customer_name: i.customers?.name || '', total_ksh: i.amount }));
      } catch (err) { console.error(err); return []; }
    },

    generateInvoice: async function (orderId) {
      if (window.authManager.isMockMode()) {
        const orders = JSON.parse(localStorage.getItem('eden_orders')) || [];
        const order = orders.find(o => o.id === orderId);
        if (!order) return null;
        const invoices = JSON.parse(localStorage.getItem('eden_invoices')) || [];
        const num = 'INV-2026-' + String(invoices.length + 24).padStart(4, '0');
        const items = Array.isArray(order.items) && order.items.length
          ? order.items
          : [{
              product_id: order.product_id,
              product_name: order.product_name,
              quantity_kg: Number(order.quantity_kg || 0),
              unit_price: Number(order.unit_price || 0),
              line_total_ksh: Number(order.total_ksh || 0)
            }];
        const amount = items.reduce((sum, item) => sum + Number(item.line_total_ksh || Number(item.quantity_kg || 0) * Number(item.unit_price || 0)), 0);
        const tax = Math.round(amount * 0.16);
        const invoice = {
          id: 'inv-' + Date.now(),
          invoice_number: num,
          order_id: orderId,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          items,
          amount_ksh: amount,
          tax_ksh: tax,
          total_ksh: amount + tax,
          issued_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: 'sent',
          payment_date: null
        };
        invoices.unshift(invoice);
        localStorage.setItem('eden_invoices', JSON.stringify(invoices));
        // Link invoice to order
        const oIdx = orders.findIndex(o => o.id === orderId);
        if (oIdx !== -1) { orders[oIdx].invoice_id = invoice.id; localStorage.setItem('eden_orders', JSON.stringify(orders)); }
        return invoice;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('generate_invoice_for_order', {
          p_order_id: orderId,
          p_idempotency_key: `invoice:${orderId}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    recordPayment: async function (invoiceId, amount_ksh) {
      if (window.authManager.isMockMode()) {
        const invoices = JSON.parse(localStorage.getItem('eden_invoices')) || [];
        const idx = invoices.findIndex(i => i.id === invoiceId);
        if (idx !== -1) {
          const payments = JSON.parse(localStorage.getItem('eden_payments')) || [];
          const amount = Number(amount_ksh || 0);
          const invoiceTotal = Number(invoices[idx].total_ksh || invoices[idx].amount || invoices[idx].amount_ksh || 0);
          const paidAmount = Number(invoices[idx].paid_amount || 0) + amount;
          payments.unshift({
            id: 'pay-' + Date.now(),
            invoice_id: invoiceId,
            customer_id: invoices[idx].customer_id,
            amount,
            payment_date: new Date().toISOString().split('T')[0],
            method: 'mpesa',
            reference_number: ''
          });
          invoices[idx].paid_amount = paidAmount;
          invoices[idx].status = paidAmount >= invoiceTotal ? 'paid' : 'partial';
          invoices[idx].payment_date = invoices[idx].status === 'paid' ? new Date().toISOString().split('T')[0] : null;
          localStorage.setItem('eden_payments', JSON.stringify(payments));
          localStorage.setItem('eden_invoices', JSON.stringify(invoices));
          // Update order payment_status
          const orders = JSON.parse(localStorage.getItem('eden_orders')) || [];
          const oidx = orders.findIndex(o => o.invoice_id === invoiceId);
          if (oidx !== -1) { orders[oidx].payment_status = invoices[idx].status === 'paid' ? 'paid' : 'partial'; localStorage.setItem('eden_orders', JSON.stringify(orders)); }
          return invoices[idx];
        }
        return null;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('record_invoice_payment', {
          p_invoice_id: invoiceId,
          p_amount: amount_ksh,
          p_method: 'mpesa',
          p_reference_number: '',
          p_idempotency_key: `payment:${invoiceId}:${amount_ksh}:${Date.now()}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- DELIVERIES ----
    getDeliveries: async function () {
      if (window.authManager.isMockMode()) return JSON.parse(localStorage.getItem('eden_deliveries')) || [];
      try {
        const { data, error } = await window.supabaseClient
          .from('deliveries')
          .select('*, orders(order_number, customers(name))')
          .order('dispatch_time', { ascending: false });
        if (error) throw error;
        return (data || []).map(delivery => ({
          ...delivery,
          customer_name: delivery.orders?.customers?.name || '',
          destination: ''
        }));
      } catch (err) { console.error(err); return []; }
    },

    dispatchOrder: async function (orderId, delivery = {}) {
      if (window.authManager.isMockMode()) {
        await this.updateOrderStatus(orderId, 'dispatched');
        const deliveries = JSON.parse(localStorage.getItem('eden_deliveries')) || [];
        const item = {
          id: 'del-' + Date.now(),
          order_id: orderId,
          driver_name: delivery.driver_name || 'Assigned driver',
          truck_plate: delivery.truck_plate || '',
          dispatch_time: new Date().toISOString(),
          delivery_time: null,
          status: 'in_transit'
        };
        deliveries.unshift(item);
        localStorage.setItem('eden_deliveries', JSON.stringify(deliveries));
        return item;
      }
      try {
        const { data, error } = await window.supabaseClient.rpc('dispatch_order', {
          p_order_id: orderId,
          p_driver_name: delivery.driver_name || 'Assigned driver',
          p_truck_plate: delivery.truck_plate || '',
          p_idempotency_key: delivery.idempotency_key || `dispatch:${orderId}`
        });
        if (error) throw error;
        return data;
      } catch (err) { console.error(err); return null; }
    },

    // ---- SUMMARY STATS ----
    getSalesStats: async function () {
      const [orders, invoices] = await Promise.all([this.getOrders(), this.getInvoices()]);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthOrders  = orders.filter(o => o.order_date && o.order_date.startsWith(thisMonth));
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.total_ksh || i.amount || 0), 0);
      const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total_ksh || i.amount || 0), 0);
      const monthRevenue = paidInvoices
        .filter(i => i.payment_date && i.payment_date.startsWith(thisMonth))
        .reduce((s, i) => s + Number(i.total_ksh || i.amount || 0), 0);
      return {
        totalOrders: orders.length,
        monthOrders: monthOrders.length,
        totalRevenue,
        monthRevenue,
        outstanding,
        pendingOrders: orders.filter(o => ['confirmed','processing'].includes(o.status)).length
      };
    }
  };

  salesModule.init();
  window.salesModule = salesModule;
})();
