import { PILOT_TOKEN } from '../config';
import type { DeviceIdentity } from '../types/models';

/**
 * Auth for the sync layer (plan Q7). For the pilot the token is a long-lived
 * JWT injected via config; this module reads the tenant/device identity from it
 * and produces the Bearer header. Real login/rotation is Faz 3.
 *
 * The token is the authority for org_id (§4.5) — the client never asserts its
 * own tenant; org_id always comes from the decoded token here.
 */

/** Dev fallback when no pilot token is configured, so the app is runnable. */
const DEV_IDENTITY: DeviceIdentity = { orgId: 'dev-org', deviceId: 'dev-device' };

export function getToken(): string | null {
  return PILOT_TOKEN.length > 0 ? PILOT_TOKEN : null;
}

/** Decode `org_id`/`device_id` from a JWT payload. Pure; null on any malformed input. */
export function decodeIdentity(token: string | null): DeviceIdentity | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4); // restore base64 padding
    const claims = JSON.parse(atob(b64)) as { org_id?: unknown; device_id?: unknown };
    if (typeof claims.org_id === 'string' && typeof claims.device_id === 'string') {
      return { orgId: claims.org_id, deviceId: claims.device_id };
    }
    return null;
  } catch {
    return null;
  }
}

/** Identity for the current drive: from the token, or the dev fallback. */
export function getIdentity(): DeviceIdentity {
  return decodeIdentity(getToken()) ?? DEV_IDENTITY;
}

/** Authorization header for uploads (empty when no token, e.g. dev). */
export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
