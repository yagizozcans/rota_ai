/**
 * Single source of truth for every tunable threshold and endpoint in the
 * mobile capture layer. No literal from this table may be duplicated elsewhere
 * in the codebase (IMPLEMENTATION-PLAN §5, ARCHITECTURE RULES). Every value is
 * traceable to a PRD clause or a recorded plan decision (Q1–Q10).
 */

export const config = {
  // --- Capture triggering (01 §3.2) ---
  /** Distance between frames on the primary distance trigger. */
  CAPTURE_DISTANCE_M: 5,
  /** GPS accuracy worse than this ⇒ fall back to the time trigger (Q3). */
  GPS_WEAK_FALLBACK_M: 30,
  /** Time-trigger interval seed when no reliable speed is known yet (Q3). */
  TIME_FALLBACK_SEED_MS: 1000,
  /** Clamp on the speed-derived time-trigger interval (Q3). */
  TIME_FALLBACK_MIN_MS: 500,
  TIME_FALLBACK_MAX_MS: 3000,

  // --- GPS accuracy indicator (01 §3.5 / §3.6) ---
  /** > this ⇒ frame flagged low-accuracy (red on HUD). Backend derives its own flag (Q6). */
  GPS_ACCURACY_FLAG_M: 20,
  /** > this (and ≤ FLAG) ⇒ amber on HUD; ≤ this ⇒ green. */
  GPS_ACCURACY_WARN_M: 10,

  // --- Storage / remaining-hours (01 §3.6) ---
  /** Remaining recording time below this ⇒ HUD turns red and warns. */
  STORAGE_WARN_MINUTES: 30,
  /** Seed for the average-frame-size moving average until real frames warm it. */
  AVG_FRAME_SIZE_SEED_KB: 400,

  // --- Image quality (01 §3.5, 02 §2) ---
  /** Laplacian variance (measured at 640px grayscale) below this ⇒ drop as blurry.
   *  Seed only — calibrate on pilot frames, bias low (Q2). */
  BLUR_VARIANCE_MIN: 25,
  /** Width the frame is downscaled to before measuring blur, so the threshold is
   *  resolution/device-independent (Q2). */
  BLUR_ANALYSIS_WIDTH: 640,
  /** JPEG quality on capture — full-res upload for small/distant-sign detection (Q10). */
  JPEG_QUALITY: 0.9,

  // --- Upload / sync (01 §3.4) ---
  /** Frames pulled from the queue per sync pass. */
  UPLOAD_BATCH: 5,
  /** How often the sync engine wakes to drain the outbox. */
  SYNC_INTERVAL_MS: 5000,
  /** Per-upload timeout — RN fetch() has none, so an unreachable host would hang
   *  forever (stuck progress bar, no retry). On timeout the upload fails → backoff. */
  UPLOAD_TIMEOUT_MS: 20000,
  /** Exponential backoff base and cap for failed uploads. */
  BACKOFF_BASE_MS: 2000,
  BACKOFF_MAX_MS: 300000,
  /** Optional escape hatch for pilots on metered SIMs — gate sync on Wi-Fi (Q10). */
  SYNC_WIFI_ONLY: false,

  // --- Weather (HUD-only, best-effort; never written to CaptureFrame — Q5/Q10) ---
  /** Cached temperature older than this is shown faded (stale). */
  TEMP_CACHE_TTL_MIN: 60,
} as const;

/**
 * Backend base URL. `10.0.2.2` is the Android emulator's alias for the host
 * machine's localhost. Real env injection arrives with the auth stopgap
 * (Slice 5, Q7); kept as a plain constant until then to avoid a premature dep.
 */
// LOCAL TEST VALUE (uncommitted): the Mac's LAN IP so the physical iPhone can
// reach the backend. Update if your Mac's IP changes; restore 10.0.2.2 for the
// Android emulator.
export const API_BASE_URL = 'http://192.168.1.240:8000';

/**
 * Pilot auth token (plan Q7 stopgap). A long-lived JWT injected at build time
 * for the pilot; empty in dev. sync/auth reads org_id + device_id from it, and
 * the uploader sends it as a Bearer token. TODO(Faz 3): real login + rotation.
 */
// LOCAL TEST VALUE (uncommitted): dev JWT (org=1111…, device=iphone-pilot) from
// POST /api/v1/auth/login. Without it the backend returns 401 on upload.
export const PILOT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMTExMTEiLCJkZXZpY2VfaWQiOiJpcGhvbmUtcGlsb3QiLCJyb2xlIjoic2FoYV9rdWxsYW5pY2kifQ.6fSvLQ1dhW4lQbVhzEA3v5UsIz5-GPXuD4EqkbMsNNc';

/** Backend endpoints (03 §4.1, plus the login endpoint agreed in Q7). */
export const ENDPOINTS = {
  login: '/api/v1/auth/login',
  sessions: '/api/v1/sessions',
  frames: '/api/v1/frames',
  sessionComplete: (sessionId: string) => `/api/v1/sessions/${sessionId}/complete`,
} as const;

export type Config = typeof config;
