// Reels are valid for exactly 15 days.
// 0-10 days: "Posted X days ago" (or "Posted today") · 11-15: "X days left to expire" (urgent) · 15+: "Expired".

export const REEL_VALIDITY_DAYS = 15;
const URGENT_AFTER_DAYS = 10;

export interface ReelExpiryDisplay {
  label: string;
  urgent: boolean;
}

/**
 * Returns the ISO-8601 timestamp cutoff for active (non-expired) reels.
 * Used as an opt-in `.gte('created_at', getReelExpiryCutoffIso())` SQL filter;
 * default feeds keep displaying older reels with the `'Expired'` badge until hosts re-post.
 */
export function getReelExpiryCutoffIso(days: number = REEL_VALIDITY_DAYS): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function isReelExpired(
  createdAt: string | null | undefined,
  days: number = REEL_VALIDITY_DAYS,
): boolean {
  if (!createdAt) return false;
  const posted = new Date(createdAt).getTime();
  if (Number.isNaN(posted)) return false;
  return Math.floor((Date.now() - posted) / 86_400_000) > days;
}

export function getReelExpiry(
  createdAt: string | null | undefined,
): ReelExpiryDisplay | null {
  if (!createdAt) return null;
  const posted = new Date(createdAt).getTime();
  if (Number.isNaN(posted)) return null;

  const daysSincePosted = Math.floor((Date.now() - posted) / 86_400_000);

  if (daysSincePosted > REEL_VALIDITY_DAYS) {
    return { label: 'Expired', urgent: true };
  }
  if (daysSincePosted > URGENT_AFTER_DAYS) {
    const left = REEL_VALIDITY_DAYS - daysSincePosted;
    return {
      label: `${left} day${left === 1 ? '' : 's'} left to expire`,
      urgent: true,
    };
  }
  if (daysSincePosted <= 0) {
    return { label: 'Posted today', urgent: false };
  }
  return {
    label: `Posted ${daysSincePosted} day${daysSincePosted === 1 ? '' : 's'} ago`,
    urgent: false,
  };
}
