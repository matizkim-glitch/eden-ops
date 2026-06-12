export type JsonRecord = Record<string, unknown>;

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T): T {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('eden:store-change', { detail: { key } }));
  return value;
}

export function appendStore<T extends JsonRecord>(key: string, item: T): T {
  const rows = readStore<T[]>(key, []);
  writeStore(key, [item, ...rows]);
  return item;
}

export function updateStore<T extends JsonRecord>(key: string, id: string, patch: Partial<T>): T[] {
  const rows = readStore<T[]>(key, []);
  const next = rows.map(row => (row.id === id ? { ...row, ...patch } : row));
  writeStore(key, next);
  return next;
}

export function subscribeStore(callback: () => void) {
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener('eden:store-change', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('eden:store-change', handler);
  };
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
