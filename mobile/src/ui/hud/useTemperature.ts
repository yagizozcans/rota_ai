import { useEffect, useState } from 'react';
import { config } from '../../config';
import { isTempStale } from './hudCompute';

/**
 * Best-effort ambient temperature for the HUD (plan Q10). Fetches current
 * temperature from Open-Meteo (free, no key) and refreshes on the cache TTL.
 * Fail-soft: on any error it keeps the last value (or null), so an offline or
 * failed fetch never disturbs the drive — the HUD just shows "~" / a stale value.
 *
 * Coordinates are rounded to ~11 km so a moving vehicle doesn't refetch per fix.
 */
export function useTemperature(lat: number | null, lon: number | null) {
  const [tempC, setTempC] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const rlat = lat == null ? null : Math.round(lat * 10) / 10;
  const rlon = lon == null ? null : Math.round(lon * 10) / 10;

  useEffect(() => {
    if (rlat == null || rlon == null) {
      return;
    }
    let cancelled = false;

    const fetchTemp = async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${rlat}` +
          `&longitude=${rlon}&current=temperature_2m`;
        const res = await fetch(url);
        const json = (await res.json()) as { current?: { temperature_2m?: number } };
        const t = json.current?.temperature_2m;
        if (!cancelled && typeof t === 'number') {
          setTempC(t);
          setFetchedAt(Date.now());
        }
      } catch {
        // Best-effort — keep the last known value; HUD degrades to stale/"~".
      }
    };

    fetchTemp();
    const id = setInterval(fetchTemp, config.TEMP_CACHE_TTL_MIN * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rlat, rlon]);

  return { tempC, stale: isTempStale(fetchedAt, Date.now()) };
}
