import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  parseTimeToMinutes,
  formatMinutesTo12Hour,
} from '../../components/journey/JourneyCompanionSheet';

describe('REM-05: Journey Companion Dynamic Departure Calculation & Formatting', () => {
  describe('Time Parsing (parseTimeToMinutes)', () => {
    test('parses 24-hour time strings correctly', () => {
      assert.strictEqual(parseTimeToMinutes('15:00'), 900);
      assert.strictEqual(parseTimeToMinutes('14:30'), 870);
      assert.strictEqual(parseTimeToMinutes('09:00'), 540);
      assert.strictEqual(parseTimeToMinutes('00:00'), 0);
    });

    test('parses 12-hour AM/PM time strings correctly', () => {
      assert.strictEqual(parseTimeToMinutes('3:00 PM'), 900);
      assert.strictEqual(parseTimeToMinutes('3:00 pm'), 900);
      assert.strictEqual(parseTimeToMinutes('11:30 AM'), 690);
      assert.strictEqual(parseTimeToMinutes('12:00 PM'), 720); // Noon
      assert.strictEqual(parseTimeToMinutes('12:00 AM'), 0);   // Midnight
      assert.strictEqual(parseTimeToMinutes('1:45 PM'), 825);
    });

    test('falls back gracefully to 3:00 PM (900 min) on null or invalid strings', () => {
      assert.strictEqual(parseTimeToMinutes(null), 900);
      assert.strictEqual(parseTimeToMinutes(undefined), 900);
      assert.strictEqual(parseTimeToMinutes('invalid-time'), 900);
    });
  });

  describe('12-Hour Time Formatting (formatMinutesTo12Hour)', () => {
    test('formats minutes into standard 12-hour string', () => {
      assert.strictEqual(formatMinutesTo12Hour(900), '3:00 PM');
      assert.strictEqual(formatMinutesTo12Hour(843), '2:03 PM');
      assert.strictEqual(formatMinutesTo12Hour(765), '12:45 PM');
      assert.strictEqual(formatMinutesTo12Hour(690), '11:30 AM');
      assert.strictEqual(formatMinutesTo12Hour(0), '12:00 AM');
      assert.strictEqual(formatMinutesTo12Hour(720), '12:00 PM');
    });

    test('handles negative minutes or day wrap-around cleanly', () => {
      // -15 minutes from midnight wraps to 11:45 PM of prior day
      assert.strictEqual(formatMinutesTo12Hour(-15), '11:45 PM');
    });
  });

  describe('Dynamic Departure Time Math (REM-05)', () => {
    function computeDeparture(checkInStr: string | null, travelTimeMin: number, bufferMin = 15) {
      const checkInMin = parseTimeToMinutes(checkInStr);
      const departureMin = checkInMin - travelTimeMin - bufferMin;
      return {
        checkInFormatted: formatMinutesTo12Hour(checkInMin),
        departureFormatted: formatMinutesTo12Hour(departureMin),
      };
    }

    test('computes dynamic departure for 3:00 PM check-in and 42 min route', () => {
      // 900 min - 42 min - 15 min buffer = 843 min -> 2:03 PM
      const result = computeDeparture('15:00', 42);
      assert.strictEqual(result.checkInFormatted, '3:00 PM');
      assert.strictEqual(result.departureFormatted, '2:03 PM');
      // Verifies departure is no longer the static "1:45 PM"
      assert.notStrictEqual(result.departureFormatted, '1:45 PM');
    });

    test('computes dynamic departure for 2:00 PM check-in and 60 min route', () => {
      // 840 min - 60 min - 15 min buffer = 765 min -> 12:45 PM
      const result = computeDeparture('14:00', 60);
      assert.strictEqual(result.checkInFormatted, '2:00 PM');
      assert.strictEqual(result.departureFormatted, '12:45 PM');
    });

    test('computes dynamic departure for 4:00 PM check-in and 30 min route', () => {
      // 960 min - 30 min - 15 min buffer = 915 min -> 3:15 PM
      const result = computeDeparture('4:00 PM', 30);
      assert.strictEqual(result.checkInFormatted, '4:00 PM');
      assert.strictEqual(result.departureFormatted, '3:15 PM');
    });
  });
});
