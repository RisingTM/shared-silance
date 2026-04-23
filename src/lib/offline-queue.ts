import { toast } from "sonner";

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

let initialized = false;
let offlineToastId: string | number | undefined;

export function initOfflineQueue(flush: () => Promise<void>) {
  if (typeof window === "undefined" || initialized) return () => undefined;
  initialized = true;

  const showOfflineToast = () => {
    if (navigator.onLine) return;
    if (offlineToastId !== undefined) return;
    offlineToastId = toast.message("You're offline — entries will sync when you reconnect", {
      duration: Infinity,
    });
  };
  const hideOfflineToast = () => {
    if (offlineToastId !== undefined) {
      toast.dismiss(offlineToastId);
      offlineToastId = undefined;
    }
  };

  const onOnline = () => {
    hideOfflineToast();
    flush().catch(() => undefined);
  };
  const onOffline = () => showOfflineToast();

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  if (!navigator.onLine) showOfflineToast();
  // Flush anything pending when the app starts online
  if (navigator.onLine) flush().catch(() => undefined);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    initialized = false;
  };
}
