import { API_BASE_URL, ENDPOINTS } from '../config';
import type { CaptureFrame } from '../types/captureFrame';
import { authHeader } from './auth';

/**
 * Uploads one frame to the backend (03 §4.1): multipart with the CaptureFrame
 * JSON as the `metadata` field and the JPEG as `image` — the exact field names
 * the backend expects (backend/app/routers/frames.py).
 *
 * Binary result only: 'ok' on 2xx, 'retry' on anything else or a network error.
 * The caller applies backoff for 'retry' — a frame is never dropped here.
 */
export type UploadOutcome = 'ok' | 'retry';

/** RN's FormData accepts a file part shaped like this (not a DOM Blob). */
interface RNFilePart {
  uri: string;
  type: string;
  name: string;
}

export async function uploadFrame(frame: CaptureFrame, localPath: string): Promise<UploadOutcome> {
  const form = new FormData();
  form.append('metadata', JSON.stringify(frame));
  const file: RNFilePart = { uri: localPath, type: 'image/jpeg', name: `${frame.frame_id}.jpg` };
  form.append('image', file as unknown as Blob);

  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.frames}`, {
      method: 'POST',
      // No Content-Type: fetch sets multipart/form-data with the boundary itself.
      headers: { ...authHeader() },
      body: form,
    });
    return res.ok ? 'ok' : 'retry';
  } catch {
    return 'retry';
  }
}
