import { describe, expect, it } from 'vitest';
import { resolveProtectionDisplay } from './protection-display.js';

describe('resolveProtectionDisplay', () => {
  it('does not show Beschermd when paused even if eligibility and monitoring are true', () => {
    const result = resolveProtectionDisplay({
      status: 'paused',
      eligibility: { eligible: true, reasonLabelNl: 'Komt in aanmerking' },
      registerMonitoringOk: true,
    });
    expect(result.activelyProtected).toBe(false);
    expect(result.labelNl).toBe('Gepauzeerd — momenteel niet bewaakt');
    expect(result.detailNl).toContain('gepauzeerd');
  });

  it('shows Beschermd for active eligible watches with monitoring OK', () => {
    const result = resolveProtectionDisplay({
      status: 'active',
      eligibility: { eligible: true, reasonLabelNl: 'OK' },
      registerMonitoringOk: true,
    });
    expect(result.activelyProtected).toBe(true);
    expect(result.labelNl).toBe('Beschermd');
  });

  it('never shows Beschermd when register monitoring is offline (connector disabled)', () => {
    const result = resolveProtectionDisplay({
      status: 'active',
      eligibility: { eligible: true, reasonLabelNl: 'OK' },
      registerMonitoringOk: false,
    });
    expect(result.activelyProtected).toBe(false);
    expect(result.labelNl).toBe('Niet bewaakt — register offline');
    expect(result.tone).toBe('warning');
  });

  it('never shows Beschermd when probe is red even if watch is active and eligible', () => {
    const result = resolveProtectionDisplay({
      status: 'active',
      eligibility: { eligible: true, reasonLabelNl: 'Komt in aanmerking' },
      registerMonitoringOk: false,
    });
    expect(result.activelyProtected).toBe(false);
    expect(result.labelNl).toContain('register offline');
  });

  it('shows Niet beschermd for ineligible active watch even with monitoring OK', () => {
    const result = resolveProtectionDisplay({
      status: 'active',
      eligibility: { eligible: false, reasonLabelNl: 'Niet geregistreerd' },
      registerMonitoringOk: true,
    });
    expect(result.activelyProtected).toBe(false);
    expect(result.labelNl).toBe('Niet beschermd');
    expect(result.detailNl).toBe('Niet geregistreerd');
  });

  it('shows Niet beschermd for archived watches', () => {
    const result = resolveProtectionDisplay({
      status: 'archived',
      eligibility: { eligible: true, reasonLabelNl: 'OK' },
      registerMonitoringOk: true,
    });
    expect(result.activelyProtected).toBe(false);
    expect(result.labelNl).toBe('Niet beschermd');
  });
});
