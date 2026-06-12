const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

function createContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    Date,
    setTimeout,
    clearTimeout
  };
  context.window = {
    authManager: { isMockMode: () => true },
    appState: { user: { id: 'tester', name: 'QA Tester', role: 'admin' } },
    edenUtils: {
      escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char])
    }
  };
  context.global = context;
  context.self = context.window;
  return context;
}

function loadModule(context, relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInNewContext(code, context, { filename: relativePath });
}

async function testCollectionReceiveIsIdempotent() {
  const ctx = createContext();
  loadModule(ctx, 'js/modules/collection.js');
  ctx.localStorage.setItem('eden_raw_materials', JSON.stringify([
    { id: 'raw-2', name: 'Refined HDPE', category: 'hdpe', quantity_kg: 32, unit_cost: 60, reorder_threshold_kg: 50 }
  ]));
  const before = JSON.parse(ctx.localStorage.getItem('eden_raw_materials') || '[]')
    .find(item => item.category === 'hdpe')?.quantity_kg || 0;
  await ctx.window.collectionModule.updateCollectionStatus('col-2', 'received', { received_at: new Date().toISOString() });
  await ctx.window.collectionModule.updateCollectionStatus('col-2', 'received', { received_at: new Date().toISOString() });
  const after = JSON.parse(ctx.localStorage.getItem('eden_raw_materials') || '[]')
    .find(item => item.category === 'hdpe')?.quantity_kg || 0;
  assert.strictEqual(after - before, 32, 'received collection should add raw stock once');
  const movements = JSON.parse(ctx.localStorage.getItem('eden_stock_movements') || '[]')
    .filter(item => item.source_type === 'collection' && item.source_id === 'col-2');
  assert.strictEqual(movements.length, 1, 'collection receive should create one stock movement');
}

async function testSalesPartialPaymentStaysPartial() {
  const ctx = createContext();
  loadModule(ctx, 'js/modules/sales.js');
  const invoice = JSON.parse(ctx.localStorage.getItem('eden_invoices')).find(item => item.id === 'inv-2');
  await ctx.window.salesModule.recordPayment(invoice.id, 1000);
  const updated = JSON.parse(ctx.localStorage.getItem('eden_invoices')).find(item => item.id === invoice.id);
  assert.strictEqual(updated.status, 'partial', 'partial payment should not mark invoice paid');
  assert.strictEqual(updated.paid_amount, 1000, 'partial payment should store paid amount');
  const payments = JSON.parse(ctx.localStorage.getItem('eden_payments') || '[]');
  assert(payments.some(item => item.invoice_id === invoice.id && item.amount === 1000), 'partial payment should add a payment row');
}

async function testProductionFinishedStockCreditedOnce() {
  const ctx = createContext();
  loadModule(ctx, 'js/modules/production.js');
  ctx.localStorage.setItem('eden_finished_products', JSON.stringify([
    { id: 'fin-2', name: 'HDPE Granules', quantity_kg: 100 }
  ]));
  ctx.window.inventoryModule = {
    updateFinishedProductStock: async (id, delta) => {
      const products = JSON.parse(ctx.localStorage.getItem('eden_finished_products'));
      const product = products.find(item => item.id === id);
      product.quantity_kg += Number(delta);
      ctx.localStorage.setItem('eden_finished_products', JSON.stringify(products));
      return product;
    }
  };
  await ctx.window.productionModule.completeBatch('prod-2', 700, 'A', 'QC pass');
  await ctx.window.productionModule.completeBatch('prod-2', 700, 'A', 'QC pass repeated');
  const product = JSON.parse(ctx.localStorage.getItem('eden_finished_products')).find(item => item.id === 'fin-2');
  assert.strictEqual(product.quantity_kg, 800, 'finished stock should be credited once');
}

