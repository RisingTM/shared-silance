type QueueItem = { id: string; table: string; payload: Record<string, unknown>; createdAt: string };

const KEY = "shared-silance:offline-queue";

function read(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueue(table: string, payload: Record<string, unknown>) {
  const items = read();
  items.push({ id: crypto.randomUUID(), table, payload, createdAt: new Date().toISOString() });
  write(items);
}

export function dequeueAll() {
  const items = read();
  write([]);
  return items;
}

export function pendingCount() {
  return read().length;
}

