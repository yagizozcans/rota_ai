import {
  gpsAccuracyLevel,
  estimateRemainingMinutes,
  formatRemaining,
  isStorageLow,
  formatTemp,
  isTempStale,
} from '../hudCompute';
import { config } from '../../../config';

describe('gpsAccuracyLevel (thresholds 10 / 20 m)', () => {
  test('green at or below WARN', () => {
    expect(gpsAccuracyLevel(3)).toBe('good');
    expect(gpsAccuracyLevel(config.GPS_ACCURACY_WARN_M)).toBe('good');
  });
  test('amber between WARN and FLAG', () => {
    expect(gpsAccuracyLevel(config.GPS_ACCURACY_WARN_M + 0.1)).toBe('warn');
    expect(gpsAccuracyLevel(config.GPS_ACCURACY_FLAG_M)).toBe('warn');
  });
  test('red above FLAG', () => {
    expect(gpsAccuracyLevel(config.GPS_ACCURACY_FLAG_M + 0.1)).toBe('bad');
    expect(gpsAccuracyLevel(50)).toBe('bad');
  });
});

describe('estimateRemainingMinutes', () => {
  test('free ÷ (rate × size)', () => {
    // 400 MB free, 400 KB/frame, 60 frames/min ⇒ 1000 frames left ⇒ ~16.6 min.
    const mins = estimateRemainingMinutes(400e6, 400e3, 60);
    expect(mins).toBeCloseTo(400e6 / (60 * 400e3), 5);
  });
  test('unknown rate/size ⇒ Infinity', () => {
    expect(estimateRemainingMinutes(400e6, 400e3, 0)).toBe(Infinity);
    expect(estimateRemainingMinutes(400e6, 0, 60)).toBe(Infinity);
  });
});

describe('formatRemaining', () => {
  test('hours, minutes, and unknown', () => {
    expect(formatRemaining(390)).toBe('~6.5 saat');
    expect(formatRemaining(45)).toBe('~45 dk');
    expect(formatRemaining(Infinity)).toBe('—');
  });
});

describe('isStorageLow', () => {
  test('true only under the warn threshold', () => {
    expect(isStorageLow(config.STORAGE_WARN_MINUTES - 1)).toBe(true);
    expect(isStorageLow(config.STORAGE_WARN_MINUTES)).toBe(false);
    expect(isStorageLow(Infinity)).toBe(false);
  });
});

describe('temperature helpers', () => {
  test('formatTemp rounds or shows ~ when absent', () => {
    expect(formatTemp(22.6)).toBe('23°');
    expect(formatTemp(null)).toBe('~');
  });
  test('isTempStale respects the TTL', () => {
    const now = 10_000_000;
    const ttlMs = config.TEMP_CACHE_TTL_MIN * 60_000;
    expect(isTempStale(now - ttlMs - 1, now)).toBe(true);
    expect(isTempStale(now - 1000, now)).toBe(false);
    expect(isTempStale(null, now)).toBe(false);
  });
});
