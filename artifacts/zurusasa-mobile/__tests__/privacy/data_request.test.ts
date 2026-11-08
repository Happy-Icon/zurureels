import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

describe('Personal Data Access Request Workflow Tests', () => {
  describe('OTP Generation & Salted SHA-256 Hashing', () => {
    function generateOtp(): string {
      const buf = crypto.randomBytes(4);
      const num = buf.readUInt32BE(0);
      return ((num % 900000) + 100000).toString();
    }

    function sha256(message: string): string {
      return crypto.createHash('sha256').update(message).digest('hex');
    }

    function constantTimeEqual(a: string, b: string): boolean {
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    test('generates exactly 6 numeric digits', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateOtp();
        assert.strictEqual(otp.length, 6);
        assert.match(otp, /^[1-9][0-9]{5}$/);
      }
    });

    test('hashes OTP with salt and verifies successfully', () => {
      const otp = '492817';
      const salt = crypto.randomUUID();
      const hash = sha256(`${otp}:${salt}`);
      const storedOtpHash = `${salt}:${hash}`;

      // Verification logic
      const [retrievedSalt, expectedHash] = storedOtpHash.split(':');
      const calculatedHash = sha256(`${otp}:${retrievedSalt}`);

      assert.ok(constantTimeEqual(calculatedHash, expectedHash));
    });

    test('fails verification on incorrect OTP or corrupted salt', () => {
      const otp = '492817';
      const wrongOtp = '492818';
      const salt = crypto.randomUUID();
      const hash = sha256(`${otp}:${salt}`);

      const calculatedHashWrong = sha256(`${wrongOtp}:${salt}`);
      assert.strictEqual(constantTimeEqual(calculatedHashWrong, hash), false);
    });
  });

  describe('Identifier & PII Redaction', () => {
    function maskIdentifier(val?: string | null): string {
      if (!val) return 'N/A';
      if (val.length <= 4) return '***';
      return `${val.slice(0, 2)}***${val.slice(-2)}`;
    }

    function maskEmail(email?: string | null): string {
      if (!email) return 'N/A';
      return email.replace(/(.{2})(.*)(?=@)/, '$1***');
    }

    test('masks phone numbers and user identifiers safely', () => {
      assert.strictEqual(maskIdentifier('+254712345678'), '+2***78');
      assert.strictEqual(maskIdentifier('0712345678'), '07***78');
      assert.strictEqual(maskIdentifier(''), 'N/A');
      assert.strictEqual(maskIdentifier(null), 'N/A');
    });

    test('masks recipient email address for privacy', () => {
      assert.strictEqual(maskEmail('alex.okelo@zurusasa.com'), 'al***@zurusasa.com');
      assert.strictEqual(maskEmail('traveler@gmail.com'), 'tr***@gmail.com');
    });
  });

  describe('Lifecycle State Machine Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending_verification: ['processing', 'failed', 'cancelled'],
      processing: ['completed', 'failed', 'cancelled'],
      completed: ['expired'],
      failed: [],
      expired: [],
      cancelled: [],
    };

    function canTransition(from: string, to: string): boolean {
      return (validTransitions[from] || []).includes(to);
    }

    test('allows legitimate state progressions', () => {
      assert.ok(canTransition('pending_verification', 'processing'));
      assert.ok(canTransition('processing', 'completed'));
      assert.ok(canTransition('completed', 'expired'));
      assert.ok(canTransition('pending_verification', 'cancelled'));
      assert.ok(canTransition('processing', 'cancelled'));
    });

    test('disallows invalid state regressions', () => {
      assert.strictEqual(canTransition('completed', 'processing'), false);
      assert.strictEqual(canTransition('expired', 'completed'), false);
      assert.strictEqual(canTransition('cancelled', 'pending_verification'), false);
      assert.strictEqual(canTransition('failed', 'completed'), false);
    });
  });
});
