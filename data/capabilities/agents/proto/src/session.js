const TTL = 3 * 60 * 60 * 1000;
const MAX_SESSIONS = 2000;
const buckets = new Map();
const sessions = new Map();

export function getSession(id) {
  const now = Date.now();
  const existing = sessions.get(id);
  if (existing && now - existing.updated < TTL) {
    existing.updated = now;
    return existing;
  }
  if (sessions.size >= MAX_SESSIONS) prune(now);
  const fresh = {
    id,
    created: now,
    updated: now,
    history: [],
    turn: 0,
    strikes: 0,
    demo: false,
    orderId: null,
    email: null,
    pending: null,
    lastTicket: null,
  };
  sessions.set(id, fresh);
  return fresh;
}

function prune(now) {
  for (const [key, value] of sessions) {
    if (now - value.updated > TTL) sessions.delete(key);
  }
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].updated - b[1].updated);
    for (const [key] of oldest.slice(0, Math.floor(MAX_SESSIONS / 2))) sessions.delete(key);
  }
}

export function rateLimit(key, limit = 40, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

export function stats() {
  return { sessions: sessions.size, buckets: buckets.size };
}
