// API client — matches docs/03-backend-api.md §4.2 and docs/00-overview.md §4.
// Talks directly to the backend (CORS is open for MVP dev, see backend/app/main.py).

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`)
  }
  return res.json() as Promise<T>
}

export function fetchQueue(): Promise<ReviewQueueItem[]> {
  return fetch(`${API_BASE}/api/v1/review/queue`).then(asJson<ReviewQueueItem[]>)
}

export function fetchTaxonomy(): Promise<string[]> {
  return fetch(`${API_BASE}/api/v1/taxonomy`)
    .then(asJson<{ asset_classes: string[] }>)
    .then((d) => d.asset_classes)
}

export function submitDecision(itemId: string, payload: ReviewDecisionPayload): Promise<unknown> {
  return fetch(`${API_BASE}/api/v1/review/${itemId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(asJson)
}

export function imageUrl(imageRef: string): string {
  return `${API_BASE}/media/${imageRef}`
}
