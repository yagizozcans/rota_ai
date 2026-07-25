import { create } from 'zustand';

/**
 * Upload-side UI state: the "X çekildi · Y yüklendi" counter (01 §5) plus the
 * frame currently in flight (for the HUD progress bar). Both are driven by the
 * sync engine via injected callbacks (the engine can't import ui — layer rule).
 */
interface SyncState {
  uploadedCount: number;
  /** Frame currently being uploaded, or null when idle. */
  currentUpload: { frameId: string } | null;
  incUploaded: () => void;
  startUpload: (frameId: string) => void;
  endUpload: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  uploadedCount: 0,
  currentUpload: null,
  incUploaded: () => set((s) => ({ uploadedCount: s.uploadedCount + 1 })),
  startUpload: (frameId) => set({ currentUpload: { frameId } }),
  endUpload: () => set({ currentUpload: null }),
}));
