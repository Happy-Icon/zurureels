import type { ReelRow } from '@/lib/supabase';

export const BRAND_ORANGE = '#F26522';
export const DAY_MS = 86_400_000;

export const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

export type Step = 'details' | 'dates' | 'review' | 'payment_method' | 'confirm_pay';
export type PaymentMethod = 'mpesa' | 'card';
export type Phase = 'idle' | 'submitting' | 'pin' | 'settling' | 'success';

export interface BookingSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  initialStep?: Step;
  onSuccess?: () => void;
}

export function startOfDay(d: Date | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtShort(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function fmtFull(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtRange(from: Date, to?: Date): string {
  if (!to) return fmtFull(from);
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${MONTHS_SHORT[from.getMonth()]} ${from.getDate()} – ${to.getDate()}, ${to.getFullYear()}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${MONTHS_SHORT[from.getMonth()]} ${from.getDate()} – ${MONTHS_SHORT[to.getMonth()]} ${to.getDate()}, ${to.getFullYear()}`;
  }
  return `${fmtFull(from)} – ${fmtFull(to)}`;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatHostTenure(createdAt?: string | null): { num: string; label: string } {
  if (!createdAt) {
    return { num: '1', label: 'Mo hosting' };
  }
  const created = new Date(createdAt);
  const now = new Date();

  const diffYears = now.getFullYear() - created.getFullYear();
  const diffMonths = (now.getMonth() - created.getMonth()) + (diffYears * 12);
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffMonths >= 24) {
    const yrs = Math.floor(diffMonths / 12);
    return { num: `${yrs}`, label: 'Yrs hosting' };
  } else if (diffMonths >= 12) {
    return { num: '1', label: 'Yr hosting' };
  } else if (diffMonths >= 1) {
    return { num: `${diffMonths}`, label: `Mo${diffMonths !== 1 ? 's' : ''} hosting` };
  } else {
    return { num: `${diffDays}`, label: `Day${diffDays !== 1 ? 's' : ''} hosting` };
  }
}

export function formatPhoneForPrompt(rawPhone?: string | null): string {
  if (!rawPhone) return 'your phone';
  const clean = rawPhone.trim().replace(/[\s+-]/g, '');
  if (clean.length === 9 && clean.startsWith('7')) return `0${clean}`;
  if (clean.length === 12 && clean.startsWith('254')) return `0${clean.slice(3)}`;
  return clean;
}
