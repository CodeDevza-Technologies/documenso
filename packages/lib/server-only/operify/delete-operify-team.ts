import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@prisma/client';
import { z } from 'zod';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { deleteFile } from '../../universal/upload/delete-file';
import { deleteTeam } from '../team/delete-team';

/**
 * DELETE /api/operify/teams: Operify removes a tenant's team when the tenant
 * leaves, with every envelope, recipient, field, audit log and stored file
 * it holds. The team's own delete leaves the document data rows and the files
 * in the bucket behind; this takes them too, so nothing of the tenant's
 * documents remains on the cell.
 *
 * Only the teams Operify provisions (st-<tenant> on staging, pr-<tenant> on
 * production), and only inside the Operify organisation: the machine
 * account's own teams and anything a person made are out of reach here.
 */
export const ZDeleteOperifyTeamRequestSchema = z.object({
  teamUrl: z.string().regex(/^(st|pr)-[a-z0-9-]{1,80}$/, 'Only a tenant team, st-<tenant> or pr-<tenant>'),
});

export type TDeleteOperifyTeamRequest = z.infer<typeof ZDeleteOperifyTeamRequestSchema>;

export type DeleteOperifyTeamResult = {
  teamUrl: string;
  envelopes: number;
  files: number;
};

export const deleteOperifyTeam = async (input: TDeleteOperifyTeamRequest): Promise<DeleteOperifyTeamResult> => {
  const organisationUrl = process.env.NEXT_PRIVATE_OPERIFY_ORGANISATION_URL || 'operify';

  const organisation = await prisma.organisation.findFirst({
    where: { url: organisationUrl, type: OrganisationType.ORGANISATION },
    select: { id: true, ownerUserId: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: `Organisation ${organisationUrl} does not exist; run sign/scripts/provision-organisation.sh`,
    });
  }

  const team = await prisma.team.findFirst({
    where: { url: input.teamUrl, organisationId: organisation.id },
    select: { id: true, url: true },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Team ${input.teamUrl} does not exist in organisation ${organisationUrl}`,
    });
  }

  const envelopes = await prisma.envelope.findMany({
    where: { teamId: team.id },
    select: {
      id: true,
      envelopeItems: {
        select: { documentData: { select: { id: true, type: true, data: true, initialData: true } } },
      },
    },
  });

  // The files first: a row can be deleted again, a file whose row is gone
  // cannot be found again.
  const documentData = envelopes.flatMap((envelope) => envelope.envelopeItems.map((item) => item.documentData));

  let files = 0;

  for (const data of documentData) {
    await deleteFile({ type: data.type, data: data.data });
    files += 1;

    if (data.initialData && data.initialData !== data.data) {
      await deleteFile({ type: data.type, data: data.initialData });
      files += 1;
    }
  }

  // The envelope cascades its items, recipients, fields and audit logs. The
  // document data rows are referenced from the items, so the cascade runs the
  // other way and they must go by hand.
  await prisma.envelope.deleteMany({ where: { teamId: team.id } });
  await prisma.documentData.deleteMany({ where: { id: { in: documentData.map((data) => data.id) } } });

  // documenso's own team delete: the team, its groups, tokens and webhooks,
  // as the organisation's owner (the machine account Operify provisions with).
  await deleteTeam({ userId: organisation.ownerUserId, teamId: team.id });

  return { teamUrl: team.url, envelopes: envelopes.length, files };
};
