import { IS_BILLING_ENABLED } from '../../constants/app';
import type { TCssVarsSchema } from '../../types/css-vars';
import { ZCssVarsSchema } from '../../types/css-vars';
import { ensureReadableBrandButton } from '../../utils/brand-button-contrast';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { getTeamSettings } from '../team/get-team-settings';

/** The theme's own primary (theme.css `--primary`), which a team without a brand colour gets. */
const DEFAULT_PRIMARY = '#1fb97f';

/**
 * The primary button colours a recipient sees: the team's brand colour, or the theme's default when
 * it sets none, either way with a label that reads at 4.5:1.
 */
const readablePrimary = (colors: TCssVarsSchema | null) =>
  ensureReadableBrandButton({
    fill: colors?.primary ?? DEFAULT_PRIMARY,
    foreground: colors?.primary ? colors.primaryForeground : undefined,
  });

export type RecipientBrandingPayload = {
  allowCustomBranding: boolean;
  hidePoweredBy: boolean;
  colors: TCssVarsSchema | null;
  css: string | null;
};

/**
 * Resolve the branding payload for a recipient-facing route, given the team
 * the envelope/document belongs to. Reads inherited team-or-org branding settings,
 * checks the org's claim flags, and returns a payload safe to send to the client.
 *
 * Returns a minimal disabled payload if the team is not on a plan that allows
 * custom branding.
 */
export const loadRecipientBrandingByTeamId = async ({
  teamId,
}: {
  teamId: number;
}): Promise<RecipientBrandingPayload> => {
  const billingEnabled = IS_BILLING_ENABLED();

  const [settings, claim] = await Promise.all([
    getTeamSettings({ teamId }),
    billingEnabled ? getOrganisationClaimByTeamId({ teamId }).catch(() => null) : Promise.resolve(null),
  ]);

  let allowCustomBranding = !billingEnabled || claim?.flags?.embedSigningWhiteLabel === true;
  const hidePoweredBy = !billingEnabled || claim?.flags?.hidePoweredBy === true;

  if (!settings.brandingEnabled) {
    allowCustomBranding = false;
  }

  if (!allowCustomBranding) {
    const { fill, foreground } = readablePrimary(null);

    return {
      allowCustomBranding: false,
      hidePoweredBy,
      // Only the readable default primary: an unbranded team gets no other custom colour or CSS.
      colors: { primary: fill, primaryForeground: foreground },
      css: null,
    };
  }

  // brandingColors is stored as JSON; parse defensively. Drop unknown keys via Zod.
  const parsedColors = settings.brandingColors ? ZCssVarsSchema.safeParse(settings.brandingColors) : null;
  const parsed = parsedColors?.success ? parsedColors.data : null;

  // The tenant's colour, or the default, fills the primary buttons: keep their labels readable.
  const { fill, foreground } = readablePrimary(parsed);
  const colors = { ...parsed, primary: fill, primaryForeground: foreground };

  return {
    allowCustomBranding: true,
    hidePoweredBy,
    colors,
    css: settings.brandingCss && settings.brandingCss.length > 0 ? settings.brandingCss : null,
  };
};
