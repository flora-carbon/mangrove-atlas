import "server-only";

/**
 * Small in-memory sliding-window limiter. Good enough for a single instance;
 * on serverless with many instances, swap in a shared store (e.g. Redis).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, cost = 1, now = Date.now()): { ok: boolean; remaining: number; retryAfterS: number } {
    const since = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length + cost > this.limit) {
      const oldest = list[0] ?? now;
      this.hits.set(key, list);
      return { ok: false, remaining: Math.max(0, this.limit - list.length), retryAfterS: Math.ceil((oldest + this.windowMs - now) / 1000) };
    }
    for (let i = 0; i < cost; i++) list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.delete(this.hits.keys().next().value as string);
    return { ok: true, remaining: this.limit - list.length, retryAfterS: 0 };
  }
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "anonymous").trim();
}

/** Tiny LRU with TTL for analysis results. */
export class TtlCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
  ) {}
  get(k: string): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    this.map.delete(k);
    this.map.set(k, e);
    return e.v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, { v, exp: Date.now() + this.ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}
