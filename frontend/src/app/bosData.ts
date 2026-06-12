import { useEffect, useMemo, useState } from 'react';
import { appendStore, readStore, subscribeStore, uid, updateStore, writeStore } from '../lib/legacyBridge';

export type StockProduct = {
  id: string;
  name: string;
  sku: string;
  quantity_kg: number;
  unit_price: number;
  low_stock_threshold: number;
};

export type RawMaterial = {
  id: string;
  name: string;
  category: string;
  quantity_kg: number;
  reorder_threshold_kg: number;
  reorder_quantity_kg: number;
  supplier_name: string;
};

export type ProductionBatch = {
  id: string;
  batch_code: string;
  product_name: string;
  target_qty_kg: number;
  output_qty_kg: number;
  status: string;
  owner: string;
  qc_result?: string;
};

export type SalesOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total_ksh: number;
  items: Array<{ product_id: string; product_name: string; quantity_kg: number }>;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  paid_amount: number;
  status: string;
};

export type StaffTask = {
  id: string;
  title: string;
  department: string;
  owner: string;
  status: string;
  priority: string;
};

export type CollectionRoute = {
  id: string;
  school_name: string;
  zone: string;
  status: string;
  weight_kg: number;
};

export type BosState = {
  products: StockProduct[];
  rawMaterials: RawMaterial[];
  batches: ProductionBatch[];
  orders: SalesOrder[];
  invoices: Invoice[];
  tasks: StaffTask[];
  collections: CollectionRoute[];
  auditEvents: Array<{ id: string; message: string; department: string; created_at: string }>;
};

const seed: BosState = {
  products: [
    { id: 'fin-1', name: 'PET Pellets (Clear)', sku: 'FIN-PET-01', quantity_kg: 1800, unit_price: 95, low_stock_threshold: 500 },
    { id: 'fin-2', name: 'HDPE Granules', sku: 'FIN-HDPE-02', quantity_kg: 950, unit_price: 105, low_stock_threshold: 400 },
    { id: 'fin-3', name: 'LDPE Film Roll', sku: 'FIN-LDPE-03', quantity_kg: 320, unit_price: 120, low_stock_threshold: 350 },
    { id: 'fin-5', name: 'EKO Shoe Polish', sku: 'FIN-EKO-01', quantity_kg: 80, unit_price: 240, low_stock_threshold: 100 }
  ],
  rawMaterials: [
    { id: 'raw-1', name: 'Waste Paper', category: 'paper', quantity_kg: 420, reorder_threshold_kg: 250, reorder_quantity_kg: 800, supplier_name: 'School Recovery Network' },
    { id: 'raw-2', name: 'Paraffin Wax', category: 'eko_input', quantity_kg: 44.5, reorder_threshold_kg: 50, reorder_quantity_kg: 150, supplier_name: 'Industrial Wax Kenya' },
    { id: 'raw-3', name: 'Carnauba Wax', category: 'eko_input', quantity_kg: 22, reorder_threshold_kg: 30, reorder_quantity_kg: 80, supplier_name: 'Natural Waxes Ltd' },
    { id: 'raw-4', name: 'Carbon Black Pigment', category: 'eko_input', quantity_kg: 65, reorder_threshold_kg: 40, reorder_quantity_kg: 120, supplier_name: 'ColorChem Supplies' },
    { id: 'raw-5', name: 'Turpentine Solvent', category: 'eko_input', quantity_kg: 38, reorder_threshold_kg: 45, reorder_quantity_kg: 100, supplier_name: 'Solvent Hub' }
  ],
  batches: [
    { id: 'pb-1', batch_code: 'PB-2026-001', product_name: 'PET Pellets (Clear)', target_qty_kg: 410, output_qty_kg: 410, status: 'completed', owner: 'Production Lead', qc_result: 'passed' },
    { id: 'pb-2', batch_code: 'PB-2026-004', product_name: 'EKO Shoe Polish', target_qty_kg: 50, output_qty_kg: 0, status: 'qc_pending', owner: 'QC Inspector' },
    { id: 'pb-3', batch_code: 'PB-2026-005', product_name: 'HDPE Granules', target_qty_kg: 800, output_qty_kg: 0, status: 'materials_requested', owner: 'Inventory Controller' }
  ],
  orders: [
    { id: 'ord-1', order_number: 'ORD-9844', customer_name: 'City Parks', status: 'confirmed', total_ksh: 12800, items: [{ product_id: 'fin-2', product_name: 'HDPE Granules', quantity_kg: 100 }] },
    { id: 'ord-2', order_number: 'ORD-9921', customer_name: 'BuildCo', status: 'stock_blocked', total_ksh: 42200, items: [{ product_id: 'fin-1', product_name: 'PET Pellets (Clear)', quantity_kg: 40000 }] }
  ],
  invoices: [
    { id: 'inv-1', invoice_number: 'INV-2026-001', customer_name: 'City Parks', amount: 12800, paid_amount: 12800, status: 'paid' },
    { id: 'inv-2', invoice_number: 'INV-2026-002', customer_name: 'TechPlast', amount: 55000, paid_amount: 40000, status: 'partial' }
  ],
  tasks: [
    { id: 'task-1', title: 'Safety Override check', department: 'Maintenance', owner: 'Maintenance desk', status: 'open', priority: 'high' },
    { id: 'task-2', title: 'Production shift coverage', department: 'HR', owner: 'HR Lead', status: 'review', priority: 'medium' },
    { id: 'task-3', title: 'Confirm EKO input restock', department: 'Procurement', owner: 'Procurement', status: 'open', priority: 'high' }
  ],
  collections: [
    { id: 'col-1', school_name: 'Green Valley School', zone: 'North Sector', status: 'in_transit', weight_kg: 120 },
    { id: 'col-2', school_name: 'Riverside Academy', zone: 'East Sector', status: 'scheduled', weight_kg: 85 }
  ],
  auditEvents: [
    { id: 'evt-1', message: 'React migration workspace initialized', department: 'Operations', created_at: new Date().toISOString() }
  ]
};

