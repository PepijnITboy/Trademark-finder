import { describe, expect, it } from 'vitest';
import {
  compareRegistersByPriority,
  DEFAULT_REGISTER_CATALOG,
  sortRegistersByPriority,
} from './register-catalog.js';

describe('sortRegistersByPriority', () => {
  it('orders BOIP before EUIPO before DE/FR/UK before the rest', () => {
    const sorted = sortRegistersByPriority(DEFAULT_REGISTER_CATALOG);
    const codes = sorted.map((r) => r.code);
    expect(codes.indexOf('BOIP')).toBeLessThan(codes.indexOf('EUIPO'));
    expect(codes.indexOf('EUIPO')).toBeLessThan(codes.indexOf('DPMA'));
    expect(codes.indexOf('DPMA')).toBeLessThan(codes.indexOf('UKIPO'));
  });

  it('compareRegistersByPriority ranks BOIP first', () => {
    const boip = DEFAULT_REGISTER_CATALOG.find((r) => r.code === 'BOIP')!;
    const euipo = DEFAULT_REGISTER_CATALOG.find((r) => r.code === 'EUIPO')!;
    expect(compareRegistersByPriority(boip, euipo)).toBeLessThan(0);
  });
});
