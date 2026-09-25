import { describe, expect, it } from 'vitest';

import {
  operifyProvisioningAuthorised,
  parseLogoDataUrl,
  ZProvisionOperifyTeamRequestSchema,
} from './provision-operify-team';

const SECRET = 'a-secret-long-enough-for-the-check';

describe('operifyProvisioningAuthorised', () => {
  it('accepts the exact bearer secret only', () => {
    expect(operifyProvisioningAuthorised(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(operifyProvisioningAuthorised(`bearer ${SECRET}`, SECRET)).toBe(true);
    expect(operifyProvisioningAuthorised(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(operifyProvisioningAuthorised(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false);
    expect(operifyProvisioningAuthorised(SECRET, SECRET)).toBe(false);
    expect(operifyProvisioningAuthorised(null, SECRET)).toBe(false);
  });

  it('refuses everything when the secret is unset or short', () => {
    expect(operifyProvisioningAuthorised('Bearer short', 'short')).toBe(false);
    expect(operifyProvisioningAuthorised('Bearer anything', undefined)).toBe(false);
    expect(operifyProvisioningAuthorised('Bearer ', '')).toBe(false);
  });
});

describe('parseLogoDataUrl', () => {
  it('decodes a png data URL', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const parsed = parseLogoDataUrl(`data:image/png;base64,${png.toString('base64')}`);

    expect(parsed.type).toBe('image/png');
    expect(parsed.bytes.equals(png)).toBe(true);
  });

  it('rejects anything that is not an image data URL', () => {
    expect(() => parseLogoDataUrl('https://example.com/logo.png')).toThrow();
    expect(() => parseLogoDataUrl('data:text/html;base64,PGh0bWw+')).toThrow();
    expect(() => parseLogoDataUrl('data:image/png;base64,')).toThrow();
  });
});

describe('ZProvisionOperifyTeamRequestSchema', () => {
  const base = {
    teamUrl: 'st-cmpyay1rv00009kccyhkbnyk3',
    name: 'Halcyon Cleaning Ltd',
    webhookUrl: 'https://api.staging.operifyai.co.uk/api/v1/webhooks/signify',
    webhookSecret: 'x'.repeat(64),
    branding: {},
  };

  it('applies the team URL rules and the defaults', () => {
    const parsed = ZProvisionOperifyTeamRequestSchema.parse(base);

    expect(parsed.includeSenderDetails).toBe(false);
    expect(parsed.rotateToken).toBe(false);
    expect(parsed.branding).toEqual({ enabled: true, url: '', companyDetails: '', colors: null });
    expect(parsed.branding.logo).toBeUndefined();
  });

  it('refuses a team URL outside the rules', () => {
    for (const teamUrl of ['ab', '-abc', 'abc-', 'a'.repeat(31), 'With Space']) {
      expect(ZProvisionOperifyTeamRequestSchema.safeParse({ ...base, teamUrl }).success).toBe(false);
    }
  });

  it('keeps null and string logos apart', () => {
    expect(ZProvisionOperifyTeamRequestSchema.parse({ ...base, branding: { logo: null } }).branding.logo).toBeNull();
    expect(
      ZProvisionOperifyTeamRequestSchema.parse({ ...base, branding: { logo: 'data:image/png;base64,AA==' } }).branding
        .logo,
    ).toBe('data:image/png;base64,AA==');
  });
});
