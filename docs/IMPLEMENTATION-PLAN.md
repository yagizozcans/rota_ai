# IMPLEMENTATION PLAN — 01 Mobile Capture Layer

**Status:** APPROVED — Q1–Q10 resolved inline in §9 (see ✅ DECISION blocks). Proceed to Slice 1. Three PRD amendments required before/with Slice 5 — see §9.11.
**Scope:** `docs/01-mobile-capture.md` only. Contracts from `docs/00-overview.md §4`. Hard upstream dependency: `docs/03-backend-api.md §4.1` (upload endpoints).

---

## 1. Placement

New sibling package at repo root: **`./mobile`** (alongside `backend/`, `ai-pipeline/`, `review-console/`). Self-contained React Native project. Nothing outside `./mobile` is touched.

---

## 2. Fixed stack (per instructions — no substitution)

| Concern | Library |
|---|---|
| Runtime | React Native, TypeScript **strict** |
| Camera | `react-native-vision-camera` |
| Location | `react-native-geolocation-service` + device sensors (heading) |
| Offline store | `react-native-sqlite-storage` |
| State | Zustand |

**Additive helper deps that are NOT substitutions but still need your OK** (see §9 — Q6). The five above cannot cover: orientation lock, filesystem, free-disk, connectivity, device id, sensors, background execution. I will not add any of them until approved.

---

## 3. Layer architecture

Dependency direction is strictly **downward**. Arrow = "may import".

```
            ┌─────────────┐
            │     ui      │  React components + Zustand stores + theme
            └──────┬──────┘
        ┌──────────┼───────────┐
        ▼          ▼           ▼
   ┌────────┐  ┌────────┐  (ui also → storage)
   │capture │  │  sync  │
   └───┬────┘  └───┬────┘
       └─────┬─────┘
             ▼
        ┌────────┐
        │storage │
        └───┬────┘
            ▼
     config / types   (shared leaves — imported by everyone, import nothing)
```

Rules enforced:
- **No upward imports.** `storage` never imports `capture/sync/ui`; `capture` and `sync` never import `ui`.
- **`capture` ⟂ `sync`** — no imports between them. They meet only through the SQLite queue in `storage`. This is what lets **sync run with the camera closed**: `sync` is a headless module driven by the DB, not by any capture/UI object.
- `capture → storage` (persist frame) and `sync → storage` (drain queue) are the only cross-layer edges below UI.
- Pure logic (haversine distance, backoff math, blur variance) lives in plain functions, unit-testable, no RN/Zustand imports. Zustand holds **UI-facing state only**.

Enforcement: an ESLint `no-restricted-imports` rule per folder (added in Slice 1) so a violating import fails lint, not just code review.

---

## 4. File tree

```
mobile/
  package.json  tsconfig.json (strict)  babel.config.js  metro.config.js
  app.json
  index.js                       # registers <App/> AND the headless sync task
  android/                       # orientation lock, permissions, foreground-service manifest
  src/
    config/
      index.ts                   # ⭐ ALL thresholds + endpoints. Single source. §5
    types/
      captureFrame.ts            # CaptureFrame — derived EXACTLY from 00-overview §4.1
      models.ts                  # QueuedFrame (local row), UploadResult, enums
    storage/                     # LAYER: persistence. imports config/types only
      db.ts                      # open DB, run migrations
      migrations.ts              # versioned schema
      frameRepo.ts               # enqueue / listPending / markUploaded / markFailed
      files.ts                   # write/read/delete JPEG in app sandbox
      diskSpace.ts               # free bytes (for remaining-hours)
    capture/                     # LAYER: produce frames. imports storage/config/types
      location.ts                # GPS stream + heading fusion (course vs magnetometer)
      distanceTrigger.ts         # accumulate haversine → 5m; time-fallback when GPS weak
      camera.ts                  # vision-camera still capture wrapper
      blur.ts                    # Laplacian variance (pure fn)
      metadata.ts                # assemble CaptureFrame fields the device owns
      captureController.ts       # trigger → capture → blur gate → enqueue
    sync/                        # LAYER: upload. imports storage/config/types
      net.ts                     # connectivity watch
      auth.ts                    # token store + org_id/device_id extraction
      backoff.ts                 # exponential backoff (pure fn)
      uploader.ts                # multipart POST /frames
      syncEngine.ts              # loop: pending → upload → confirm → delete local
    ui/                          # LAYER: React + Zustand. imports capture/sync/storage
      App.tsx
      theme.ts                   # dark HUD tokens, sunlight-contrast palette
      state/
        captureStore.ts          # recording?, session, live gps/hud snapshot
        syncStore.ts             # queued/uploaded counts, last error
      screens/CaptureScreen.tsx  # live camera + HUD + controls
      hud/
        HudOverlay.tsx
        RemainingHours.tsx
        TempIndicator.tsx        # best-effort; "~" when no source (§3.6)
        GpsAccuracy.tsx          # color-coded green/amber/red
        FilePathTag.tsx          # bottom-left faded monospace
        RecDot.tsx               # blinking, no timer
      controls/
        ControlStack.tsx         # right-side vertical stack
        BigButton.tsx            # ≥64dp touch target
        RecordButton.tsx  PhotoButton.tsx  AttributesButton.tsx  # placeholder
    permissions/
      usePermissions.ts          # camera + location gate, explicit states
```