async function testFinishedStockUpdateWritesLedgerOnce() {
  const ctx = createContext();
  loadModule(ctx, 'js/modules/inventory.js');
  const beforeProduct = JSON.parse(ctx.localStorage.getItem('eden_finished_products')).find(item => item.id === 'fin-1');
  await ctx.window.inventoryModule.updateFinishedProductStock('fin-1', 40000, {
    source_module: 'inventory',
    source_type: 'sales_demand',
    source_id: 'DEMAND-1780259157718:fin-1:finished_receipt',
    notes: 'Resolve blocked PET demand'
  });
  await ctx.window.inventoryModule.updateFinishedProductStock('fin-1', 40000, {
    source_module: 'inventory',
    source_type: 'sales_demand',
    source_id: 'DEMAND-1780259157718:fin-1:finished_receipt',
    notes: 'Duplicate click'
  });
  const afterProduct = JSON.parse(ctx.localStorage.getItem('eden_finished_products')).find(item => item.id === 'fin-1');
  assert.strictEqual(afterProduct.quantity_kg - beforeProduct.quantity_kg, 40000, 'finished stock demand receipt should be idempotent');
  const movements = JSON.parse(ctx.localStorage.getItem('eden_stock_movements') || '[]')
    .filter(item => item.source_type === 'sales_demand' && item.source_id === 'DEMAND-1780259157718:fin-1:finished_receipt');
  assert.strictEqual(movements.length, 1, 'finished stock update should write one stock movement');
  assert.strictEqual(movements[0].resulting_balance, afterProduct.quantity_kg, 'stock movement should store resulting balance');
}

function testLogoAssetExists() {
  const logo = path.join(root, 'assets', 'eden-recyclers-logo.jpg');
  const icon192 = path.join(root, 'assets', 'icons', 'icon-192.png');
  const icon512 = path.join(root, 'assets', 'icons', 'icon-512.png');
  assert(fs.existsSync(logo), 'real logo asset should exist');
  assert(fs.statSync(logo).size > 10000, 'real logo asset should not be an empty placeholder');
  assert(fs.existsSync(icon192), 'PWA 192px icon should exist');
  assert(fs.existsSync(icon512), 'PWA 512px icon should exist');
  assert(fs.statSync(icon192).size > 1000, 'PWA 192px icon should not be empty');
  assert(fs.statSync(icon512).size > 1000, 'PWA 512px icon should not be empty');
}

function testServiceWorkerDoesNotCacheHtmlShell() {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert(!sw.includes('/operations_overview.html'), 'service worker must not precache authenticated HTML');
  assert(sw.includes('STATIC_ASSET_PATTERN'), 'service worker should limit runtime caching to static assets');
}

function testRuntimeConfigRequiresInjectedEnvironment() {
  const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
  const supabaseClient = fs.readFileSync(path.join(root, 'js', 'supabase-client.js'), 'utf8');
  [config, auth, supabaseClient].forEach(source => {
    assert(!source.includes('your-project.supabase.co'), 'runtime source must not contain placeholder Supabase URL');
    assert(!source.includes('your-anon-key'), 'runtime source must not contain placeholder Supabase anon key');
  });
  assert(config.includes('window.EDEN_CONFIG_READY'), 'config should expose explicit readiness flag');
  assert(supabaseClient.includes('Supabase configuration is missing'), 'Supabase client should fail closed when production config is missing');
}

function testResetPasswordFlowExists() {
  const resetPath = path.join(root, 'reset-password.html');
  assert(fs.existsSync(resetPath), 'reset-password.html should exist');
  const reset = fs.readFileSync(resetPath, 'utf8');
  assert(reset.includes('auth.setSession'), 'reset page should hydrate Supabase session from reset token');
  assert(reset.includes('auth.updateUser'), 'reset page should update the password');
  const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
  assert(login.includes('eden_reset_cooldown_until'), 'forgot password should enforce a client-side cooldown');
}

