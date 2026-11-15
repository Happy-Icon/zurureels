import type { BookingRow } from '@/lib/supabase';

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const ORANGE = '#F26522';

export function formatDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year =
    d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
}

export function dateRange(b: BookingRow): string {
  const ci = formatDay(b.check_in);
  const co = formatDay(b.check_out);
  if (ci && co) return `${ci} – ${co}`;
  return ci || co || '';
}

export function daysUntilNumber(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function daysUntilLabel(iso: string | null): string | null {
  const num = daysUntilNumber(iso);
  if (num === null) return null;
  if (num < 0) return null;
  if (num === 0) return 'Check in Today';
  if (num === 1) return 'Check in Tomorrow';
  return `Check in in ${num} days`;
}

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function getCheckInWindowBoundsMs(booking: {
  check_in?: string | null;
  check_out?: string | null;
}): { windowStartMs: number; windowEndMs: number } | null {
  if (!booking.check_in) return null;
  const checkInDate = new Date(booking.check_in);
  if (Number.isNaN(checkInDate.getTime())) return null;

  // Calendar date in Africa/Nairobi (UTC+3), window opens at 06:00 AM EAT (= 03:00 UTC)
  const checkInEat = new Date(checkInDate.getTime() + EAT_OFFSET_MS);
  const year = checkInEat.getUTCFullYear();
  const month = checkInEat.getUTCMonth();
  const day = checkInEat.getUTCDate();
  const windowStartMs = Date.UTC(year, month, day, 6, 0, 0) - EAT_OFFSET_MS;

  let windowEndMs = windowStartMs + 36 * 60 * 60 * 1000;
  if (booking.check_out) {
    const checkOutMs = new Date(booking.check_out).getTime();
    if (!Number.isNaN(checkOutMs)) {
      windowEndMs = checkOutMs + 12 * 60 * 60 * 1000;
    }
  }

  return { windowStartMs, windowEndMs };
}

export function isCheckInWindowOpen(booking: {
  status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  checked_in_at?: string | null;
  arrival_issue_status?: string | null;
}): boolean {
  const status = (booking.status ?? '').toLowerCase();
  if (status !== 'confirmed') return false;
  if (booking.checked_in_at) return false;
  if (booking.arrival_issue_status === 'open') return false;

  const bounds = getCheckInWindowBoundsMs(booking);
  if (!bounds) return false;
  const now = Date.now();
  return now >= bounds.windowStartMs && now <= bounds.windowEndMs;
}

export function canReportArrivalIssue(booking: {
  status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  checked_in_at?: string | null;
  arrival_issue_status?: string | null;
}): boolean {
  const status = (booking.status ?? '').toLowerCase();
  if (status !== 'confirmed') return false;
  if (booking.arrival_issue_status === 'open') return false;

  const now = Date.now();
  if (booking.checked_in_at) {
    const checkedInMs = new Date(booking.checked_in_at).getTime();
    if (!Number.isNaN(checkedInMs)) {
      return now <= checkedInMs + 24 * 60 * 60 * 1000;
    }
  }

  const bounds = getCheckInWindowBoundsMs(booking);
  if (!bounds) return false;
  return now >= bounds.windowStartMs && now <= bounds.windowEndMs;
}

export type FilterChip = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'refunded';

export const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'All Trips' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];
