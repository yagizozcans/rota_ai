/**
 * Dark HUD theme tokens. High contrast for readability in direct sunlight over
 * a live camera feed (UI DIRECTION). Colors are picked to stay legible on top
 * of an arbitrary bright camera image, so indicators sit on translucent-dark
 * chips rather than relying on the underlying pixels.
 */
export const theme = {
  bg: '#000000',
  textPrimary: '#FFFFFF',
  /** Faded monospace text — e.g. the file-path tag (01 §3.6). */
  textFaint: 'rgba(255,255,255,0.45)',
  /** Dark scrim behind HUD chips so text stays readable over bright scenes. */
  scrim: 'rgba(0,0,0,0.55)',

  // GPS-accuracy status (01 §3.6): green ≤10 m, amber ≤20 m, red >20 m.
  gpsGood: '#22C55E',
  gpsWarn: '#F59E0B',
  gpsBad: '#EF4444',

  /** Recording indicator + storage-low warning. */
  rec: '#EF4444',
  warn: '#EF4444',

  /** Big control buttons. */
  buttonBg: 'rgba(38,38,38,0.9)',
  buttonActiveBg: 'rgba(239,68,68,0.9)',
  buttonDisabled: 'rgba(64,64,64,0.5)',
} as const;

export type Theme = typeof theme;
