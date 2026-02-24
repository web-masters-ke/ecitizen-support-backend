import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a ticket number in the format: ESCC-YYYYMMDD-XXXXX
 * where XXXXX is a zero-padded sequential number.
 *
 * @param sequence - The sequential number for the day (1-99999)
 * @param date     - Optional date to use (defaults to now)
 * @returns Formatted ticket number string
 *
 * @example
 * generateTicketNumber(1)    // "ESCC-20260224-00001"
 * generateTicketNumber(42)   // "ESCC-20260224-00042"
 * generateTicketNumber(1500) // "ESCC-20260224-01500"
 */
export function generateTicketNumber(
  sequence: number,
  date?: Date,
): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(5, '0');
  return `ESCC-${year}${month}${day}-${seq}`;
}

/**
 * Generate a unique correlation ID for request tracing.
 * Uses UUID v4 for uniqueness.
 *
 * @returns A UUID v4 string
 *
 * @example
 * generateCorrelationId() // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Mask personally identifiable information (PII) for safe logging.
 *
 * Supported field types:
 * - email:    "john.doe@example.com" -> "jo*****@example.com"
 * - phone:    "+254712345678"        -> "+254****5678"
 * - nationalId: "12345678"           -> "****5678"
 * - name:     "John Doe"             -> "Jo** D**"
 * - generic:  "sensitive data"       -> "sen*********"
 *
 * @param value     - The PII string to mask
 * @param fieldType - The type of field to determine masking strategy
 * @returns Masked string
 */
export function maskPii(
  value: string | null | undefined,
  fieldType: 'email' | 'phone' | 'nationalId' | 'name' | 'generic' = 'generic',
): string {
  if (!value) return '***';

  switch (fieldType) {
    case 'email': {
      const atIndex = value.indexOf('@');
      if (atIndex <= 0) return '***@***';
      const localPart = value.substring(0, atIndex);
      const domain = value.substring(atIndex);
      const visible = Math.min(2, localPart.length);
      return (
        localPart.substring(0, visible) +
        '*'.repeat(Math.max(1, localPart.length - visible)) +
        domain
      );
    }

    case 'phone': {
      if (value.length <= 4) return '****';
      const lastFour = value.slice(-4);
      const prefix = value.slice(0, Math.max(0, value.length - 8));
      const masked = '*'.repeat(Math.max(1, value.length - prefix.length - 4));
      return prefix + masked + lastFour;
    }

    case 'nationalId': {
      if (value.length <= 4) return '****';
      return '*'.repeat(value.length - 4) + value.slice(-4);
    }

    case 'name': {
      return value
        .split(' ')
        .map((part) => {
          if (part.length <= 2) return part;
          return part.substring(0, 2) + '*'.repeat(part.length - 2);
        })
        .join(' ');
    }

    case 'generic':
    default: {
      if (value.length <= 3) return '***';
      const visibleChars = Math.min(3, Math.floor(value.length / 3));
      return (
        value.substring(0, visibleChars) +
        '*'.repeat(value.length - visibleChars)
      );
    }
  }
}

/**
 * Format a date as YYYYMMDD string.
 */
export function formatDateCompact(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Sleep for a given number of milliseconds.
 * Useful for retry logic and tests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse a JSON string. Returns null on failure.
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Truncate a string to a maximum length, appending ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
