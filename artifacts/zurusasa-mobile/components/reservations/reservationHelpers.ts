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

export type FilterChip = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'refunded';

export const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'All Trips' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];
