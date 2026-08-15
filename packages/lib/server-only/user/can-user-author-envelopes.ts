import { prisma } from '@documenso/prisma';
import { OrganisationMemberRole, OrganisationType, Role } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Whether the user may author envelopes (documents/templates) and create
 * organisations.
 *
 * Self-signup accounts only ever hold a personal organisation, so authoring is
 * reserved for instance admins and users holding an admin or manager role in a
 * real (non-personal) organisation. Everyone else is a sign-only account: they
 * can receive, view and sign documents sent to them but cannot create or send
 * anything themselves.
 */
export const canUserAuthorEnvelopes = async (userId: number): Promise<boolean> => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { roles: true },
  });

  if (user?.roles.includes(Role.ADMIN)) {
    return true;
  }

  const privilegedMembership = await prisma.organisationMember.findFirst({
    where: {
      userId,
      organisation: {
        type: OrganisationType.ORGANISATION,
      },
      organisationGroupMembers: {
        some: {
          group: {
            organisationRole: {
              in: [OrganisationMemberRole.ADMIN, OrganisationMemberRole.MANAGER],
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return privilegedMembership !== null;
};

/**
 * Throws if the user is a sign-only account.
 *
 * Guard this in front of any action that authors content on the instance:
 * creating envelopes (documents/templates) and creating organisations.
 */
export const assertUserCanAuthorEnvelopes = async (userId: number): Promise<void> => {
  if (!(await canUserAuthorEnvelopes(userId))) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'This account is limited to signing documents sent to it',
      statusCode: 403,
    });
  }
};
