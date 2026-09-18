import { Logger } from '@nestjs/common';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
]);

function redactString(value: string): string {
  return value
    .replace(
      /((?:password|token|accessToken|access_token|refreshToken|refresh_token|authorization|cookie|set-cookie)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
      '$1[REDACTED]',
    );
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '[REDACTED]'
        : redactValue(childValue);
    }

    return result;
  }

  return value;
}

export class RedactingLogger extends Logger {
  override debug(message: unknown, context?: string): void {
    super.debug(this.sanitize(message), context);
  }

  override log(message: unknown, context?: string): void {
    super.log(this.sanitize(message), context);
  }

  override warn(message: unknown, context?: string): void {
    super.warn(this.sanitize(message), context);
  }

  override error(
    message: unknown,
    stackOrContext?: string,
    context?: string,
  ): void {
    super.error(
      this.sanitize(message),
      stackOrContext ? redactString(stackOrContext) : stackOrContext,
      context,
    );
  }

  private sanitize(message: unknown): unknown {
    return redactValue(message);
  }
}
