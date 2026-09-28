import { z } from 'zod';

/**
 * The body of DELETE /api/operify/teams. On its own so the route and the
 * tests can read the shape without loading the deletion and everything it
 * reaches (the team delete's emails, the job runner).
 *
 * Only the teams Operify provisions (st-<tenant> on staging, pr-<tenant> on
 * production): the machine account's own teams and anything a person made
 * are out of reach.
 */
export const ZDeleteOperifyTeamRequestSchema = z.object({
  teamUrl: z.string().regex(/^(st|pr)-[a-z0-9-]{1,80}$/, 'Only a tenant team, st-<tenant> or pr-<tenant>'),
});

export type TDeleteOperifyTeamRequest = z.infer<typeof ZDeleteOperifyTeamRequestSchema>;
