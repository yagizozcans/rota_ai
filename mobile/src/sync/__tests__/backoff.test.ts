import { backoffDelayMs, nextAttemptAt } from '../backoff';
import { config } from '../../config';

test('backoff doubles from the base and caps at the max', () => {
  expect(backoffDelayMs(0)).toBe(config.BACKOFF_BASE_MS);
  expect(backoffDelayMs(1)).toBe(config.BACKOFF_BASE_MS * 2);
  expect(backoffDelayMs(2)).toBe(config.BACKOFF_BASE_MS * 4);
  // Large attempt counts saturate at the cap, never beyond.
  expect(backoffDelayMs(100)).toBe(config.BACKOFF_MAX_MS);
});

test('nextAttemptAt offsets from now by the delay', () => {
  expect(nextAttemptAt(0, 1_000_000)).toBe(1_000_000 + config.BACKOFF_BASE_MS);
});
