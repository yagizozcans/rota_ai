import { create } from 'zustand';
import type { GpsFix } from '../../capture/distanceTrigger';

/**
 * UI-facing capture state (Zustand holds UI state only — IMPLEMENTATION-PLAN §3).
 * The native capture loop pushes fixes/counts here; the HUD reads from it.
 */

/** Trailing window used to derive the current capture rate for remaining-hours. */
const RATE_WINDOW_MS = 60_000;

export interface Session {
  sessionId: string;
  startedAt: number;
}

interface CaptureState {
  recording: boolean;
  session: Session | null;
  /** Most recent GPS fix (drives the GPS + speed HUD elements). */
  fix: GpsFix | null;
  capturedCount: number;
  droppedCount: number; // wired in Slice 6 (blur filter)
  /** Free storage in bytes (null until first probe). */
  freeBytes: number | null;
  /** Epoch-ms timestamps of recent captures, pruned to RATE_WINDOW_MS. */
  recentCaptures: number[];

  startDrive: (session: Session) => void;
  stopDrive: () => void;
  setFix: (fix: GpsFix) => void;
  /** Record a capture: bump count and track cadence (for the remaining-hours rate). */
  onCaptured: (at: number) => void;
  onDropped: () => void;
  setFreeBytes: (bytes: number) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  recording: false,
  session: null,
  fix: null,
  capturedCount: 0,
  droppedCount: 0,
  freeBytes: null,
  recentCaptures: [],

  startDrive: (session) =>
    set({ recording: true, session, capturedCount: 0, droppedCount: 0, recentCaptures: [] }),

  stopDrive: () => set({ recording: false }),

  setFix: (fix) => set({ fix }),

  onCaptured: (at) =>
    set((s) => {
      const recentCaptures = [...s.recentCaptures, at].filter((t) => at - t <= RATE_WINDOW_MS);
      return { capturedCount: s.capturedCount + 1, recentCaptures };
    }),

  onDropped: () => set((s) => ({ droppedCount: s.droppedCount + 1 })),

  setFreeBytes: (bytes) => set({ freeBytes: bytes }),
}));
