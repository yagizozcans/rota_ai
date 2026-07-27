import { decodeIdentity } from '../auth';

/** Build a JWT-shaped string with the given payload (base64url, unsigned is fine here). */
function jwt(payload: object): string {
  const b64url = (o: object) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/[=]+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

test('decodeIdentity extracts org_id and device_id from the payload', () => {
  const token = jwt({ org_id: 'org-42', device_id: 'dev-7', role: 'saha_kullanici' });
  expect(decodeIdentity(token)).toEqual({ orgId: 'org-42', deviceId: 'dev-7' });
});

test('decodeIdentity returns null for missing claims or malformed tokens', () => {
  expect(decodeIdentity(null)).toBeNull();
  expect(decodeIdentity('not-a-jwt')).toBeNull();
  expect(decodeIdentity(jwt({ org_id: 'org-1' }))).toBeNull(); // no device_id
  expect(decodeIdentity('a.%%%.c')).toBeNull(); // undecodable payload
});
