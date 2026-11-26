import { useCallback, useState } from 'react';

// The Render free instance sleeps after ~15 min idle; the first request can then take 30-60 s (or fail with 502/503/504).
// withWake() keeps retrying (with backoff + jitter) for up to `maxMs` and reports "slow" so the UI can say what is happening.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAKE_STATUSES = new Set([502, 503, 504]);

export async function withWake(fn, { onSlow, slowAfter = 3000, maxMs = 90000, retry = true } = {}) {
  const started = Date.now();
  const slowTimer = setTimeout(() => onSlow?.(true), slowAfter);
  let attempt = 0;
  try {
    for (;;) {
      try {
        return await fn();
      } catch (e) {
        const wakeable = !e.status || WAKE_STATUSES.has(e.status); // network error or gateway error while the instance boots
        if (!retry || !wakeable || Date.now() - started > maxMs) throw e;
        attempt += 1;
        onSlow?.(true);
        await sleep(Math.min(8000, 1500 * attempt) * (0.7 + Math.random() * 0.6));
      }
    }
  } finally {
    clearTimeout(slowTimer);
    onSlow?.(false);
  }
}

/** const [waking, run] = useWake();  await run(() => api.x(), { retry:false }) */
export function useWake() {
  const [waking, setWaking] = useState(false);
  const run = useCallback((fn, opts) => withWake(fn, { ...opts, onSlow: setWaking }), []);
  return [waking, run];
}
