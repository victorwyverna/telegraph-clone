type RateLimit = { limit: number; windowMs: number };

export type RateLimiter = {
  check(
    key: string,
    limit: RateLimit
  ): { allowed: boolean; retryAfterSeconds: number };
};

type Entry = { count: number; resetAt: number };

export function createRateLimiter(now = () => Date.now()): RateLimiter {
  const entries = new Map<string, Entry>();

  return {
    check(key, limit) {
      const timestamp = now();
      const entry = entries.get(key);

      if (!entry || entry.resetAt <= timestamp) {
        entries.set(key, { count: 1, resetAt: timestamp + limit.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      entry.count += 1;

      return {
        allowed: entry.count <= limit.limit,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetAt - timestamp) / 1000)
        ),
      };
    },
  };
}
