/**
 * Timezone-safe booking date/time serialization and calendar date extraction.
 * Eliminates the UTC -1 day shift bug when local UTC+3 midnight dates are converted
 * via Date.prototype.toISOString().
 */

export const DEFAULT_LISTING_TIMEZONE = 'Africa/Nairobi';

export function parseClockTime(
  rawTime: string | null | undefined,
  fallbackHours = 14,
  fallbackMinutes = 0,
): { hours: number; minutes: number } {
  if (!rawTime || typeof rawTime !== 'string') {
    return { hours: fallbackHours, minutes: fallbackMinutes };
  }
  const trimmed = rawTime.trim();
  const match = trimmed.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    return { hours: fallbackHours, minutes: fallbackMinutes };
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? Math.min(59, Math.max(0, parseInt(match[2], 10))) : 0;
  const meridiem = (match[3] || '').toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
    return { hours: fallbackHours, minutes: fallbackMinutes };
  }
  return { hours, minutes };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Resolves the UTC offset in minutes for a given IANA timezone at a reference instant.
 * Falls back to +180 minutes (+03:00, Africa/Nairobi) if Intl timeZoneName parsing is unavailable.
 */
export function resolveTimezoneOffsetMinutes(
  timezone = DEFAULT_LISTING_TIMEZONE,
  refDate = new Date(),
): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(refDate);

    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const asUtcMs = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    const refUtcMs = Date.UTC(
      refDate.getUTCFullYear(),
      refDate.getUTCMonth(),
      refDate.getUTCDate(),
      refDate.getUTCHours(),
      refDate.getUTCMinutes(),
      refDate.getUTCSeconds(),
    );
    return Math.round((asUtcMs - refUtcMs) / 60_000);
  } catch {
    return 180; // Africa/Nairobi UTC+3
  }
}

export function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${pad2(h)}:${pad2(m)}`;
}

/**
 * Converts a local calendar Date (year/month/day) + listing wall-clock time (e.g. '14:00')
 * in the listing's IANA timezone into a precise RFC 3339 / ISO-8601 timestamp with offset.
 *
 * Example: buildStayTimestampIso(new Date(2026, 10, 22), '14:00', 14, 'Africa/Nairobi')
 *   => '2026-11-22T14:00:00+03:00'
 */
export function buildStayTimestampIso(
  localDate: Date,
  clockTime?: string | null,
  fallbackHours = 14,
  timezone = DEFAULT_LISTING_TIMEZONE,
): string {
  const year = localDate.getFullYear();
  const month = localDate.getMonth() + 1;
  const day = localDate.getDate();
  const { hours, minutes } = parseClockTime(clockTime, fallbackHours, 0);

  const probe = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const offsetMinutes = resolveTimezoneOffsetMinutes(timezone, probe);
  const offsetStr = formatOffsetMinutes(offsetMinutes);

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hours)}:${pad2(minutes)}:00${offsetStr}`;
}

/**
 * Extracts the YYYY-MM-DD calendar date of a timestamptz ISO string in the target IANA timezone.
 */
export function extractListingDateIso(
  isoTimestamp: string,
  timezone = DEFAULT_LISTING_TIMEZONE,
): string {
  if (!isoTimestamp) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoTimestamp.trim())) {
    return isoTimestamp.trim();
  }
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) {
    return isoTimestamp.split('T')[0] || '';
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    // fallback below
  }
  return d.toISOString().split('T')[0];
}
