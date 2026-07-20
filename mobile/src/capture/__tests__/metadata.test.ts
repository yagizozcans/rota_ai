import { buildCaptureFrame, imageRefFor } from '../metadata';

test('imageRefFor builds the deterministic {org}/{session}/{frame}.jpg key', () => {
  expect(imageRefFor('org-1', 'sess-2', 'frame-3')).toBe('org-1/sess-2/frame-3.jpg');
});

test('buildCaptureFrame maps every field and derives image_ref', () => {
  const frame = buildCaptureFrame({
    frameId: 'f1',
    orgId: 'org-1',
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    timestamp: '2026-07-20T10:00:00.000Z',
    gps: { lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 },
    headingDeg: 275,
  });

  expect(frame).toEqual({
    frame_id: 'f1',
    org_id: 'org-1',
    session_id: 'sess-1',
    device_id: 'dev-1',
    timestamp: '2026-07-20T10:00:00.000Z',
    gps: { lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 },
    heading_deg: 275,
    image_ref: 'org-1/sess-1/f1.jpg',
  });
});
