import { describe, expect, it } from 'vitest';
import {
  canComputeNiceClassOverlap,
  getClassificationScheme,
  NICE_45_SCHEME,
  resolveClassPickerOptions,
  US_LEGACY_CERT_SCHEME,
} from './classification-schemes.js';

describe('classification schemes', () => {
  it('nice_45 exposes exactly 45 classes numbered 1–45', () => {
    expect(NICE_45_SCHEME.classes).toHaveLength(45);
    expect(NICE_45_SCHEME.classes[0]?.code).toBe(1);
    expect(NICE_45_SCHEME.classes[44]?.code).toBe(45);
  });

  it('us_legacy_cert is not Nice and has A/B/200', () => {
    const codes = US_LEGACY_CERT_SCHEME.classes.map((c) => c.code);
    expect(codes).toEqual(['A', 'B', 200]);
  });

  it('getClassificationScheme throws on unknown id', () => {
    expect(() => getClassificationScheme('unknown_scheme')).toThrow(/Unknown classification scheme/);
  });

  it('canComputeNiceClassOverlap only when both sides are nice_45', () => {
    expect(canComputeNiceClassOverlap('nice_45', 'nice_45')).toBe(true);
    expect(canComputeNiceClassOverlap('nice_45', 'us_legacy_cert')).toBe(false);
    expect(canComputeNiceClassOverlap('us_legacy_cert', 'us_legacy_cert')).toBe(false);
  });

  it('resolveClassPickerOptions defaults to nice_45', () => {
    const result = resolveClassPickerOptions([]);
    expect(result.comparable).toBe(true);
    expect(result.schemeId).toBe('nice_45');
    expect(result.classes).toHaveLength(45);
  });

  it('resolveClassPickerOptions intersects multi nice_45 registers', () => {
    const result = resolveClassPickerOptions(['nice_45', 'nice_45']);
    expect(result.comparable).toBe(true);
    expect(result.schemeId).toBe('nice_45');
  });

  it('resolveClassPickerOptions refuses false Nice overlap across schemes', () => {
    const result = resolveClassPickerOptions(['nice_45', 'us_legacy_cert']);
    expect(result.comparable).toBe(false);
    expect(result.schemeId).toBeNull();
    expect(result.classes).toEqual([]);
    expect(result.perScheme['nice_45']).toHaveLength(45);
    expect(result.perScheme['us_legacy_cert']).toHaveLength(3);
  });

  it('single us_legacy_cert picker returns only legacy classes', () => {
    const result = resolveClassPickerOptions(['us_legacy_cert']);
    expect(result.comparable).toBe(true);
    expect(result.schemeId).toBe('us_legacy_cert');
    expect(result.classes.map((c) => c.code)).toEqual(['A', 'B', 200]);
  });
});
