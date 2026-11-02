import { RateLimitError } from './errors';

interface RateLimitBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { remaining: number; resetAt: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const bucket = buckets.get(key) || { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] || now;
    const resetAt = oldest + windowMs;
    throw new RateLimitError(
      `Limite de requisições atingido (${maxRequests} por janela). Tente novamente em ${Math.ceil(
        (resetAt - now) / 1000
      )} segundos.`
    );
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  return {
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    resetAt: now + windowMs,
  };
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
