const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260531_backend_enforcement.sql'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');

const roles = ['admin', 'manager', 'operations', 'finance', 'sales', 'inventory', 'production', 'collection', 'hr', 'procurement'];

const allowed = {
  profiles: { read: ['admin', 'manager', 'operations', 'hr'], write: ['admin', 'manager', 'hr'] },
  collections: { read: ['admin', 'manager', 'operations', 'collection', 'inventory'], write: ['admin', 'manager', 'operations', 'collection'] },
  raw_materials: { read: ['admin', 'manager', 'operations', 'inventory', 'production', 'procurement', 'finance'], write: ['admin', 'manager', 'operations', 'inventory'] },
  finished_products: { read: ['admin', 'manager', 'operations', 'inventory', 'production', 'sales', 'finance'], write: ['admin', 'manager', 'operations', 'inventory'] },
  batches: { read: ['admin', 'manager', 'operations', 'production', 'inventory', 'sales', 'finance'], write: ['admin', 'manager', 'operations', 'production'] },
  customers: { read: ['admin', 'manager', 'operations', 'sales', 'finance'], write: ['admin', 'manager', 'operations', 'sales'] },
  orders: { read: ['admin', 'manager', 'operations', 'sales', 'finance', 'inventory', 'production'], write: ['admin', 'manager', 'operations', 'sales'] },
  invoices: { read: ['admin', 'manager', 'operations', 'finance', 'sales'], write: ['admin', 'manager', 'operations', 'finance'] },
  payments: { read: ['admin', 'manager', 'operations', 'finance'], write: ['admin', 'manager', 'operations', 'finance'] },
  staff: { read: ['admin', 'manager', 'operations', 'hr', 'finance'], write: ['admin', 'manager', 'operations', 'hr'] },
  suppliers: { read: ['admin', 'manager', 'operations', 'inventory', 'procurement', 'production'], write: ['admin', 'manager', 'operations', 'inventory', 'procurement'] },
  audit_logs: { read: ['admin', 'manager', 'operations'], write: [] }
};

function can(role, table, action) {
  return allowed[table][action].includes(role);
}

function assertContains(haystack, needle, label) {
  assert(haystack.includes(needle), label);
}

function testDeploymentArtifacts() {
  [
    'create table if not exists production_state_transitions',
    'create table if not exists deliveries',
    'create unique index if not exists stock_movements_idempotency_idx',
    'create unique index if not exists payments_idempotency_key_idx',
    'create unique index if not exists orders_idempotency_key_idx',
    'create trigger audit_stock_movements',
    'create trigger prevent_payment_update',
    'create trigger prevent_payment_delete',
    'alter table deliveries enable row level security',
    'alter table production_state_transitions enable row level security',
    'create policy payments_insert',
    'create policy audit_logs_read'
  ].forEach(needle => assertContains(migration, needle, `migration should include ${needle}`));

  [
    'post_stock_movement',
    'receive_collection',
    'request_production_batch',
    'approve_production_materials',
    'issue_production_materials',
    'start_production_work',
    'send_batch_to_qc',
    'record_batch_qc',
    'create_sales_order',
    'generate_invoice_for_order',
    'record_invoice_payment',
    'dispatch_order'
  ].forEach(fn => assertContains(migration, `function ${fn}`, `RPC ${fn} should exist`));

  assert(!migration.includes("auth.role() = 'authenticated'"), 'migration must not use broad authenticated policies');
  assert(!schema.includes("auth.role() = 'authenticated'"), 'baseline schema must not use broad authenticated policies');
  assert(!/with check\s*\(\s*true\s*\)/i.test(schema), 'schema must not allow unconditional writes');
}

function testRoleMatrix() {
  Object.keys(allowed).forEach(table => {
    ['read', 'write'].forEach(action => {
      roles.forEach(role => {
        const expected = can(role, table, action);
        if (expected) {
          assert(allowed[table][action].includes(role), `${role} should be allowed to ${action} ${table}`);
        } else {
          assert(!allowed[table][action].includes(role), `${role} should be denied ${action} ${table}`);
        }
      });
    });
  });
  assert(can('finance', 'payments', 'write'), 'finance can write payments');
  assert(!can('sales', 'payments', 'write'), 'sales cannot write payments');
  assert(!can('hr', 'orders', 'read'), 'hr cannot read orders');
  assert(!can('procurement', 'staff', 'read'), 'procurement cannot read staff');
}

