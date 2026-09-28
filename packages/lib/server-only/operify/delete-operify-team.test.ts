import { describe, expect, it } from 'vitest';

import { ZDeleteOperifyTeamRequestSchema } from './delete-operify-team.schema';

describe('ZDeleteOperifyTeamRequestSchema', () => {
  it('accepts only a tenant team, on either environment', () => {
    expect(ZDeleteOperifyTeamRequestSchema.safeParse({ teamUrl: 'st-cmg1abc2d0000x9y8z7w6v5u4' }).success).toBe(true);
    expect(ZDeleteOperifyTeamRequestSchema.safeParse({ teamUrl: 'pr-cmg1abc2d0000x9y8z7w6v5u4' }).success).toBe(true);
  });

  it("refuses the environment teams, a person's team and anything that is not a team url", () => {
    for (const teamUrl of [
      'operify-staging',
      'operify-production',
      'operify',
      'dev-tenant',
      'st-',
      'st-Tenant',
      'pr-tenant/other',
      '',
    ]) {
      expect(ZDeleteOperifyTeamRequestSchema.safeParse({ teamUrl }).success, teamUrl).toBe(false);
    }
  });
});
