import { AppError, genericErrorCodeToTrpcErrorCodeMap } from '@documenso/lib/errors/app-error';
import { deleteOperifyTeam } from '@documenso/lib/server-only/operify/delete-operify-team';
import { ZDeleteOperifyTeamRequestSchema } from '@documenso/lib/server-only/operify/delete-operify-team.schema';
import {
  operifyProvisioningAuthorised,
  provisionOperifyTeam,
  ZProvisionOperifyTeamRequestSchema,
} from '@documenso/lib/server-only/operify/provision-operify-team';
import type { ActionFunctionArgs } from 'react-router';

/**
 * POST /api/operify/teams: Operify provisions or refreshes a tenant's team,
 * token, webhook and branding. See provision-operify-team.ts.
 * DELETE /api/operify/teams: Operify removes a tenant's team with everything
 * it holds when the tenant leaves. See delete-operify-team.ts.
 */
export function loader() {
  return Response.json({ error: 'POST or DELETE only' }, { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return Response.json({ error: 'POST or DELETE only' }, { status: 405 });
  }

  if (!operifyProvisioningAuthorised(request.headers.get('authorization'))) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed =
    request.method === 'DELETE'
      ? ZDeleteOperifyTeamRequestSchema.safeParse(body)
      : ZProvisionOperifyTeamRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: 'invalid_body',
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      },
      { status: 400 },
    );
  }

  try {
    if (request.method === 'DELETE') {
      return Response.json(await deleteOperifyTeam(ZDeleteOperifyTeamRequestSchema.parse(body)));
    }

    return Response.json(await provisionOperifyTeam(ZProvisionOperifyTeamRequestSchema.parse(body)));
  } catch (err) {
    if (err instanceof AppError) {
      const status = genericErrorCodeToTrpcErrorCodeMap[err.code]?.status ?? 400;

      return Response.json({ error: err.code, message: err.message }, { status });
    }

    console.error('[operify.teams] provisioning failed', err);

    return Response.json({ error: 'internal' }, { status: 500 });
  }
}
