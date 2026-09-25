import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@documenso/prisma';
import { OrganisationType, Prisma, WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { ZCssVarsSchema } from '../../types/css-vars';
import { normalizeBrandingColors } from '../../utils/normalize-branding-colors';
import { buildBrandingLogoData } from '../branding/store-branding-logo';
import { createApiToken } from '../public-api/create-api-token';
import { createTeam } from '../team/create-team';
import { createWebhook } from '../webhooks/create-webhook';

/**
 * Operify provisions one team per tenant here, so a tenant's signing page and
 * signer emails carry that tenant's name, logo and colours. The endpoint is
 * idempotent: it creates what is missing (team, API token, webhook) and
 * rewrites what is given (name, branding, webhook secret). The API token is
 * returned only when minted, so Operify stores it once; `rotateToken` mints a
 * fresh one and drops the old.
 *
 * Authorised by the shared secret NEXT_PRIVATE_OPERIFY_PROVISIONING_SECRET.
 * The teams live in the organisation NEXT_PRIVATE_OPERIFY_ORGANISATION_URL
 * (default `operify`) and are owned by that organisation's owner, the
 * machine account Operify's provisioning script created.
 */

export const OPERIFY_TOKEN_NAME = 'operify';

export const OPERIFY_WEBHOOK_EVENTS: WebhookTriggerEvents[] = [
  WebhookTriggerEvents.DOCUMENT_SENT,
  WebhookTriggerEvents.DOCUMENT_OPENED,
  WebhookTriggerEvents.DOCUMENT_SIGNED,
  WebhookTriggerEvents.DOCUMENT_COMPLETED,
  WebhookTriggerEvents.DOCUMENT_REJECTED,
  WebhookTriggerEvents.DOCUMENT_CANCELLED,
  WebhookTriggerEvents.RECIPIENT_EXPIRED,
];

const MAX_LOGO_BYTES = 1_500_000;

export const ZProvisionOperifyTeamRequestSchema = z.object({
  // The same rule the team settings form applies (ZTeamUrlSchema): 3 to 30
  // characters, lower case, no leading or trailing dash.
  teamUrl: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'teamUrl: lower case letters, digits and dashes, not at the ends'),
  name: z.string().trim().min(1).max(100),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().min(16).max(256),
  includeSenderDetails: z.boolean().default(false),
  rotateToken: z.boolean().default(false),
  branding: z.object({
    enabled: z.boolean().default(true),
    url: z.union([z.string().url(), z.literal('')]).default(''),
    companyDetails: z.string().max(1000).default(''),
    colors: ZCssVarsSchema.nullable().default(null),
    /** A base64 image data URL replaces the logo, null removes it, absent leaves it. */
    logo: z.string().max(2_100_000).nullable().optional(),
  }),
});

export type TProvisionOperifyTeamRequest = z.infer<typeof ZProvisionOperifyTeamRequestSchema>;

export type ProvisionOperifyTeamResult = {
  teamId: number;
  teamUrl: string;
  created: boolean;
  /** Present only when a token was minted on this call. */
  apiToken?: string;
};

export const operifyProvisioningAuthorised = (
  authorization: string | null | undefined,
  secret = process.env.NEXT_PRIVATE_OPERIFY_PROVISIONING_SECRET,
): boolean => {
  if (!secret || secret.length < 16 || !authorization) {
    return false;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());

  if (!match) {
    return false;
  }

  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);

  return given.length === expected.length && timingSafeEqual(given, expected);
};

export const parseLogoDataUrl = (dataUrl: string): { bytes: Buffer; type: string } => {
  // sharp rasterises all of these to a 512px PNG in buildBrandingLogoData,
  // an SVG included, so what is stored is never the bytes that arrived.
  const match = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);

  if (!match) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'branding.logo must be a base64 data URL of a png, jpeg, webp, gif or svg image',
    });
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');

  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `branding.logo must be between 1 byte and ${MAX_LOGO_BYTES} bytes`,
    });
  }

  return { bytes, type: match[1] };
};

const sameEvents = (a: WebhookTriggerEvents[], b: WebhookTriggerEvents[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

export const provisionOperifyTeam = async (
  input: TProvisionOperifyTeamRequest,
): Promise<ProvisionOperifyTeamResult> => {
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

  const userId = organisation.ownerUserId;

  let team = await prisma.team.findFirst({
    where: { url: input.teamUrl },
    select: { id: true, name: true, organisationId: true },
  });

  let created = false;

  if (!team) {
    await createTeam({
      userId,
      teamName: input.name,
      teamUrl: input.teamUrl,
      organisationId: organisation.id,
      inheritMembers: true,
    });

    team = await prisma.team.findFirstOrThrow({
      where: { url: input.teamUrl },
      select: { id: true, name: true, organisationId: true },
    });

    created = true;
  } else if (team.organisationId !== organisation.id) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: `Team ${input.teamUrl} belongs to another organisation`,
    });
  }

  if (team.name !== input.name) {
    await prisma.team.update({ where: { id: team.id }, data: { name: input.name } });
  }

  let apiToken: string | undefined;

  const existingToken = await prisma.apiToken.findFirst({
    where: { teamId: team.id, name: OPERIFY_TOKEN_NAME },
    select: { id: true },
  });

  if (!existingToken || input.rotateToken) {
    await prisma.apiToken.deleteMany({ where: { teamId: team.id, name: OPERIFY_TOKEN_NAME } });

    const minted = await createApiToken({
      userId,
      teamId: team.id,
      tokenName: OPERIFY_TOKEN_NAME,
      expiresIn: null,
    });

    apiToken = minted.token;
  }

  const webhook = await prisma.webhook.findFirst({
    where: { teamId: team.id, webhookUrl: input.webhookUrl },
    select: { id: true, secret: true, enabled: true, eventTriggers: true },
  });

  if (!webhook) {
    await createWebhook({
      webhookUrl: input.webhookUrl,
      eventTriggers: OPERIFY_WEBHOOK_EVENTS,
      secret: input.webhookSecret,
      enabled: true,
      userId,
      teamId: team.id,
    });
  } else if (
    webhook.secret !== input.webhookSecret ||
    !webhook.enabled ||
    !sameEvents(webhook.eventTriggers, OPERIFY_WEBHOOK_EVENTS)
  ) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { secret: input.webhookSecret, enabled: true, eventTriggers: OPERIFY_WEBHOOK_EVENTS },
    });
  }

  const colors = normalizeBrandingColors(input.branding.colors);

  const settings: Prisma.TeamGlobalSettingsUpdateInput = {
    includeSenderDetails: input.includeSenderDetails,
    brandingEnabled: input.branding.enabled,
    brandingUrl: input.branding.url,
    brandingCompanyDetails: input.branding.companyDetails,
    brandingColors: colors === null || colors === undefined ? Prisma.DbNull : colors,
  };

  if (input.branding.logo === null) {
    settings.brandingLogo = null;
  } else if (typeof input.branding.logo === 'string') {
    const { bytes, type } = parseLogoDataUrl(input.branding.logo);

    settings.brandingLogo = await buildBrandingLogoData(new File([new Uint8Array(bytes)], 'branding-logo', { type }));
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { teamGlobalSettings: { update: settings } },
  });

  return { teamId: team.id, teamUrl: input.teamUrl, created, apiToken };
};
