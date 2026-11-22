// Standard GSM-7 basic + extension characters (safe single-byte encoding: 160 chars/part)
const GSM7_SAFE_RE =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\^{}\\[~\]|€]*$/;

const SMART_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/[\u2013\u2014\u2015]/g, '-'],
  [/\u2026/g, '...'],
  [/\u2022/g, '-'],
  [/\u00A0/g, ' '],
  [/\u2192/g, '->'],
];

/**
 * Checks if text fits within standard GSM-7 character set (no UCS-2 downgrade).
 */
export function isGsm7(text: string): boolean {
  return GSM7_SAFE_RE.test(text);
}

/**
 * Sanitizes SMS copy to pure GSM-7 (preventing silent 160 -> 70 char UCS-2 cost explosions)
 * and enforces max length while preserving an optional trailing reference tag (e.g. "Ref #A1B2C3D4").
 */
export function sanitizeSmsText(
  rawText: string,
  maxChars = 160,
  preserveTrailingRef?: string,
): string {
  let text = String(rawText ?? '');

  for (const [pattern, replacement] of SMART_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Strip emojis & non-GSM-7 characters while keeping readable ASCII/GSM-7 characters
  let cleaned = '';
  for (const ch of text) {
    if (GSM7_SAFE_RE.test(ch)) {
      cleaned += ch;
    }
  }

  cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();

  const refSuffix = preserveTrailingRef ? ` ${preserveTrailingRef.trim()}` : '';
  const hasRefAlready =
    refSuffix.length > 0 && cleaned.toLowerCase().includes(preserveTrailingRef!.trim().toLowerCase());

  const fullText = hasRefAlready ? cleaned : `${cleaned}${refSuffix}`.trim();

  if (fullText.length <= maxChars) {
    return fullText;
  }

  if (refSuffix && !hasRefAlready && refSuffix.length + 4 < maxChars) {
    const budget = maxChars - refSuffix.length - 3;
    const head = cleaned.slice(0, Math.max(0, budget)).trimEnd();
    return `${head}...${refSuffix}`;
  }

  return `${fullText.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function estimateSmsParts(text: string): number {
  if (!text) return 0;
  if (isGsm7(text)) {
    return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
  }
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}
