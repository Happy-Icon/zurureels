export interface E164ValidationResult {
  valid: boolean;
  e164: string;
  error?: string;
}

const KENYAN_E164_RE = /^\+254(?:7|1)\d{8}$/;
const GENERAL_E164_RE = /^\+[1-9]\d{7,14}$/;

/**
 * Validates and normalizes Kenyan and international phone numbers to strict E.164 format.
 *
 * Handled examples (defaultCountryCode = '254'):
 *  - "0712345678"      -> "+254712345678"
 *  - "0112345678"      -> "+254112345678"
 *  - "712345678"       -> "+254712345678"  (fixes legacy +7 Russia bug!)
 *  - "112345678"       -> "+254112345678"
 *  - "254712345678"    -> "+254712345678"
 *  - "+254 712 345678" -> "+254712345678"
 *  - "00254712345678"  -> "+254712345678"
 *  - "+447911123456"   -> "+447911123456"
 */
export function formatToE164(
  rawPhone: string | null | undefined,
  defaultCountryCode = '254',
): E164ValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, e164: '', error: 'No phone number provided' };
  }

  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) {
    return { valid: false, e164: '', error: 'Phone number contains no numeric digits' };
  }

  // Collapse multiple '+' or misplaced '+' signs
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  const cc = defaultCountryCode.replace(/\D/g, '') || '254';

  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1).replace(/\D/g, '');
    cleaned = `+${digitsOnly}`;
    // Fix common mistake "+2540712345678" -> "+254712345678"
    if (cleaned.startsWith(`+${cc}0`) && cleaned.length === 1 + cc.length + 10) {
      cleaned = `+${cc}${cleaned.slice(1 + cc.length + 1)}`;
    }
  } else {
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (cc === '254') {
      if (/^0(?:7|1)\d{8}$/.test(digitsOnly)) {
        cleaned = `+254${digitsOnly.slice(1)}`;
      } else if (/^(?:7|1)\d{8}$/.test(digitsOnly)) {
        // 9-digit local Kenyan number without leading 0
        cleaned = `+254${digitsOnly}`;
      } else if (/^2540(?:7|1)\d{8}$/.test(digitsOnly)) {
        cleaned = `+254${digitsOnly.slice(4)}`;
      } else if (/^254(?:7|1)\d{8}$/.test(digitsOnly)) {
        cleaned = `+${digitsOnly}`;
      } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15 && !digitsOnly.startsWith('0')) {
        cleaned = `+${digitsOnly}`;
      } else {
        return {
          valid: false,
          e164: digitsOnly,
          error: 'Enter a valid Kenyan mobile number (e.g. 0712345678 or +254712345678)',
        };
      }
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
      cleaned = `+${cc}${digitsOnly.slice(1)}`;
    } else {
      cleaned = `+${digitsOnly}`;
    }
  }

  // Enforce strict Kenyan mobile structure whenever the +254 country code is used
  if (cleaned.startsWith('+254')) {
    if (!KENYAN_E164_RE.test(cleaned)) {
      return {
        valid: false,
        e164: cleaned,
        error: 'Kenyan phone number must be +2547XXXXXXXX or +2541XXXXXXXX',
      };
    }
    return { valid: true, e164: cleaned };
  }

  if (!GENERAL_E164_RE.test(cleaned)) {
    return {
      valid: false,
      e164: cleaned,
      error: 'Phone number is not in valid E.164 format',
    };
  }

  return { valid: true, e164: cleaned };
}

export function isKenyanE164(e164: string): boolean {
  return KENYAN_E164_RE.test(e164);
}

export function maskPhoneForLogs(phone: string): string {
  const clean = String(phone || '').trim();
  if (clean.length <= 6) return '***';
  return `${clean.slice(0, 6)}***${clean.slice(-3)}`;
}