function initializeStore() {
  if (!window.localStorage.getItem('eden_react_initialized')) {
    writeStore('eden_finished_products', seed.products);
    writeStore('eden_raw_materials', seed.rawMaterials);
    writeStore('eden_production_batches', seed.batches);
    writeStore('eden_sales_orders', seed.orders);
    writeStore('eden_invoices', seed.invoices);
    writeStore('eden_staff_tasks', seed.tasks);
    writeStore('eden_collection_routes', seed.collections);
    writeStore('eden_react_audit_events', seed.auditEvents);
    window.localStorage.setItem('eden_react_initialized', 'true');
  }
}

function readBosState(): BosState {
  initializeStore();
  return {
    products: readStore('eden_finished_products', seed.products),
    rawMaterials: readStore('eden_raw_materials', seed.rawMaterials),
    batches: readStore('eden_production_batches', seed.batches),
    orders: readStore('eden_sales_orders', seed.orders),
    invoices: readStore('eden_invoices', seed.invoices),
    tasks: readStore('eden_staff_tasks', seed.tasks),
    collections: readStore('eden_collection_routes', seed.collections),
    auditEvents: readStore('eden_react_audit_events', seed.auditEvents)
  };
}

export function useBosStore() {
  const [state, setState] = useState<BosState>(() => readBosState());

  useEffect(() => subscribeStore(() => setState(readBosState())), []);

  const actions = useMemo(() => ({
    log(message: string, department: string) {
      appendStore('eden_react_audit_events', { id: uid('evt'), message, department, created_at: new Date().toISOString() });
    },
    adjustStock(productId: string, delta: number, source: string) {
      const products = state.products.map(product => (
        product.id === productId ? { ...product, quantity_kg: Math.max(0, product.quantity_kg + delta) } : product
      ));
      writeStore('eden_finished_products', products);
      appendStore('eden_stock_movements', {
        id: uid('mov'),
        finished_product_id: productId,
        quantity_kg: delta,
        movement_type: delta >= 0 ? 'finished_receipt' : 'finished_dispatch',
        source_type: 'react_frontend',
        source_id: source,
        created_at: new Date().toISOString()
      });
    },
    advanceBatch(batchId: string) {
      const order = ['materials_requested', 'materials_approved', 'materials_issued', 'in_progress', 'qc_pending', 'qc_passed', 'completed'];
      const batch = state.batches.find(item => item.id === batchId);
      if (!batch) return;
      const current = order.indexOf(batch.status);
      const nextStatus = order[Math.min(current + 1, order.length - 1)] || 'materials_requested';
      updateStore<ProductionBatch>('eden_production_batches', batchId, {
        status: nextStatus,
        output_qty_kg: nextStatus === 'completed' ? batch.target_qty_kg : batch.output_qty_kg,
        qc_result: nextStatus === 'qc_passed' || nextStatus === 'completed' ? 'passed' : batch.qc_result
      });
      if (nextStatus === 'completed') {
        const product = state.products.find(item => item.name === batch.product_name);
        if (product) this.adjustStock(product.id, batch.target_qty_kg, batch.batch_code);
      }
    },
    createProductionRequest(productName = 'EKO Shoe Polish', target = 50) {
      appendStore<ProductionBatch>('eden_production_batches', {
        id: uid('pb'),
        batch_code: `PB-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
        product_name: productName,
        target_qty_kg: target,
        output_qty_kg: 0,
        status: 'materials_requested',
        owner: 'Production Lead'
      });
      appendStore<StaffTask>('eden_staff_tasks', {
        id: uid('task'),
        title: `Issue materials for ${productName}`,
        department: 'Inventory',
        owner: 'Inventory Controller',
        status: 'open',
        priority: 'high'
      });
    },
    reserveOrder(orderId: string) {
      const order = state.orders.find(item => item.id === orderId);
      if (!order) return;
      const hasShortage = order.items.some(item => {
        const product = state.products.find(product => product.id === item.product_id);
        return !product || product.quantity_kg < item.quantity_kg;
      });
      updateStore<SalesOrder>('eden_sales_orders', orderId, { status: hasShortage ? 'stock_blocked' : 'reserved' });
      appendStore<StaffTask>('eden_staff_tasks', {
        id: uid('task'),
        title: hasShortage ? `Produce stock for ${order.order_number}` : `Dispatch ${order.order_number}`,
        department: hasShortage ? 'Production' : 'Sales',
        owner: hasShortage ? 'Production Lead' : 'Distribution',
        status: 'open',
        priority: hasShortage ? 'high' : 'medium'
      });
    },
    recordPayment(invoiceId: string, amount: number) {
      const invoice = state.invoices.find(item => item.id === invoiceId);
      if (!invoice) return;
      const paid = Math.min(invoice.amount, invoice.paid_amount + amount);
      updateStore<Invoice>('eden_invoices', invoiceId, {
        paid_amount: paid,
        status: paid >= invoice.amount ? 'paid' : 'partial'
      });
      appendStore('eden_payments', { id: uid('pay'), invoice_id: invoiceId, amount, created_at: new Date().toISOString() });
    },
    completeTask(taskId: string) {
      updateStore<StaffTask>('eden_staff_tasks', taskId, { status: 'completed' });
    },
    receiveCollection(routeId: string) {
      updateStore<CollectionRoute>('eden_collection_routes', routeId, { status: 'received' });
      appendStore('eden_stock_movements', {
        id: uid('mov'),
        quantity_kg: state.collections.find(item => item.id === routeId)?.weight_kg || 0,
        movement_type: 'raw_receipt',
        source_type: 'collection',
        source_id: routeId,
        created_at: new Date().toISOString()
      });
    }
  }), [state]);

  return { state, actions };
}