---

## 5. Config — single source of truth (`src/config/index.ts`)

Every threshold the instructions named lives here; **no literal repeated in code**. Proposed defaults (all doc-referenced) — challenge any before Slice 1:

| Key | Default | Source |
|---|---|---|
| `CAPTURE_DISTANCE_M` | `5` | 01 §3.2 |
| `GPS_ACCURACY_FLAG_M` | `20` | 01 §3.5 / §3.6 |
| `GPS_ACCURACY_WARN_M` | `10` | 01 §3.6 (amber threshold) |
| `GPS_WEAK_FALLBACK_M` | `30` | ✅ resolved (Q3) — accuracy worse than this ⇒ switch to time trigger |
| `TIME_FALLBACK_SEED_MS` | `1000` | ✅ resolved (Q3) — seed when no reliable speed; interval is speed-derived |
| `TIME_FALLBACK_MIN_MS` / `MAX_MS` | `500` / `3000` | ✅ resolved (Q3) — clamp on the speed-derived interval |
| `STORAGE_WARN_MINUTES` | `30` | 01 §3.6 |
| `BLUR_VARIANCE_MIN` | `25` (seed) | ✅ resolved (Q2) — measured at 640 px grayscale; calibrate on pilot frames, bias low |
| `SYNC_WIFI_ONLY` | `false` | ✅ resolved (Q10) — optional Wi-Fi-only sync gate for metered SIMs |
| `AVG_FRAME_SIZE_SEED_KB` | `400` | seed for remaining-hours until moving average warms |
| `JPEG_QUALITY` | `0.9` | full-res upload for small-sign detection (02 §2) |
| `UPLOAD_BATCH` | `5` | sync loop batch |
| `BACKOFF_BASE_MS` | `2000` | 01 §3.4 exponential backoff |
| `BACKOFF_MAX_MS` | `300000` | cap (5 min) |
| `TEMP_CACHE_TTL_MIN` | `60` | 01 §3.6 (stale after 60 min) |
| `API_BASE_URL` | env | 03 |
| `ENDPOINTS` | `/api/v1/sessions`, `/api/v1/frames`, `/api/v1/sessions/{id}/complete` | 03 §4.1 |

---

## 6. `CaptureFrame` type — derived EXACTLY from 00-overview §4.1

Per the non-negotiable rule, the TS type mirrors §4.1 and **invents no fields**:

```ts
// src/types/captureFrame.ts — MUST match 00-overview §4.1 exactly.
export interface CaptureFrame {
  frame_id: string;      // uuid, client-generated
  org_id: string;        // uuid, from auth token (§4.1 note: token is authority)
  session_id: string;    // uuid — see Q3 (client-generated for offline)
  device_id: string;
  timestamp: string;     // ISO8601
  gps: { lat: number; lon: number; accuracy_m: number; speed_kmh: number };
  heading_deg: number;
  image_ref: string;     // storage path — see Q4 (who owns it in multipart)
}
```

Fields referenced elsewhere but **deliberately excluded** because §4.1 does not contain them: `weather_temp_c` (Q5), any `manual`/blur/quality flag (Q6-behavioral). See Open Questions.