function testSchemaHardeningExists() {
  const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
  assert(schema.includes('create table if not exists audit_logs'), 'schema should include audit_logs');
  assert(schema.includes('create table if not exists stock_movements'), 'schema should include stock movement ledger');
  assert(schema.includes("'collection'"), 'profile role vocabulary should include collection role used by RLS');
  assert(schema.includes("'materials_requested'"), 'baseline batches schema should use canonical production lifecycle states');
  assert(schema.includes('quantity_kg numeric(12,2) default 0'), 'finished_products should include quantity_kg used by inventory and sales workflows');
  assert(schema.includes('resulting_balance numeric(12,2)'), 'stock_movements should persist resulting ledger balance');
  assert(schema.includes('idempotency_key text'), 'financial and sales writes should have idempotency keys in the baseline schema');
  assert(schema.includes('revoke update on profiles from authenticated'), 'profiles role update should not be broadly writable');
  assert(schema.includes('grant update (full_name, phone, avatar_url) on profiles to authenticated'), 'profile self-update should be limited to non-privileged columns');
  assert(!schema.includes("auth.role() = 'authenticated'"), 'baseline schema should not use broad authenticated RLS policies');
  assert(!/with check\s*\(\s*true\s*\)/i.test(schema), 'baseline schema should not allow unconditional notification writes');
}

function testBackendEnforcementMigrationExists() {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260531_backend_enforcement.sql'), 'utf8');
  const requiredFunctions = [
    'post_stock_movement',
    'receive_collection',
    'request_production_batch',
    'approve_production_materials',
    'issue_production_materials',
    'start_production_work',
    'send_batch_to_qc',
    'record_batch_qc',
    'transition_production_batch',
    'create_sales_order',
    'generate_invoice_for_order',
    'record_invoice_payment',
    'dispatch_order'
  ];
  requiredFunctions.forEach(name => {
    assert(migration.includes(`function ${name}`), `migration should define ${name} RPC`);
  });
  [
    'materials_requested',
    'materials_approved',
    'materials_issued',
    'in_progress',
    'qc_pending',
    'qc_passed',
    'qc_failed',
    'completed',
    'rejected'
  ].forEach(state => {
    assert(migration.includes(`'${state}'`), `production state ${state} should be present`);
  });
  assert(migration.includes('prevent_payment_mutation'), 'payments should be immutable');
  assert(migration.includes('create unique index if not exists stock_movements_idempotency_idx'), 'stock movements should be idempotent');
  assert(migration.includes('create policy stock_movements_read'), 'stock movement RLS policies should be defined');
  assert(!migration.includes("auth.role() = 'authenticated'"), 'backend migration should not use broad authenticated policies');
  ['inventory', 'procurement', 'operations', 'finance', 'production', 'sales', 'hr'].forEach(role => {
    assert(migration.includes(`'${role}'`), `RLS matrix should include ${role} role`);
  });
}

function testComponentXssSinksAreHardened() {
  const toast = fs.readFileSync(path.join(root, 'js', 'components', 'toast.js'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'js', 'components', 'modal.js'), 'utf8');
  const table = fs.readFileSync(path.join(root, 'js', 'components', 'table.js'), 'utf8');

  assert(!/toast\.innerHTML\s*=/.test(toast), 'toast message rendering must not use innerHTML');
  assert(/messageEl\.textContent\s*=/.test(toast), 'toast message rendering should assign textContent');

  assert(!/card\.innerHTML\s*=/.test(modal), 'confirm modal title/message rendering must not use innerHTML');
  assert(!/containerElement\.innerHTML\s*=/.test(modal), 'empty and skeleton states must not template unsanitized HTML');
  assert(/heading\.textContent\s*=/.test(modal), 'confirm modal title should assign textContent');
  assert(/body\.textContent\s*=/.test(modal), 'confirm modal message should assign textContent');
  assert(/copy\.textContent\s*=/.test(modal), 'empty state message should assign textContent');
  assert(/btn\.textContent\s*=/.test(modal), 'empty state action text should assign textContent');

  assert(!/\.innerHTML\s*\+=/.test(table), 'table sort indicators must not append via innerHTML');
  assert(!/td\.innerHTML\s*=/.test(table), 'custom table renderers must not flow directly into innerHTML');
  assert(/td\.textContent\s*=/.test(table), 'table cells should render dynamic values with textContent');
}

