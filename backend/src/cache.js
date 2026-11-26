// Tiny bounded TTL cache (memory-safe on a 512 MB instance): never holds more than `max` entries.
export function ttlCache(ttlMs, max = 500) {
  const m = new Map();
  const prune = (now) => {
    for (const [k, v] of m) if (v.exp <= now) m.delete(k);
    while (m.size > max) m.delete(m.keys().next().value); // oldest first (Map keeps insertion order)
  };
  return {
    get(k) { const v = m.get(k); if (!v) return undefined; if (v.exp <= Date.now()) { m.delete(k); return undefined; } return v.val; },
    set(k, val, ttl = ttlMs) { const now = Date.now(); m.delete(k); m.set(k, { val, exp: now + ttl }); if (m.size > max) prune(now); return val; },
    del(k) { m.delete(k); },
    clear() { m.clear(); },
    get size() { return m.size; },
  };
}
