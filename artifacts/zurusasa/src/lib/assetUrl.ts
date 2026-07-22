const LOVABLE_ASSET_ORIGIN =
  "https://id-preview--7bea4fed-c2de-4e5f-8856-73061c0e9553.lovable.app";

/**
 * Resolves a Lovable asset pointer URL to an absolute URL so it works
 * when the site is hosted outside of Lovable (e.g. Vercel).
 */
export function assetUrl(u: string): string {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/__l5e/")) return `${LOVABLE_ASSET_ORIGIN}${u}`;
  return u;
}
