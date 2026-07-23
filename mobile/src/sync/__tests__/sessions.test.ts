import { registerSession, completeSession, finalizeSession } from '../sessions';
import { API_BASE_URL, ENDPOINTS } from '../../config';

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

test('registerSession POSTs the client-minted id + device_id', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  global.fetch = jest.fn((url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return Promise.resolve({ ok: true, status: 201 } as Response);
  }) as unknown as typeof fetch;

  expect(await registerSession('sess-1', 'dev-1')).toBe(true);
  expect(capturedUrl).toBe(`${API_BASE_URL}${ENDPOINTS.sessions}`);
  expect(capturedInit?.method).toBe('POST');
  expect(JSON.parse(String(capturedInit?.body))).toEqual({
    session_id: 'sess-1',
    device_id: 'dev-1',
  });
});

test('completeSession POSTs to the complete endpoint', async () => {
  let capturedUrl: string | undefined;
  global.fetch = jest.fn((url: string) => {
    capturedUrl = url;
    return Promise.resolve({ ok: true, status: 200 } as Response);
  }) as unknown as typeof fetch;

  expect(await completeSession('sess-1')).toBe(true);
  expect(capturedUrl).toBe(`${API_BASE_URL}${ENDPOINTS.sessionComplete('sess-1')}`);
});

test('network failure returns false, never throws (offline drive)', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;

  expect(await registerSession('sess-1', 'dev-1')).toBe(false);
  expect(await completeSession('sess-1')).toBe(false);
  expect(await finalizeSession('sess-1', 'dev-1')).toBe(false);
});

test('finalizeSession registers then completes', async () => {
  const urls: string[] = [];
  global.fetch = jest.fn((url: string) => {
    urls.push(url);
    return Promise.resolve({ ok: true, status: 200 } as Response);
  }) as unknown as typeof fetch;

  expect(await finalizeSession('sess-1', 'dev-1')).toBe(true);
  expect(urls).toEqual([
    `${API_BASE_URL}${ENDPOINTS.sessions}`,
    `${API_BASE_URL}${ENDPOINTS.sessionComplete('sess-1')}`,
  ]);
});
