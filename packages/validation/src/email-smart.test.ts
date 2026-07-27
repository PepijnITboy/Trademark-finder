import { describe, expect, it } from 'vitest';
import { isValidBusinessEmail, suggestEmailFixes } from './email-smart.js';

describe('isValidBusinessEmail', () => {
  it('accepts common business TLDs', () => {
    expect(isValidBusinessEmail('info@lumaro.nl')).toBe(true);
    expect(isValidBusinessEmail('sales@example.com')).toBe(true);
    expect(isValidBusinessEmail('team@brand.co.uk')).toBe(true);
  });

  it('rejects missing @, local part, or unknown TLD', () => {
    expect(isValidBusinessEmail('not-an-email')).toBe(false);
    expect(isValidBusinessEmail('@domain.nl')).toBe(false);
    expect(isValidBusinessEmail('user@domain')).toBe(false);
    expect(isValidBusinessEmail('user@domain.xyz')).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(isValidBusinessEmail('  factuur@lumaro.nl  ')).toBe(true);
  });
});

describe('suggestEmailFixes', () => {
  it('returns nothing when @ is missing', () => {
    expect(suggestEmailFixes('jan.example.nl')).toEqual([]);
  });

  it('suggests TLDs when domain has no dot', () => {
    expect(suggestEmailFixes('jan@lumaro')).toEqual(['jan@lumaro.nl', 'jan@lumaro.com']);
  });

  it('suggests trimmed value when spaces were present', () => {
    expect(suggestEmailFixes('jan @ lumaro.nl')).toEqual(['jan@lumaro.nl']);
  });
});
