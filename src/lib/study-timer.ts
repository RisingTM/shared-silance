// Persistent study timer state in localStorage so the timer survives navigation.

export type TimerPhase = "session" | "break";

export type TimerState = {
  phase: TimerPhase;
  startedAt: number; // epoch ms when current run segment started
  durationSec: number; // total duration for this phase
  subjectKey: string | null;
  subjectName: string | null;
  pausedAt: number | null; // when paused
  elapsedBeforePauseSec: number; // accumulated elapsed before current run segment
  sessionDurationSec: number; // user's preferred session duration (for next phase)
  breakDurationSec: number; // user's preferred break duration
};

export const KEY = (userId: string) => `silance_study_timer:${userId}`;

export function load(userId: string): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

export function save(userId: string, state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state === null) window.localStorage.removeItem(KEY(userId));
  else window.localStorage.setItem(KEY(userId), JSON.stringify(state));
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
