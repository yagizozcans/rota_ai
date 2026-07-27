import {
  haversineMeters,
  timeFallbackIntervalMs,
  initTriggerState,
  onFix,
  type GpsFix,
  type TriggerState,
} from '../distanceTrigger';
import { config } from '../../config';

function fix(over: Partial<GpsFix>): GpsFix {
  return { lat: 41, lon: 29, accuracy_m: 5, speed_kmh: 40, heading_deg: 0, t: 0, ...over };
}

/** Feed a sequence of fixes, return which ones triggered a capture. */
function run(fixes: GpsFix[]): boolean[] {
  let state: TriggerState = initTriggerState();
  return fixes.map((f) => {
    const r = onFix(state, f);
    state = r.state;
    return r.capture;
  });
}

describe('haversineMeters', () => {
  test('~111.2 m for 0.001° of latitude', () => {
    const d = haversineMeters({ lat: 41, lon: 29 }, { lat: 41.001, lon: 29 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  test('zero for identical points', () => {
    expect(haversineMeters({ lat: 41, lon: 29 }, { lat: 41, lon: 29 })).toBe(0);
  });
});

describe('timeFallbackIntervalMs', () => {
  test('unknown/zero speed → seed', () => {
    expect(timeFallbackIntervalMs(0)).toBe(config.TIME_FALLBACK_SEED_MS);
    expect(timeFallbackIntervalMs(-1)).toBe(config.TIME_FALLBACK_SEED_MS);
    expect(timeFallbackIntervalMs(NaN)).toBe(config.TIME_FALLBACK_SEED_MS);
  });
  test('high speed clamps to the min interval', () => {
    // 120 km/h ⇒ 5 m every 150 ms (below floor) ⇒ clamped up to MIN.
    expect(timeFallbackIntervalMs(120)).toBe(config.TIME_FALLBACK_MIN_MS);
  });
  test('low speed clamps to the max interval', () => {
    // 3 km/h ⇒ 5 m every 6 s (above cap) ⇒ clamped down to MAX.
    expect(timeFallbackIntervalMs(3)).toBe(config.TIME_FALLBACK_MAX_MS);
  });
  test('mid speed is computed (18 km/h = 5 m/s ⇒ ~1 s)', () => {
    expect(timeFallbackIntervalMs(18)).toBeCloseTo(1000, 0);
  });
});

describe('onFix — distance mode (good GPS)', () => {
  test('first fix always captures (baseline)', () => {
    expect(run([fix({})])).toEqual([true]);
  });

  test('captures once ~5 m of accumulated distance is reached', () => {
    // Steps of ~2.2 m (0.00002°): capture on first, then after enough steps.
    const step = 0.00002;
    const fixes = Array.from({ length: 5 }, (_, i) =>
      fix({ lat: 41 + i * step, t: i * 1000 }),
    );
    const caps = run(fixes);
    expect(caps[0]).toBe(true); // baseline
    // ~2.2 m/step ⇒ crosses 5 m by the 3rd step after baseline.
    expect(caps.slice(1).filter(Boolean).length).toBeGreaterThanOrEqual(1);
  });

  test('a single >5 m jump captures on the next fix', () => {
    const caps = run([
      fix({ lat: 41, t: 0 }),
      fix({ lat: 41.0001, t: 1000 }), // ~11 m from previous
    ]);
    expect(caps).toEqual([true, true]);
  });
});

describe('onFix — weak GPS fallback (time mode)', () => {
  test('does not capture before the interval, captures after', () => {
    const weak = { accuracy_m: config.GPS_WEAK_FALLBACK_M + 10, speed_kmh: 18 };
    // 18 km/h ⇒ ~1000 ms interval.
    const caps = run([
      fix({ ...weak, t: 0 }), // baseline capture
      fix({ ...weak, lat: 41.00001, t: 500 }), // 500 ms < 1000 ⇒ no
      fix({ ...weak, lat: 41.00002, t: 1200 }), // ≥ 1000 ms since last capture ⇒ yes
    ]);
    expect(caps).toEqual([true, false, true]);
  });
});
