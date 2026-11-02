const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'apiKey',
  'api_key',
  'gemini_api_key',
  'secret',
  'authorization',
  'cookie',
];

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.info(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMetadata(meta) } : {}),
      })
    );
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMetadata(meta) } : {}),
      })
    );
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMetadata(meta) } : {}),
      })
    );
  },
};
