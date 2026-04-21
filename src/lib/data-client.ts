import { supabase } from "@/integrations/supabase/client";
import { enqueue } from "@/lib/offline-queue";

export async function insertWithOfflineQueue(table: string, payload: Record<string, unknown>) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(table, payload);
    return { queued: true, error: null as Error | null };
  }
  const { error } = await supabase.from(table as never).insert(payload as never);
  return { queued: false, error: error as Error | null };
}

export async function flushOfflineQueue() {
  const { dequeueAll } = await import("@/lib/offline-queue");
  const items = dequeueAll();
  for (const item of items) {
    const { error } = await supabase.from(item.table as never).insert(item.payload as never);
    if (error) {
      enqueue(item.table, item.payload);
      break;
    }
  }
}

