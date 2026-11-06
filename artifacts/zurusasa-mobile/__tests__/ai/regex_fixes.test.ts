import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AC_REGEX, BUDGET_REGEX, STANDALONE_K_REGEX, searchService } from '../../services/searchService';

describe('REM-07: Word-Boundary Regex and Budget Parsing Fixes', () => {
  describe('Air Conditioning (AC) Regex Boundary Verification', () => {
    test('AC_REGEX matches valid AC queries', () => {
      assert.strictEqual(AC_REGEX.test('villa with ac'), true);
      assert.strictEqual(AC_REGEX.test('villa with AC'), true);
      assert.strictEqual(AC_REGEX.test('villa with a/c'), true);
      assert.strictEqual(AC_REGEX.test('villa with air conditioning'), true);
      assert.strictEqual(AC_REGEX.test('villa with air-conditioning'), true);
      assert.strictEqual(AC_REGEX.test('air conditioning in bedroom'), true);
      assert.strictEqual(AC_REGEX.test('need A/C'), true);
    });

    test('AC_REGEX does NOT falsely match words containing "ac"', () => {
      // Prior bug: q.includes('ac') matched substrings inside normal words
      assert.strictEqual(AC_REGEX.test('beach villa in diani'), false, '"beach" contains "ac"');
      assert.strictEqual(AC_REGEX.test('peaceful cottage in watamu'), false, '"peaceful" contains "ac"');
      assert.strictEqual(AC_REGEX.test('spacious 2-bedroom apartment'), false, '"spacious" contains "ac"');
      assert.strictEqual(AC_REGEX.test('luxury palace accommodation'), false, '"palace" and "accommodation" contain "ac"');
      assert.strictEqual(AC_REGEX.test('dhow yacht cruise'), false, '"yacht" contains "ac"');
      assert.strictEqual(AC_REGEX.test('fun coastal activity'), false, '"activity" contains "ac"');
      assert.strictEqual(AC_REGEX.test('tourist attraction'), false, '"attraction" contains "ac"');
    });

    test('searchService.parseNaturalLanguageQuery only tags AC when explicitly requested', () => {
      const peaceful = searchService.parseNaturalLanguageQuery('peaceful beach villa in watamu');
      assert.ok(!peaceful.amenities?.includes('Air Conditioning'), 'peaceful beach must not include Air Conditioning');
      assert.ok(peaceful.amenities?.includes('Beach Front'), 'beach must include Beach Front');

      const withAc = searchService.parseNaturalLanguageQuery('beach villa with ac in watamu');
      assert.ok(withAc.amenities?.includes('Air Conditioning'), 'ac must include Air Conditioning');
      assert.ok(withAc.amenities?.includes('Beach Front'), 'beach must include Beach Front');
    });
  });

  describe('Budget Multiplier and Currency Boundary Verification', () => {
    test('BUDGET_REGEX does NOT trigger 1,000x multiplier on queries containing the letter "k"', () => {
      // Prior bug: q.includes('k') turned 20,000 into 20,000,000
      const kilifi = searchService.parseNaturalLanguageQuery('under 20000 in kilifi');
      assert.strictEqual(kilifi.maxPrice, 20000, 'kilifi letter "k" must not multiply budget');

      const kes = searchService.parseNaturalLanguageQuery('under 30000 kes');
      assert.strictEqual(kes.maxPrice, 30000, '"kes" letter "k" must not multiply budget');

      const ksh = searchService.parseNaturalLanguageQuery('under 30000 ksh');
      assert.strictEqual(ksh.maxPrice, 30000, '"ksh" letter "k" must not multiply budget');

      const kisumu = searchService.parseNaturalLanguageQuery('below 50000 in kisumu');
      assert.strictEqual(kisumu.maxPrice, 50000, '"kisumu" letter "k" must not multiply budget');

      const kayak = searchService.parseNaturalLanguageQuery('under 10000 for kayak');
      assert.strictEqual(kayak.maxPrice, 10000, '"kayak" letter "k" must not multiply budget');
    });

    test('BUDGET_REGEX accurately multiplies standalone "k" units by 1,000', () => {
      const under15k = searchService.parseNaturalLanguageQuery('under 15k in diani');
      assert.strictEqual(under15k.maxPrice, 15000, '"15k" must multiply to 15,000');

      const below25k = searchService.parseNaturalLanguageQuery('below 25 k in watamu');
      assert.strictEqual(below25k.maxPrice, 25000, '"25 k" must multiply to 25,000');

      const max10k = searchService.parseNaturalLanguageQuery('max 10k');
      assert.strictEqual(max10k.maxPrice, 10000, '"10k" must multiply to 10,000');
    });

    test('BUDGET_REGEX handles comma formatted numbers cleanly', () => {
      const comma = searchService.parseNaturalLanguageQuery('under 25,000 in malindi');
      assert.strictEqual(comma.maxPrice, 25000, 'comma formatted number must parse cleanly');
    });
  });
});
