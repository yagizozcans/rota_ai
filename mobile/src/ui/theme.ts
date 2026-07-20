/**
 * Dark HUD theme tokens. High contrast for readability in direct sunlight over
 * a live camera feed (UI DIRECTION). Kept minimal on purpose — status/indicator
 * colors (GPS green/amber/red, REC) are added in Slice 4 when the HUD lands.
 */
export const theme = {
  bg: '#000000',
  textPrimary: '#FFFFFF',
  /** Faded monospace text — e.g. the file-path tag (01 §3.6). */
  textFaint: 'rgba(255,255,255,0.45)',
} as const;

export type Theme = typeof theme;
