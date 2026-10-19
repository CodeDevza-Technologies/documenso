import { colord, extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import { describe, expect, it } from 'vitest';

import { BRAND_BUTTON_DARK_INK, ensureReadableBrandButton } from './brand-button-contrast';

extend([a11yPlugin]);

const contrast = ({ fill, foreground }: { fill: string; foreground: string }) =>
  colord(foreground).contrast(colord(fill));

describe('ensureReadableBrandButton', () => {
  it('keeps a dark brand colour that already carries white', () => {
    expect(ensureReadableBrandButton({ fill: '#1e3a8a' })).toEqual({ fill: '#1e3a8a', foreground: '#ffffff' });
  });

  it('darkens the default green a few points so white reads on it', () => {
    const result = ensureReadableBrandButton({ fill: '#1EB980', foreground: '#FFFFFF' });

    expect(result.foreground).toBe('#ffffff');
    expect(result.fill).not.toBe('#1EB980');
    expect(contrast(result)).toBeGreaterThanOrEqual(4.5);
    expect(colord(result.fill).toHsl().h).toBeCloseTo(colord('#1EB980').toHsl().h, 0);
  });

  it('keeps a light brand colour and gives it dark ink rather than darkening it out of the brand', () => {
    const result = ensureReadableBrandButton({ fill: '#fde047' });

    expect(result).toEqual({ fill: '#fde047', foreground: BRAND_BUTTON_DARK_INK });
    expect(contrast(result)).toBeGreaterThanOrEqual(4.5);
  });
});
