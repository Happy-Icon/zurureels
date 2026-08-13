/**
 * Shared Upstash Redis REST Rate Limiter for Supabase Edge Functions
 * Enforces server-side rate limits based on User ID or IP address.
 */

async function redisRestCommand(url: string, token: string, command: (string | number)[]) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error('[RateLimiter] Upstash Redis REST error:', err);
    return null;
  }
}

export function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  return '127.0.0.1';
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  ttl: number;
}

export async function checkRateLimit(
  request: Request,
  action: string,
  maxRequests: number,
  windowSeconds: number,
  userId?: string
): Promise<RateLimitResult> {
  const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || 'https://boss-arachnid-175826.upstash.io';
  const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';

  // If Redis is not configured, fail-open for service availability
  if (!redisUrl || !redisToken) {
    return { allowed: true, current: 0, limit: maxRequests, ttl: 0 };
  }

  const identifier = userId || getClientIp(request);
  const key = `ratelimit:${action}:${identifier}`;

  try {
    const count = await redisRestCommand(redisUrl, redisToken, ['INCR', key]);
    const currentCount = Number(count || 1);

    if (currentCount === 1) {
      await redisRestCommand(redisUrl, redisToken, ['EXPIRE', key, windowSeconds]);
    }

    const ttl = await redisRestCommand(redisUrl, redisToken, ['TTL', key]);

    return {
      allowed: currentCount <= maxRequests,
      current: currentCount,
      limit: maxRequests,
      ttl: Math.max(1, Number(ttl || windowSeconds)),
    };
  } catch (err) {
    console.error('[RateLimiter] Failed to check rate limit, failing open:', err);
    return { allowed: true, current: 0, limit: maxRequests, ttl: 0 };
  }
}