---

## 7. Data flow

**Capture path** (only while `recording`):
1. Record tapped → `captureStore.recording = true`; `session_id` generated locally (UUIDv4).
2. `location.ts` streams GPS fixes → live snapshot into `captureStore` (for HUD).
3. `distanceTrigger` sums haversine distance between fixes; at ≥ `CAPTURE_DISTANCE_M` it fires. If GPS accuracy worse than `GPS_WEAK_FALLBACK_M`, it fires on `TIME_FALLBACK_MS` instead.
4. `captureController`: `camera.takePhoto()` → JPEG in sandbox → `blur.variance()`. Below `BLUR_VARIANCE_MIN` ⇒ delete file, increment "dropped" counter, **not uploaded** (Q6). Else `metadata.assemble()` → `frameRepo.enqueue(frame, localPath, status='pending')`.
5. Photo button → same pipeline, bypassing the distance trigger.

**Sync path** (independent loop; runs during drive and after, camera open or closed):
1. `syncEngine` wakes on connectivity/interval. Offline ⇒ idle, queue untouched.
2. `frameRepo.listPending(UPLOAD_BATCH)` → for each: `uploader` sends multipart (JPEG + CaptureFrame JSON) to `POST /api/v1/frames` with `Authorization: Bearer <token>`.
3. `2xx` ⇒ `frameRepo.markUploaded` + `files.delete(localPath)` (local copy removed **only after confirmed upload** — 01 §3.3).
4. Failure ⇒ `frameRepo.markFailed(nextBackoff)`; row stays queued. Survives app kill (SQLite). On relaunch, leftover `pending` rows resume.

**HUD reads:** `captureStore` (gps accuracy, recording), `syncStore` (queued/uploaded), `diskSpace` + avg frame size (remaining hours), temp source (best-effort).

---

## 8. Delivery slices → acceptance criteria (01 §6)

Each slice is independently runnable, committed, diff shown before proceeding. Each ends with an explicit §6 check.

| # | Slice | Satisfies (01 §6) |
|---|---|---|
| 1 | Skeleton + **landscape lock** + navigation + `config` + eslint layer rule | "yatay yönde kilitli" |
| 2 | SQLite schema + `CaptureFrame` types + `storage` layer | (foundation for "kareler kaybolmuyor") |
| 3 | Camera + distance trigger + metadata | "~5m aralıkla doğru GPS ile toplanıyor" |
| 4 | HUD overlay + 3 buttons + REC dot | HUD hours/temp/GPS/path; buttons; REC; GPS color |
| 5 | Upload queue + retry + auth token | "sinyal gelince yükleniyor"; "doğru session_id ve metadata"; manual photo lands |
| 6 | Blur filter (Laplacian) + quality handling | "bulanık kareler filtreleniyor" |

Criteria needing the **backend** to fully verify ("backend'de … görünüyor") will be verified against `03 §4.1`; if the backend endpoint isn't up, I'll verify the outbound request shape and say so explicitly rather than claim end-to-end.

---

## 9. Open questions / PRD conflicts — **need your call, not guessing**

