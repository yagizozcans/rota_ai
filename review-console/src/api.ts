// API client — matches docs/03-backend-api.md §4.2 and docs/00-overview.md §4.
// Talks directly to the backend (CORS is open for MVP dev, see backend/app/main.py).

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Tenant the console reviews (docs/04 §4). The backend enforces Row-Level
// Security, so every tenant endpoint needs a Bearer token carrying this org_id;
// defaults to the pilot org seeded in db/init/01_schema.sql. The token is minted
// once via the pilot login (plan Q7) and cached for the session.
const ORG_ID = import.meta.env.VITE_ORG_ID ?? '11111111-1111-1111-1111-111111111111'

let tokenPromise: Promise<string> | null = null

function getToken(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: ORG_ID, device_id: 'review-console', role: 'harita_muhendisi' }),
    })
      .then(asJson<{ token: string }>)
      .then((d) => d.token)
      .catch((err) => {
        tokenPromise = null // let the next call retry a failed login
        throw err
      })
  }
  return tokenPromise
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getToken()}`, ...extra }
}

export type Severity = 'low' | 'medium' | 'high'
export type Decision = 'approved' | 'rejected' | 'corrected'

export interface ReviewQueueItem {
  item_id: string
  detection_id: string
  class: string
  type: string
  confidence: number | null
  bbox: [number, number, number, number] | null // [x, y, w, h] original image pixels
  image_ref: string | null
  lat: number | null
  lon: number | null
  review_status: string
}

export interface ReviewDecisionPayload {
  decision: Decision
  corrected_class?: string
  severity?: Severity
}

// Full item detail for the archive panel — GET /api/v1/inventory?status=...
// Superset of ReviewQueueItem: adds ids/timestamps once an item leaves the queue.
export interface InventoryItem {
  item_id: string
  detection_id: string
  class: string
  type: string
  severity: Severity | null
  confidence: number | null
  bbox: [number, number, number, number] | null
  model_version: string | null
  image_ref: string | null
  lat: number | null
  lon: number | null
  review_status: string
  reviewer_id: string | null
  reviewed_at: string | null
  created_at: string | null
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`)
  }
  return res.json() as Promise<T>
}

export async function fetchQueue(): Promise<ReviewQueueItem[]> {
  return fetch(`${API_BASE}/api/v1/review/queue`, { headers: await authHeaders() }).then(
    asJson<ReviewQueueItem[]>,
  )
}

export function fetchTaxonomy(): Promise<string[]> {
  return fetch(`${API_BASE}/api/v1/taxonomy`)
    .then(asJson<{ asset_classes: string[] }>)
    .then((d) => d.asset_classes)
}

export async function submitDecision(
  itemId: string,
  payload: ReviewDecisionPayload,
): Promise<unknown> {
  return fetch(`${API_BASE}/api/v1/review/${itemId}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }).then(asJson)
}

export function imageUrl(imageRef: string): string {
  return `${API_BASE}/media/${imageRef}`
}

export async function fetchInventory(status: string): Promise<InventoryItem[]> {
  const params = new URLSearchParams({ status, limit: '200' })
  return fetch(`${API_BASE}/api/v1/inventory?${params}`, { headers: await authHeaders() }).then(
    asJson<InventoryItem[]>,
  )
}
