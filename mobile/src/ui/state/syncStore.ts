import { create } from 'zustand';

/**
 * Upload-side counters for the "X çekildi · Y yüklendi" status (01 §5). Bumped
 * by the sync engine's onUploaded callback; capturedCount lives in captureStore.
 */
interface SyncState {
  uploadedCount: number;
  incUploaded: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  uploadedCount: 0,
  incUploaded: () => set((s) => ({ uploadedCount: s.uploadedCount + 1 })),
}));