**Q1 — Offline session creation conflict (blocking Slice 3/5 contract).**
`03 §4.1` has `POST /api/v1/sessions` returning a server-generated `session_id`. But offline-first (`01 §3.3`) means a drive can start with no signal, so `session_id` must exist **before** any server call. Proposal: **client generates `session_id` (UUIDv4) locally**; `POST /sessions` becomes an idempotent registration of that client id (or is dropped entirely and the session is implied by the first frame's `session_id`). Confirm the contract, or tell me the backend must mint it (which would break offline start).

> ✅ **DECISION (Q1): Client mints `session_id` (UUIDv4). Server never mints.** Offline-first wins; a server-minted id is incompatible with starting a drive with no signal. Contract:
> - `POST /api/v1/sessions` becomes an **idempotent upsert**: body carries client `session_id` + `device_id` + `started_at`; repeated calls with the same id are a no-op `200`. Mobile calls it opportunistically when online (not as a precondition).
> - `POST /api/v1/frames` **lazily auto-registers** an unknown `session_id` (owned by the token's `org_id`), so registration is never a blocking dependency and frame upload order doesn't matter.
> - Requires amending `03 §4.1` — see §9.11.

**Q2 — Blur threshold value.** `BLUR_VARIANCE_MIN` cannot be honestly guessed; Laplacian variance is scale/exposure dependent. Plan: ship Slice 6 with the threshold in config + a brief calibration note, default conservative, tuned on real sample frames. OK to defer the exact number to calibration, or do you have a target?

> ✅ **DECISION (Q2): Defer the number to calibration — approved — with three binding rules:**
> 1. **Normalize before measuring:** compute Laplacian variance on a grayscale copy downscaled to a fixed width (640 px), so the threshold is resolution/device-independent and the calibrated number stays valid.
> 2. **Bias low (conservative seed, e.g. ~25 at 640 px):** only obvious motion blur drops. A soft frame uploaded is recoverable (review console rejects it); a sharp frame deleted on-device is data loss. When in doubt, keep.
> 3. **Log every frame's variance locally during the pilot** (variance value + kept/dropped) so calibration uses real field data, not guesses. This log feeds the tuning session after the first 10 km drive.

**Q3 — GPS-weak fallback numbers.** `01 §3.2` mandates a time-interval fallback "when GPS is weak" but gives no trigger threshold or interval. I propose `GPS_WEAK_FALLBACK_M = 30` and `TIME_FALLBACK_MS = 2000`. Accept or set your own.

> ✅ **DECISION (Q3): `GPS_WEAK_FALLBACK_M = 30` accepted. Fixed `TIME_FALLBACK_MS = 2000` rejected — too sparse.** At 50 km/h a 2 s interval means ~28 m between frames (vs the 5 m target), so weak-GPS stretches would produce large inventory gaps. Instead the time fallback is **speed-derived**:
> `interval_ms = (CAPTURE_DISTANCE_M / last_reliable_speed_mps) × 1000`, clamped to **[500 ms, 3000 ms]**, seeded at **1000 ms** when no reliable speed is known. Config keys become `TIME_FALLBACK_SEED_MS = 1000`, `TIME_FALLBACK_MIN_MS = 500`, `TIME_FALLBACK_MAX_MS = 3000` (table in §5 updated). Still a pure function in `distanceTrigger.ts`, unit-testable.

**Q4 — `image_ref` ownership in multipart upload.** `00 §4.1` says `image_ref` = final storage path (`{org_id}/{session_id}/{frame_id}.jpg`, deterministic and known client-side). In a multipart upload the client sends the **file**, and the backend writes the path. Does the client (a) send the deterministic key in the JSON, (b) leave `image_ref` empty and let backend fill it, or (c) send its local path? This changes what we serialize. Proposal: client sends the deterministic key (all inputs known), backend treats it as advisory and remains authoritative. Confirm.

> ✅ **DECISION (Q4): Option (a), confirmed.** Client fills `image_ref` with the deterministic key `{org_id}/{session_id}/{frame_id}.jpg`, using the `org_id` from its token. Backend **recomputes the key from the token's `org_id` + ids and is authoritative** (consistent with `00 §4.5`: never trust the client for tenancy). On mismatch: backend **overwrites with its own key and logs a warning — it does not reject the upload** (a field device must never lose a frame over an advisory field; a mismatch signals a bug, not a reason to drop data). Option (c) (local path) is forbidden. Note this in `00 §4.1` — see §9.11.

**Q5 — `weather_temp_c` is not in the canonical contract.** `01 §3.6` says temperature "may also be written to frame metadata as optional `weather_temp_c`", but `00 §4.1` CaptureFrame has no such field, and the rule is "match §4.1 exactly, do not invent fields." **Per the rule I am excluding `weather_temp_c` from the upload** — temperature stays HUD-only. If you want it persisted, `00 §4.1` must be amended first; say so and I'll update the contract before coding.

> ✅ **DECISION (Q5): Exclusion confirmed — temperature is HUD-only in MVP. Do NOT amend `00 §4.1`.** No MVP consumer exists for it: the AI pipeline (02), GIS (04), and review console (05) never read temperature, and per Q10 the value is usually a cached weather-API estimate anyway — too soft to bake into the canonical contract. Revisit only if/when the Faz 3 weather/winter-maintenance module (`00 §6`) actually lands; amend the contract then, not speculatively now.

**Q6 — Quality flags have no field in `CaptureFrame`.** `01 §3.5` says to *mark* frames with GPS accuracy > 20m and *detect* blur, but `§4.1` has no flag field. My interpretation, consistent with "don't invent fields" + acceptance criterion "bulanık kareler filtreleniyor":
  - **GPS > 20m:** no new field — backend derives it from `gps.accuracy_m` it already receives.
  - **Blurry:** dropped locally (filtered), never uploaded.
  Confirm this, or if the backend expects blurry frames *uploaded with a flag*, then `§4.1` needs a field (see Q5 pattern).

> ✅ **DECISION (Q6): Both interpretations confirmed.**
> - **GPS > 20 m:** no new field. Backend derives the flag from `gps.accuracy_m`, which it already receives in full — `01 §3.5` says "mark" so the *information* must arrive, and it does. Deriving server-side also lets the threshold be retuned without a mobile release. (Add a one-line note to `03 §5` that coordinatization down-weights frames with `accuracy_m > 20` — see §9.11.)
> - **Blurry:** drop locally, never upload. This is exactly `01 §3.5`'s stated purpose ("gereksiz veri yüklemeyi azaltır") and satisfies the "bulanık kareler filtreleniyor" acceptance criterion. Keep the local dropped-counter + per-frame variance log (Q2 rule 3) and surface "X çekildi / Y elendi / Z yüklendi" in session status, which also satisfies `01 §5`.

**Q7 — Auth/login endpoint undefined.** `01 §4` and `00 §4.1` require a token (source of `org_id`, `device_id` binding), but `03 §4` lists **no login endpoint**. Where does the mobile token come from for the pilot? Proposal for MVP: assume `POST /api/v1/auth/login → { token }` (JWT carrying `org_id`), and until the backend exposes it, inject a pilot token via secure config so Slices 1-4 run. Confirm the endpoint or the stopgap.

> ✅ **DECISION (Q7): Both approved.** Canonical contract: `POST /api/v1/auth/login` (credentials → `{ token }`, JWT carrying `org_id` + role + `device_id` binding) — this was always implied by `03 §2` "JWT tabanlı auth" and `03 §6`, it just never got an endpoint; amend `03 §4` to add it (see §9.11). **Stopgap for Slices 1–4:** a long-lived pilot JWT injected via env/secure build config, read by `sync/auth.ts` behind the same interface, so swapping to the real endpoint later touches one module. Token refresh/rotation is out of MVP scope; long-lived pilot tokens are acceptable. Store the token in the app sandbox for the pilot; Keystore-backed storage is a noted hardening item for Faz 3, not a new dependency now.

**Q8 — Additive dependencies (not substitutions, but need approval).** The fixed five can't cover these; each is load-bearing for a named requirement:
  - `react-native-orientation-locker` — landscape lock (§3.7)
  - `react-native-fs` — JPEG files + free-disk for remaining-hours (§3.3, §3.6)
  - `@react-native-community/netinfo` — connectivity for sync (§3.3)
  - `react-native-device-info` — stable `device_id` (§4.1)
  - `react-native-sensors` — magnetometer heading at low speed (§2)
  - `react-native-uuid` (or `crypto.randomUUID` polyfill) — client-side ids
  - background execution: **foreground service** during a drive + **WorkManager/Headless JS** to retry the queue after app kill — see Q9
  Approve the list (or name replacements).

> ✅ **DECISION (Q8): All approved.** Every item traces to a named requirement and none substitutes the fixed five. Two implementation notes:
> - **UUIDs:** Hermes does not ship `crypto.randomUUID`/`getRandomValues` — use `react-native-get-random-values` + `uuid` (this pair replaces the `react-native-uuid` line item; it's the standard, maintained combo).
> - **Filesystem:** if upstream `react-native-fs` gives install trouble on the current RN version (it's lightly maintained), the drop-in maintained fork `@dr.pogodin/react-native-fs` is pre-approved — same API, no plan change.
> Background-execution deps (foreground service + WorkManager/Headless JS) are approved per the Q9 scope below. No other dependency may be added without a new question.

**Q9 — Background-upload scope.** "Frames survive app kill" (SQLite ✓, guaranteed) and "sync works with camera closed" (✓, in-app headless module). **True upload while the OS has killed the app** is a bigger ask needing Android WorkManager. Proposal for MVP: foreground service keeps the process alive for the whole drive (capture + live sync); a WorkManager job drains leftover `pending` rows after relaunch. Is in-app + on-relaunch sync sufficient for MVP, or is upload-while-fully-killed required?

> ✅ **DECISION (Q9): In-app + on-relaunch is sufficient. Upload-while-fully-killed is NOT required for MVP.** Rationale: during a drive the app is the mounted capture device and must be foregrounded anyway (continuous camera + GPS require it), so a **foreground service for the whole drive** covers capture + live sync; after the drive, the vehicle returns somewhere with connectivity and the operator reopens the app or the **WorkManager job drains leftover `pending` rows** (constraint: network available). The hard, non-negotiable guarantee is the one already met: **no frame is ever lost** (SQLite queue survives kill/reboot). Build the WorkManager drain job in Slice 5; treat killed-state live upload as Faz 3.

**Q10 — Field-reality warnings (flagging before building, per rules):**
  - **Ambient temperature:** most Android devices have **no** `TYPE_AMBIENT_TEMPERATURE` sensor. In practice temp will come from a cached weather API, which needs network + a provider/key. `§3.6`'s "~ when no source" fallback already covers this, so the HUD degrades gracefully — but if there's no weather provider decision, temp is effectively always "~". Which weather provider (and is temp worth the network dependency for MVP)?
  - **Full-resolution upload:** `02 §2` leans on small/distant-sign detection. The capture layer must upload full-res JPEG (no aggressive downscale), which raises per-frame size and directly shortens the remaining-hours estimate. Flagging the storage/bandwidth tradeoff now.

> ✅ **DECISION (Q10):**
> - **Weather provider: Open-Meteo.** Free, no API key, trivially cacheable — fetch nearest-point temperature at session start and hourly while online, cache per `TEMP_CACHE_TTL_MIN`, fail-soft to "~" exactly as `01 §3.6` specifies. Since Q5 keeps temperature HUD-only, this is a ~30-line best-effort fetch, not a real dependency; if Open-Meteo is unreachable the drive proceeds untouched. No paid provider, no key management, for MVP.
> - **Full-res upload: tradeoff accepted.** Upload at native capture resolution, `JPEG_QUALITY` 0.85–0.9 — distant-sign detection (`02 §2`, the product's core value) outranks bandwidth. Two mitigations, both nearly free: (1) the distance trigger already caps volume at ~200 frames/km; (2) add config flag `SYNC_WIFI_ONLY` (default `false`) — netinfo already reports connection type, so gating the sync loop on Wi-Fi is one condition, giving pilots on metered SIMs an escape hatch. Revisit sizing after the first pilot using the real moving-average frame size the HUD already computes.

### 9.11 PRD amendments required by these decisions

Apply before or together with the slice that depends on them; each is a small, targeted edit:

1. **`03 §4.1`** (needed by Slice 5): `POST /sessions` accepts a client-supplied `session_id` and is an idempotent upsert; `POST /frames` lazily auto-registers unknown sessions under the token's `org_id`. *(Q1)*
2. **`03 §4`** (needed by Slice 5): add `POST /api/v1/auth/login` → JWT (`org_id`, role, `device_id`). *(Q7)*
3. **`00 §4.1`** (note only): `image_ref` is filled client-side with the deterministic key as an advisory value; the backend recomputes from the token and remains authoritative. Plus a one-line note in `03 §5` that frames with `gps.accuracy_m > 20` are down-weighted at coordinatization. *(Q4, Q6)*

Per `08-dev-memory-workflow.md §4`, record each of these ten decisions as a clear one-line statement at the end of the working session so claude-mem captures them.

---

## 10. What I will NOT do
- No mock data left in the tree (test fixtures clearly isolated).
- No fields beyond `00 §4.1` in `CaptureFrame`.
- No speculative abstractions (CLAUDE.md §2) — each module traces to a named requirement.
- No slice advances without showing you the diff and answering its §6 check.

**Approved.** Q1–Q10 are resolved in §9 (✅ DECISION blocks) and the config table in §5 reflects them. Apply the three PRD amendments in §9.11 with the slices that need them. **Proceed to Slice 1.**
