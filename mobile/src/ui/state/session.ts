/**
 * Device identity for a drive: the org + device the frames belong to. The
 * per-drive session_id is minted separately at Record (client-side, plan Q1).
 *
 * STOPGAP — org_id and device_id come from the auth token (plan Q7), wired in
 * Slice 5 (sync/auth). Until then these placeholders keep the screen runnable.
 * TODO(Slice 5): replace with claims decoded from the pilot JWT.
 */
export interface DeviceIdentity {
  orgId: string;
  deviceId: string;
}

export const DEV_IDENTITY: DeviceIdentity = {
  orgId: 'dev-org',
  deviceId: 'dev-device',
};