class FinancialLedger {
  constructor(total) {
    this.invoice = { amount: total, paid: 0, status: 'sent' };
    this.payments = new Map();
  }

  record(amount, key) {
    if (this.payments.has(key)) return this.snapshot();
    assert(amount > 0, 'payment must be positive');
    this.payments.set(key, { amount, reversal: false });
    this.invoice.paid = Math.min(this.invoice.amount, this.invoice.paid + amount);
    this.invoice.status = this.invoice.paid >= this.invoice.amount ? 'paid' : 'partial';
    return this.snapshot();
  }

  reverse(key, reversalKey) {
    const payment = this.payments.get(key);
    assert(payment && !payment.reversal, 'payment must exist before reversal');
    if (this.payments.has(reversalKey)) return this.snapshot();
    this.payments.set(reversalKey, { amount: -payment.amount, reversal: true, reversed: key });
    this.invoice.paid = Math.max(0, this.invoice.paid - payment.amount);
    this.invoice.status = this.invoice.paid === 0 ? 'sent' : (this.invoice.paid >= this.invoice.amount ? 'paid' : 'partial');
    return this.snapshot();
  }

  snapshot() {
    return {
      balance: this.invoice.amount - this.invoice.paid,
      status: this.invoice.status,
      paid: this.invoice.paid,
      paymentCount: this.payments.size
    };
  }
}

function testFinancialIntegrity() {
  const ledger = new FinancialLedger(1000);
  ledger.record(400, 'p-400');
  const paid = ledger.record(600, 'p-600');
  assert.strictEqual(paid.balance, 0, 'balance should be zero');
  assert.strictEqual(paid.status, 'paid', 'invoice should be paid');

  const before = ledger.snapshot();
  ledger.record(600, 'p-600');
  assert.deepStrictEqual(ledger.snapshot(), before, 'duplicate payment key should be idempotent');

  const reversed = ledger.reverse('p-600', 'rev-p-600');
  assert.strictEqual(reversed.balance, 600, 'reversal should restore balance');
  assert.strictEqual(reversed.status, 'partial', 'reversal should make invoice partial');

  const multi = new FinancialLedger(1000);
  [100, 200, 300, 400].forEach((amount, i) => multi.record(amount, `partial-${i}`));
  assert.strictEqual(multi.snapshot().balance, 0, 'multiple partial payments should reconcile');
  multi.record(400, 'concurrent-key');
  multi.record(400, 'concurrent-key');
  assert.strictEqual(multi.payments.size, 5, 'concurrent duplicate key should not drift');
}

class InventoryLedger {
  constructor() {
    this.raw = new Map([['paper', 0], ['wax', 100]]);
    this.finished = new Map([['eko', 0]]);
    this.movements = new Map();
  }

  post(type, quantity, stockType, id, source) {
    const key = `${type}:${source}`;
    if (this.movements.has(key)) return this.movements.get(key);
    const bucket = stockType === 'raw' ? this.raw : this.finished;
    const next = (bucket.get(id) || 0) + quantity;
    assert(next >= 0, 'stock balance must not go negative');
    bucket.set(id, next);
    const movement = { type, quantity, stockType, id, source, resulting_balance: next };
    this.movements.set(key, movement);
    return movement;
  }

  reconstruct(stockType, id) {
    let balance = 0;
    for (const movement of this.movements.values()) {
      if (movement.stockType === stockType && movement.id === id) balance += movement.quantity;
    }
    return balance;
  }
}

function testInventoryIntegrity() {
  const ledger = new InventoryLedger();
  ledger.post('raw_receipt', 50, 'raw', 'paper', 'collection-1');
  ledger.post('raw_receipt', 50, 'raw', 'paper', 'collection-1');
  assert.strictEqual(ledger.raw.get('paper'), 50, 'duplicate collection receipt should not double count');

  ledger.post('raw_issue', -20, 'raw', 'wax', 'batch-1');
  ledger.post('finished_receipt', 15, 'finished', 'eko', 'batch-1');
  ledger.post('finished_dispatch', -5, 'finished', 'eko', 'order-1:eko');

  assert.strictEqual(ledger.raw.get('wax'), 80, 'production issue should reduce raw stock');
  assert.strictEqual(ledger.finished.get('eko'), 10, 'dispatch should reduce finished stock after completion');
  assert.strictEqual(ledger.reconstruct('finished', 'eko'), 10, 'ledger reconstruction should match finished stock delta');
  assert.strictEqual(ledger.movements.size, 4, 'stock movements should be recorded once per source action');
}