function testInventoryDemandStockActionsExist() {
  const inventoryRoute = fs.readFileSync(path.join(root, 'js', 'routes', 'inventory', 'page.js'), 'utf8');
  [
    'data-adjust-finished-stock',
    'showFinishedStockAdjustmentModal',
    'data-demand-stock-update',
    'reserveDemandStock',
    'queueProductionEscalation',
    'notifySales'
  ].forEach(marker => {
    assert(inventoryRoute.includes(marker), `inventory demand flow should include ${marker}`);
  });
  assert(inventoryRoute.includes("source_type: context.demandId ? 'sales_demand' : 'manual_adjustment'"), 'demand stock updates should post to the stock ledger with sales demand reference');
}

function testRouteUserDataXssSinksAreEscaped() {
  const dangerous = `"><img src=x onerror=alert(1)><script>alert('x')</script>&`;
  const escaped = dangerous.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
  assert(!escaped.includes('<script>'), 'dangerous script tags should be escaped');
  assert(!escaped.includes('<img'), 'dangerous image tags should be escaped');
  assert(escaped.includes('&quot;&gt;&lt;img'), 'dangerous attribute/tag delimiters should be encoded');

  const router = fs.readFileSync(path.join(root, 'js', 'router.js'), 'utf8');
  const crmRoute = fs.readFileSync(path.join(root, 'js', 'routes', 'crm', 'page.js'), 'utf8');
  const inventoryRoute = fs.readFileSync(path.join(root, 'js', 'routes', 'inventory', 'page.js'), 'utf8');
  const productionRoute = fs.readFileSync(path.join(root, 'js', 'routes', 'production', 'page.js'), 'utf8');

  [
    'escapeHTML(s.name)',
    'escapeHTML(material.name)',
    'escapeHTML(supplier?.name || material.supplier_name',
    'escapeHTML(title)',
    'escapeHTML(value)'
  ].forEach(marker => assert(router.includes(marker), `router critical render path should include ${marker}`));

  [
    'escapeHTML(account.company_name)',
    'escapeHTML(account.contact_name)',
    'escapeHTML(account.region)',
    'escapeHTML(value || \'Not captured\')'
  ].forEach(marker => assert(crmRoute.includes(marker), `CRM customer render path should include ${marker}`));

  [
    'escapeHTML(material.name)',
    'escapeHTML(supplier.name)',
    'escapeHTML(type === \'demand\' ? demandSummary(item) : item.description)',
    'escapeHTML(line.product_name)',
    'escapeHTML(title)',
    'escapeHTML(description)'
  ].forEach(marker => assert(inventoryRoute.includes(marker), `Inventory render path should include ${marker}`));

  [
    'escapeHTML(type === \'demand\' ? demandSummary(item) : item.description)',
    'escapeHTML(line.product_name)',
    'escapeHTML(title)',
    'escapeHTML(description)',
    'escapeHTML(event.message)',
    'escapeHTML(value || \'Not captured\')'
  ].forEach(marker => assert(productionRoute.includes(marker), `Production task/material render path should include ${marker}`));
}

(async () => {
  await testCollectionReceiveIsIdempotent();
  await testSalesPartialPaymentStaysPartial();
  await testProductionFinishedStockCreditedOnce();
  await testFinishedStockUpdateWritesLedgerOnce();
  testLogoAssetExists();
  testServiceWorkerDoesNotCacheHtmlShell();
  testRuntimeConfigRequiresInjectedEnvironment();
  testResetPasswordFlowExists();
  testSchemaHardeningExists();
  testBackendEnforcementMigrationExists();
  testComponentXssSinksAreHardened();
  testInventoryDemandStockActionsExist();
  testRouteUserDataXssSinksAreEscaped();
  console.log('Regression tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
