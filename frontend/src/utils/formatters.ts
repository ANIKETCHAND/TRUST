/**
 * Formats ISO timestamp string to locale representation.
 */
export function formatTimestamp(isoString?: string): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Formats ISO timestamp string to time only (HH:MM:SS).
 */
export function formatTimeOnly(isoString?: string): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch {
    return isoString;
  }
}

/**
 * Formats execution duration in milliseconds.
 */
export function formatLatency(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null) return '-';
  return `${durationMs.toFixed(2)} ms`;
}

/**
 * Truncates an ID or string with ellipsis.
 */
export function truncateId(id?: string, length: number = 8): string {
  if (!id) return '';
  if (id.length <= length) return id;
  return `${id.slice(0, length)}...`;
}

/**
 * Truncates a string in the middle (e.g. abc123...456f).
 */
export function truncateMiddle(str?: string, startChars: number = 6, endChars: number = 4): string {
  if (!str) return '';
  if (str.length <= startChars + endChars) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/**
 * Safely parses JSON string with fallback.
 */
export function safeJsonParse<T>(jsonStr: string, fallback: T): T {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
}
