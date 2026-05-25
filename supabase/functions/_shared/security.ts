import { z } from "zod";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  scope: string;
  message: string;
  identity: (req: Request) => string | Promise<string>;
};

const buckets = new Map<string, RateLimitBucket>();

export const sanitizeText = (value: string, maxLength = 500): string =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const getClientIp = (req: Request): string =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("cf-connecting-ip") ||
  req.headers.get("x-real-ip") ||
  "unknown-ip";

export const jsonError = (
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  extra?: Record<string, unknown>,
  retryAfterSeconds?: number,
) => {
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
  };

  return new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status,
    headers,
  });
};

export const createFixedWindowLimiter = (options: RateLimitOptions) => {
  return async (req: Request, corsHeaders: Record<string, string>) => {
    const identity = await options.identity(req);
    const key = `${options.scope}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return null;
    }

    if (bucket.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      console.warn(`[rate-limit] ${options.scope} blocked for ${identity}`);
      return jsonError(options.message, 429, corsHeaders, { retryAfterSeconds }, retryAfterSeconds);
    }

    bucket.count += 1;
    return null;
  };
};

export const ensureRecordBounds = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return numeric;
};

export { z };