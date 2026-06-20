import { describe, it, expect, beforeEach } from 'vitest';
import { applyBranding, getActiveBrand, COLORS, FONT_FAMILY } from '../../pdf/theme.js';

describe('applyBranding', () => {
  beforeEach(() => {
    applyBranding(null);
  });

  it('returns the active brand with default Arra values', () => {
    const brand = getActiveBrand();
    expect(brand.footerLabel).toBe('arra.homma.casa');
    expect(brand.reportKicker).toBe('Arra · Audit Report');
    expect(brand.colors.accent).toBe('#ff6a00');
  });

  it('applies valid hex color overrides', () => {
    const brand = applyBranding({ colors: { accent: '#33aa55' } });
    expect(brand.colors.accent).toBe('#33aa55');
    expect(COLORS.accent).toBe('#33aa55');
  });

  it('rejects non-hex color overrides', () => {
    const before = COLORS.accent;
    applyBranding({ colors: { accent: 'rgb(0,0,0)' } });
    expect(COLORS.accent).toBe(before);
  });

  it('caps footerLabel/reportKicker at 64 chars and falls back to defaults', () => {
    const long = 'x'.repeat(200);
    const brand = applyBranding({ footerLabel: long, reportKicker: long });
    expect(brand.footerLabel.length).toBe(64);
    expect(brand.reportKicker.length).toBe(64);

    applyBranding({ footerLabel: '', reportKicker: '' });
    const reset = getActiveBrand();
    expect(reset.footerLabel).toBe('arra.homma.casa');
    expect(reset.reportKicker).toBe('Arra · Audit Report');
  });

  it('applies font family overrides and ignores non-string', () => {
    const brand = applyBranding({ fonts: { body: 'Inter', mono: 'JetBrainsMono' } });
    expect(brand.fonts.body).toBe('Inter');
    expect(brand.fonts.mono).toBe('JetBrainsMono');
    expect(FONT_FAMILY.body).toBe('Inter');
  });

  it('reset to defaults when called with null', () => {
    applyBranding({ colors: { accent: '#000000' } });
    expect(COLORS.accent).toBe('#000000');
    applyBranding(null);
    expect(COLORS.accent).toBe('#ff6a00');
  });
});
