export function today() {
  return new Date().toISOString().split('T')[0];
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function readList<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function writeList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function seedList<T extends { id: string }>(key: string, defaults: T[]) {
  const current = readList<T>(key, []);
  const byId = new Map(current.map(item => [item.id, item]));

  defaults.forEach(item => {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? ({ ...item, ...existing } as T) : item);
  });

  writeList(key, Array.from(byId.values()));
}
