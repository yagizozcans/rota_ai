import { uploadFrame } from '../uploader';
import { API_BASE_URL, ENDPOINTS } from '../../config';
import type { CaptureFrame } from '../../types/captureFrame';

const frame: CaptureFrame = {
  frame_id: 'f1',
  org_id: 'org-1',
  session_id: 'sess-1',
  device_id: 'dev-1',
  timestamp: '2026-07-20T10:00:00.000Z',
  gps: { lat: 41.01, lon: 28.97, accuracy_m: 4.2, speed_kmh: 48 },
  heading_deg: 275,
  image_ref: 'org-1/sess-1/f1.jpg',
};

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

test('POSTs multipart to /frames with metadata JSON + image, returns ok on 2xx', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  global.fetch = jest.fn((url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return Promise.resolve({ ok: true, status: 202 } as Response);
  }) as unknown as typeof fetch;

  const outcome = await uploadFrame(frame, '/data/frames/f1.jpg');

  expect(outcome).toBe('ok');
  expect(capturedUrl).toBe(`${API_BASE_URL}${ENDPOINTS.frames}`);
  expect(capturedInit?.method).toBe('POST');
  const body = capturedInit?.body as unknown as {
    get(k: string): unknown;
    has(k: string): boolean;
  };
  expect(body.get('metadata')).toBe(JSON.stringify(frame)); // exact CaptureFrame JSON
  expect(body.has('image')).toBe(true);
});

test('non-2xx maps to retry', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
  expect(await uploadFrame(frame, '/data/frames/f1.jpg')).toBe('retry');
});

test('network error maps to retry (never throws)', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  expect(await uploadFrame(frame, '/data/frames/f1.jpg')).toBe('retry');
});
