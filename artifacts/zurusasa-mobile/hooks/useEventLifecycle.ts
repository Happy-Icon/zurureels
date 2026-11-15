import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatExpiryCountdown,
  getEventLifecycleState,
  isOfferActive,
  parseExpiryTimestamp,
  resolveReelContentType,
  type EventLifecycleInput,
  type EventLifecycleState,
} from '@/constants/taxonomy';
import type { EventRow, ReelRow } from '@/lib/supabase';

const MAX_SETTIMEOUT_MS = 2_147_483_647;

export function extractEventTimingFromReel(reel?: ReelRow | null): EventLifecycleInput | null {
  if (!reel || resolveReelContentType(reel) !== 'event') return null;
  const meta = (reel.experience?.metadata ?? {}) as Record<string, any>;
  const ev = (meta.event_details ?? {}) as Record<string, any>;
  return {
    eventDate: reel.event?.event_date ?? ev.event_date ?? null,
    endDate: reel.event?.end_date ?? ev.end_date ?? null,
    expiresAt: reel.event?.expires_at ?? ev.expires_at ?? reel.expires_at ?? null,
    startTime: reel.event?.start_time ?? ev.start_time ?? null,
    endTime: reel.event?.end_time ?? ev.end_time ?? null,
    status: reel.event?.status ?? ev.status ?? null,
  };
}

export function extractEventTiming(
  event?: EventRow | null,
  reel?: ReelRow | null,
): EventLifecycleInput {
  const meta = (reel?.experience?.metadata ?? {}) as Record<string, any>;
  const evMeta = (meta.event_details ?? {}) as Record<string, any>;
  return {
    eventDate: event?.event_date ?? evMeta.event_date ?? null,
    endDate: event?.end_date ?? evMeta.end_date ?? null,
    expiresAt: event?.expires_at ?? evMeta.expires_at ?? reel?.expires_at ?? null,
    startTime: event?.start_time ?? evMeta.start_time ?? null,
    endTime: event?.end_time ?? evMeta.end_time ?? null,
    status: event?.status ?? evMeta.status ?? null,
  };
}

/**
 * Computes and ticks real-time Event lifecycle state (`upcoming` | `live` | `ended`).
 * Ticks every `intervalMs` only while enabled and the event has not ended.
 */
