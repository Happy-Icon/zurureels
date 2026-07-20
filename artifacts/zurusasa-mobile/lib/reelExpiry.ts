// Mirrors the web app's utils/reelExpiry.ts: reels are valid for 90 days.
// 0-45 days: "Posted X days ago" · 46-90: "X days left to expire" (urgent) · 90+: "Expired".

export const REEL_VALIDITY_DAYS = 90;
const URGENT_AFTER_DAYS = 45;

export interface ReelExpiryDisplay {
  label: string;
  urgent: boolean;
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