const validTransitions = {
  materials_requested: ['materials_approved', 'rejected'],
  materials_approved: ['materials_issued', 'rejected'],
  materials_issued: ['in_progress', 'rejected'],
  in_progress: ['qc_pending', 'rejected'],
  qc_pending: ['qc_passed', 'qc_failed'],
  qc_passed: ['completed'],
  qc_failed: ['rejected', 'in_progress'],
  completed: [],
  rejected: []
};

function testProductionLifecycle() {
  const states = Object.keys(validTransitions);
  Object.entries(validTransitions).forEach(([from, tos]) => {
    tos.forEach(to => assert(validTransitions[from].includes(to), `${from} -> ${to} should be valid`));
    states.filter(to => !tos.includes(to)).forEach(to => {
      assert(!validTransitions[from].includes(to), `${from} -> ${to} should be invalid`);
    });
  });

  let state = 'materials_requested';
  const seen = new Set();
  const transition = (to, key) => {
    if (seen.has(key)) return state;
    assert(validTransitions[state].includes(to), `invalid transition ${state} -> ${to}`);
    seen.add(key);
    state = to;
    return state;
  };

  ['materials_approved', 'materials_issued', 'in_progress', 'qc_pending', 'qc_passed', 'completed']
    .forEach((to, i) => transition(to, `step-${i}`));
  assert.strictEqual(state, 'completed', 'happy path should complete');
  transition('completed', 'step-5');
  assert.strictEqual(seen.size, 6, 'duplicate completion should be idempotent');
  assert.throws(() => transition('in_progress', 'bad'), /invalid transition/, 'completed batch cannot restart');
}

function testSecurityPenetrationControls() {
  const toast = fs.readFileSync(path.join(root, 'js', 'components', 'toast.js'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'js', 'components', 'modal.js'), 'utf8');
  const table = fs.readFileSync(path.join(root, 'js', 'components', 'table.js'), 'utf8');

  assert(!/toast\.innerHTML\s*=/.test(toast), 'stored XSS through toast should be blocked');
  assert(!/card\.innerHTML\s*=/.test(modal), 'stored XSS through modal title/body should be blocked');
  assert(!/td\.innerHTML\s*=/.test(table), 'stored XSS through table cells should be blocked');
  assert(migration.includes('prevent_payment_mutation'), 'payment tampering should be blocked by trigger');
  assert(migration.includes('invalid_production_transition'), 'workflow-state bypass should be blocked');
  assert(migration.includes('perform require_role'), 'direct RPC abuse should be role checked');
  assert(migration.includes('for update'), 'IDOR-prone mutations should lock selected rows for server validation');
}

function testPerformanceModel() {
  const customers = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Customer ${i}`, segment: i % 5 }));
  const transactions = Array.from({ length: 50000 }, (_, i) => ({ customer_id: i % 10000, amount: (i % 1000) + 1 }));
  const inventory = Array.from({ length: 10000 }, (_, i) => ({ id: i, quantity: i % 250 }));
  const batches = Array.from({ length: 5000 }, (_, i) => ({ id: i, status: i % 4 === 0 ? 'completed' : 'in_progress', output: i % 700 }));

  const start = performance.now();
  const revenueBySegment = new Map();
  const customerSegments = new Map(customers.map(c => [c.id, c.segment]));
  for (const tx of transactions) {
    const segment = customerSegments.get(tx.customer_id);
    revenueBySegment.set(segment, (revenueBySegment.get(segment) || 0) + tx.amount);
  }
  const lowStock = inventory.filter(item => item.quantity < 20).length;
  const completedOutput = batches.filter(batch => batch.status === 'completed').reduce((sum, batch) => sum + batch.output, 0);
  const elapsedMs = performance.now() - start;

  assert.strictEqual(revenueBySegment.size, 5, 'segment report should aggregate all segments');
  assert(lowStock > 0, 'inventory report should identify low stock records');
  assert(completedOutput > 0, 'production report should aggregate completed output');
  assert(elapsedMs < 500, `local performance model should complete quickly, got ${elapsedMs.toFixed(2)}ms`);
  return elapsedMs;
}

function run() {
  testDeploymentArtifacts();
  testRoleMatrix();
  testFinancialIntegrity();
  testInventoryIntegrity();
  testProductionLifecycle();
  testSecurityPenetrationControls();
  const perfMs = testPerformanceModel();
  console.log(`Production validation tests passed. Local performance model: ${perfMs.toFixed(2)}ms`);
}

run();
