import { differenceInDays } from "date-fns";

const REEL_VALIDITY_DAYS = 90;
const EXPIRY_THRESHOLD_DAYS = 45;

export function getReelExpiryDisplay(postedDate: Date): string {
  const now = new Date();
  const daysSincePosted = differenceInDays(now, postedDate);
  
  if (daysSincePosted < 0) {
    return "Just posted";
  }
  
  if (daysSincePosted <= EXPIRY_THRESHOLD_DAYS) {
    // First 45 days: show "X days ago"
    if (daysSincePosted === 0) {
      return "Posted today";
    } else if (daysSincePosted === 1) {
      return "Posted 1 day ago";
    } else {
      return `Posted ${daysSincePosted} days ago`;
    }
  } else {
    // After 45 days: show "X days left to expire"
    const daysLeft = REEL_VALIDITY_DAYS - daysSincePosted;
    
    if (daysLeft <= 0) {
      return "Expired";
    } else if (daysLeft === 1) {
      return "1 day left to expire";
    } else {
      return `${daysLeft} days left to expire`;
    }
  }
}

export function isReelExpired(postedDate: Date): boolean {
  const daysSincePosted = differenceInDays(new Date(), postedDate);
  return daysSincePosted >= REEL_VALIDITY_DAYS;
}

export function isReelExpiringSoon(postedDate: Date): boolean {
  const daysSincePosted = differenceInDays(new Date(), postedDate);
  return daysSincePosted > EXPIRY_THRESHOLD_DAYS && daysSincePosted < REEL_VALIDITY_DAYS;
}
