const fs = require('fs');
const vm = require('vm');

const listeners = {};
const storage = new Map();

const noopElement = {
  classList: { add() {}, remove() {}, contains() { return false; } },
  style: {},
  dataset: {},
  innerText: '',
  innerHTML: '',
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  setAttribute() {},
  removeAttribute() {},
  appendChild() {},
  prepend() {},
  remove() {}
};

const context = {
  console,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  confirm: () => false,
  alert: () => {},
  navigator: { onLine: true },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  window: {
    location: { hostname: '127.0.0.1', origin: 'http://127.0.0.1:8000', pathname: '/operations_overview.html', href: '' },
    history: { length: 1, back() {} },
    addEventListener: (event, cb) => { listeners[event] = cb; },
    ENV: {}
  },
  document: {
    body: noopElement,
    createElement: () => ({ ...noopElement }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (event, cb) => { listeners[event] = cb; }
  },
  supabase: {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signOut: async () => ({})
      }
    })
  }
};

context.window.window = context.window;
context.window.document = context.document;
context.window.navigator = context.navigator;
context.window.localStorage = context.localStorage;
context.window.console = console;
context.window.supabase = context.supabase;
context.global = context;

vm.createContext(context);

[
  'js/config.js',
  'js/supabase-client.js',
  'js/state.js',
  'js/auth.js',
  'js/utils.js',
  'js/components/toast.js',
  'js/components/modal.js',
  'js/components/table.js',
  'js/components/charts.js',
  'js/notifications.js',
  'js/modules/collection.js',
  'js/modules/inventory.js',
  'js/modules/production.js',
  'js/modules/sales.js',
  'js/modules/hr.js',
  'js/modules/finance.js',
  'js/modules/dashboard.js',
  'js/router.js'
].forEach(file => {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

if (listeners.DOMContentLoaded) {
  Promise.resolve(listeners.DOMContentLoaded()).then(() => {
    console.log('Smoke test passed');
  });
} else {
  console.log('Smoke test passed');
}
