import { API_BASE_URL, ENDPOINTS } from '../config';
import { authHeader } from './auth';

/**
 * Best-effort session lifecycle calls (03 §4.1). Both are idempotent server-side
 * (client-minted session_id, plan Q1) and both fail silently offline — frames
 * still lazy-register the session on upload, so no call here is load-bearing.
 * MVP limitation: there is no retry queue for these; a fully-offline drive's
 * session stays 'active' in the DB until a later online drive re-registers it.
 */

/** Register a client-minted session (idempotent upsert). Never throws. */
export async function registerSession(sessionId: string, deviceId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.sessions}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ session_id: sessionId, device_id: deviceId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mark a session completed. Never throws. */
export async function completeSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.sessionComplete(sessionId)}`, {
      method: 'POST',
      headers: { ...authHeader() },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Stop-of-drive: make sure the session exists, then close it. Best-effort. */
export async function finalizeSession(sessionId: string, deviceId: string): Promise<boolean> {
  await registerSession(sessionId, deviceId);
  return completeSession(sessionId);
}
