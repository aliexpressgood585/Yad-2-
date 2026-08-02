import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** מספר שניות עד לאיפוס החלון */
  retryAfter: number;
};

/** תצורות המגבלה לכל פעולה רגישה באתר. */
export const RATE_LIMITS = {
  search: { limit: 60, windowSec: 60 },
  publish: { limit: 10, windowSec: 3600 },
  revealPhone: { limit: 25, windowSec: 3600 },
  message: { limit: 30, windowSec: 600 },
  login: { limit: 10, windowSec: 900 },
  otp: { limit: 5, windowSec: 900 },
  register: { limit: 5, windowSec: 3600 },
  report: { limit: 10, windowSec: 3600 },
  upload: { limit: 60, windowSec: 3600 },
  favorite: { limit: 120, windowSec: 3600 },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

const hasUpstash =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasUpstash ? Redis.fromEnv() : null;

const limiters = new Map<RateLimitKey, Ratelimit>();

function upstashLimiter(key: RateLimitKey): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(key);
  if (!limiter) {
    const cfg = RATE_LIMITS[key];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.windowSec} s`),
      prefix: `luach:rl:${key}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * מגביל בזיכרון התהליך — משמש כשאין Upstash מוגדר.
 * מתאים לפיתוח ולפריסה בשרת יחיד בלבד; בפרודקשן מרובה מופעים
 * יש להגדיר UPSTASH_REDIS_REST_URL/TOKEN.
 */
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: RateLimitKey, id: string): RateLimitResult {
  const cfg = RATE_LIMITS[key];
  const mapKey = `${key}:${id}`;
  const now = Date.now();
  const windowMs = cfg.windowSec * 1000;

  const entry = memory.get(mapKey);
  if (!entry || entry.resetAt <= now) {
    memory.set(mapKey, { count: 1, resetAt: now + windowMs });
    // ניקוי עצל של רשומות שפגו כדי שהמפה לא תגדל ללא גבול
    if (memory.size > 5000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return { success: true, limit: cfg.limit, remaining: cfg.limit - 1, retryAfter: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, cfg.limit - entry.count);
  return {
    success: entry.count <= cfg.limit,
    limit: cfg.limit,
    remaining,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * בודק ומקדם את מונה הבקשות עבור מזהה (IP או משתמש).
 * מחזיר `success: false` כשחצו את המגבלה.
 */
export async function rateLimit(
  key: RateLimitKey,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = upstashLimiter(key);
  if (!limiter) return memoryLimit(key, identifier);

  const res = await limiter.limit(identifier);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    retryAfter: Math.max(0, Math.ceil((res.reset - Date.now()) / 1000)),
  };
}
