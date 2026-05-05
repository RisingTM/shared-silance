// Persistent study timer state. Persists to localStorage AND Supabase
// (profiles.study_timer_state) so the timer syncs across devices.

import { supabase } from "@/integrations/supabase/client";

export type TimerPhase = "session" | "break";

export type TimerState = {
  phase: TimerPhase;
  startedAt: number; // epoch ms when current run segment started (resets on resume)
  originalStartedAt: number; // epoch ms when this phase first began (stable)
  durationSec: number; // total duration for this phase
  subjectKey: string | null;
  subjectName: string | null;
  pausedAt: number | null;
  elapsedBeforePauseSec: number;
  sessionDurationSec: number;
  breakDurationSec: number;
};

// Backwards-compat aliases for any old callers
export const load = loadLocal;
export const save = saveLocal;

export const KEY = (userId: string) => `silance_study_timer:${userId}`;

export function loadLocal(userId: string): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

export function saveLocal(userId: string, state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state === null) window.localStorage.removeItem(KEY(userId));
  else window.localStorage.setItem(KEY(userId), JSON.stringify(state));
}

// Remote sync — single source of truth on profiles.study_timer_state
export async function loadRemote(userId: string): Promise<TimerState | null> {
  const { data } = await supabase
    .from("profiles")
    .select("study_timer_state")
    .eq("id", userId)
    .maybeSingle();
  const v = (data as any)?.study_timer_state;
  return v ?? null;
}

export async function saveRemote(userId: string, state: TimerState | null) {
  await supabase
    .from("profiles")
    .update({ study_timer_state: state as any })
    .eq("id", userId);
}

export async function persist(userId: string, state: TimerState | null) {
  saveLocal(userId, state);
  try {
    await saveRemote(userId, state);
  } catch {
    /* offline — local will sync on next save */
  }
}

export function elapsedSec(state: TimerState): number {
  if (state.pausedAt !== null) return state.elapsedBeforePauseSec;
  return state.elapsedBeforePauseSec + Math.floor((Date.now() - state.startedAt) / 1000);
}

export function remainingSec(state: TimerState): number {
  return Math.max(0, state.durationSec - elapsedSec(state));
}

export function isPaused(state: TimerState): boolean {
  return state.pausedAt !== null;
}

export function pause(state: TimerState): TimerState {
  if (state.pausedAt !== null) return state;
  return {
    ...state,
    elapsedBeforePauseSec: elapsedSec(state),
    pausedAt: Date.now(),
  };
}

export function resume(state: TimerState): TimerState {
  if (state.pausedAt === null) return state;
  return {
    ...state,
    pausedAt: null,
    startedAt: Date.now(),
  };
}

export function fmtMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// "0h 30 min" / "1h 05 min" / "45 min" / "0 min"
export function fmtHourMin(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")} min`;
}
