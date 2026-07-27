import { describe, expect, it } from 'vitest';
import { kvkNumberSchema, organizationProfileSchema } from './organization.js';

describe('kvkNumberSchema', () => {
  it('accepts 8 digits', () => {
    expect(kvkNumberSchema.parse('12345678')).toBe('12345678');
  });

  it('rejects short or alpha values', () => {
    expect(() => kvkNumberSchema.parse('123')).toThrow();
    expect(() => kvkNumberSchema.parse('ABCDEFGH')).toThrow();
  });
});

describe('organizationProfileSchema', () => {
  it('requires legal name and validates email', () => {
    const parsed = organizationProfileSchema.parse({
      legalName: 'Lumaro B.V.',
      billingEmail: 'factuur@lumaro.example',
      phone: '+31 20 123 4567',
      kvkNumber: '12345678',
    });
    expect(parsed.legalName).toBe('Lumaro B.V.');
    expect(parsed.country).toBe('NL');
  });
});
