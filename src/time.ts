const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export const STALE_THRESHOLD_MS = 2 * MS_PER_MINUTE;

export function formatTimeRemaining(resetsAtMs: number | null | undefined, nowMs = Date.now()): string {
  if (resetsAtMs == null || !Number.isFinite(resetsAtMs)) {
    return "unknown";
  }

  const diff = resetsAtMs - nowMs;
  if (diff <= 0) {
    return "now";
  }

  if (diff < MS_PER_HOUR) {
    const minutes = Math.ceil(diff / MS_PER_MINUTE);
    return `${minutes}m`;
  }

  if (diff < MS_PER_DAY) {
    const hours = Math.floor(diff / MS_PER_HOUR);
    const minutes = Math.ceil((diff % MS_PER_HOUR) / MS_PER_MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.ceil((diff % MS_PER_DAY) / MS_PER_HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function formatResetTime(resetsAtMs: number | null | undefined): string {
  if (resetsAtMs == null || !Number.isFinite(resetsAtMs)) {
    return "unknown";
  }

  return new Date(resetsAtMs).toLocaleString();
}

export function formatLastUpdated(updatedAtMs: number | null | undefined, nowMs = Date.now()): string {
  if (updatedAtMs == null || !Number.isFinite(updatedAtMs)) {
    return "unknown";
  }

  const diff = nowMs - updatedAtMs;
  if (diff < 5_000) {
    return "just now";
  }

  if (diff < MS_PER_MINUTE) {
    return `${Math.floor(diff / 1_000)}s ago`;
  }

  if (diff < MS_PER_HOUR) {
    return `${Math.floor(diff / MS_PER_MINUTE)}m ago`;
  }

  return formatResetTime(updatedAtMs);
}

export function isStale(updatedAtMs: number | null | undefined, nowMs = Date.now()): boolean {
  if (updatedAtMs == null || !Number.isFinite(updatedAtMs)) {
    return true;
  }

  return nowMs - updatedAtMs > STALE_THRESHOLD_MS;
}

export function normalizeTimestamp(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