export function useEventLifecycle(
  input: EventLifecycleInput | null | undefined,
  options?: { enabled?: boolean; intervalMs?: number },
): EventLifecycleState | null {
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? 1000;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const inputKey = input
    ? `${input.eventDate ?? ''}|${input.endDate ?? ''}|${input.expiresAt ?? ''}|${input.startTime ?? ''}|${input.endTime ?? ''}|${input.status ?? ''}`
    : '';

  const state = useMemo(() => {
    if (!input) return null;
    return getEventLifecycleState(input, nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, nowMs]);

  useEffect(() => {
    if (!enabled || !state || state.isEnded) return;
    setNowMs(Date.now());
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, inputKey, intervalMs, state?.isEnded]);

  return state;
}

export function extractOfferExpiryFromReel(reel?: ReelRow | null): {
  expiresAt: string | null;
  status: string | null;
  expiresAtMs: number | null;
} | null {
  if (!reel || resolveReelContentType(reel) !== 'special_offer') return null;
  const meta = (reel.experience?.metadata ?? {}) as Record<string, any>;
  const off = (meta.offer_details ?? {}) as Record<string, any>;
  const expiresAt = reel.offer?.expires_at ?? off.expires_at ?? reel.expires_at ?? null;
  const status = reel.offer?.status ?? off.status ?? 'active';
  return {
    expiresAt,
    status,
    expiresAtMs: parseExpiryTimestamp(expiresAt),
  };
}

export function extractPromoEndTimestampFromReel(reel?: ReelRow | null): number | null {
  if (!reel) return null;
  const ct = resolveReelContentType(reel);
  if (ct === 'event') {
    const timing = extractEventTimingFromReel(reel);
    return timing ? getEventLifecycleState(timing).endMs : null;
  }
  if (ct === 'special_offer') {
    return extractOfferExpiryFromReel(reel)?.expiresAtMs ?? null;
  }
  return null;
}

/**
 * Watches an offer's exact expiry timestamp.
 * Keeps `isExpired === false` until `expires_at` passes, ticks every 1s once < 24h remain,
 * and invokes `onExpired` the exact moment it expires.
 */
export function useOfferCountdown(
  expiresAt?: string | null,
  status?: string | null,
  options?: { enabled?: boolean; onExpired?: () => void },
): {
  isExpired: boolean;
  expiresAtMs: number | null;
  remainingMs: number | null;
  countdownLabel: string;
  compactCountdownLabel: string;
} {
  const enabled = options?.enabled ?? true;
  const onExpiredRef = useRef(options?.onExpired);
  onExpiredRef.current = options?.onExpired;
  const hasNotifiedRef = useRef(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const expiresAtMs = useMemo(() => parseExpiryTimestamp(expiresAt), [expiresAt]);

  useEffect(() => {
    hasNotifiedRef.current = false;
    setNowMs(Date.now());
  }, [expiresAt, status]);

  const active = useMemo(() => isOfferActive(expiresAt, status, nowMs), [expiresAt, status, nowMs]);
  const remainingMs = expiresAtMs !== null ? Math.max(0, expiresAtMs - nowMs) : null;

  useEffect(() => {
    if (!enabled) return;
    if (!active) {
      if (!hasNotifiedRef.current) {
        hasNotifiedRef.current = true;
        onExpiredRef.current?.();
      }
      return;
    }
    if (expiresAtMs === null) return;

    const msLeft = expiresAtMs - Date.now();
    if (msLeft <= 0) {
      setNowMs(Date.now());
      return;
    }

    // Tick every 1s inside the final 24h; otherwise schedule exact wakeup at 24h mark or expiry
    if (msLeft <= 86_400_000) {
      const id = setInterval(() => setNowMs(Date.now()), 1000);
      return () => clearInterval(id);
    }

    const msUntilLastDay = msLeft - 86_400_000;
    const waitMs = Math.min(MAX_SETTIMEOUT_MS, Math.max(50, msUntilLastDay + 50));
    const timer = setTimeout(() => setNowMs(Date.now()), waitMs);
    return () => clearTimeout(timer);
  }, [enabled, active, expiresAtMs]);

  return {
    isExpired: !active,
    expiresAtMs,
    remainingMs,
    countdownLabel: formatExpiryCountdown(expiresAt, nowMs, false),
    compactCountdownLabel: formatExpiryCountdown(expiresAt, nowMs, true),
  };
}

/**
 * Schedules a single timeout for the soonest upcoming promo expiry/end timestamp
 * so feeds drop expired Offers and ended Events at the exact moment they expire.
 */
export function useExactExpirySweep(
  timestamps: ReadonlyArray<number | null | undefined>,
  onExpired?: () => void,
): number {
  const [sweepTick, setSweepTick] = useState(0);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const soonestMs = useMemo(() => {
    const now = Date.now();
    let minTs: number | null = null;
    for (const ts of timestamps) {
      if (typeof ts === 'number' && Number.isFinite(ts) && ts > now) {
        if (minTs === null || ts < minTs) {
          minTs = ts;
        }
      }
    }
    return minTs;
  }, [timestamps, sweepTick]);

  useEffect(() => {
    if (soonestMs === null) return;
    const waitMs = Math.min(MAX_SETTIMEOUT_MS, Math.max(50, soonestMs - Date.now() + 50));
    const timer = setTimeout(() => {
      setSweepTick((t) => t + 1);
      onExpiredRef.current?.();
    }, waitMs);
    return () => clearTimeout(timer);
  }, [soonestMs]);

  return sweepTick;
}
