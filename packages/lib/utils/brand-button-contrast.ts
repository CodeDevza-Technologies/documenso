import { colord, extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';

extend([a11yPlugin]);

/** WCAG AA for normal text: what a button's label needs against its fill. */
const MIN_CONTRAST = 4.5;

const WHITE = '#ffffff';

/** The dark ink a label switches to when the brand colour is too light to carry white. */
export const BRAND_BUTTON_DARK_INK = '#0f172a';

/**
 * How far the fill may be darkened (HSL lightness points) and still read as the same brand. Past
 * this the colour itself changes, so dark ink on the tenant's own colour is the closer choice.
 */
const MAX_DARKEN_POINTS = 20;

/**
 * Keeps a brand-coloured button's label readable (4.5:1). The tenant's colour stays as it is when its
 * label already reads. Otherwise the fill is darkened in 1-point HSL lightness steps until white
 * reads on it; if that would take more than {@link MAX_DARKEN_POINTS} and dark ink reads on the
 * original colour, the fill stays and the label turns dark instead.
 */
export const ensureReadableBrandButton = ({
  fill,
  foreground = WHITE,
}: {
  fill: string;
  foreground?: string;
}): { fill: string; foreground: string } => {
  const base = colord(fill);

  if (!base.isValid() || colord(foreground).contrast(base) >= MIN_CONTRAST) {
    return { fill, foreground };
  }

  const { h, s, l, a } = base.toHsl();

  let points = 0;
  let darker = base;

  while (colord(WHITE).contrast(darker) < MIN_CONTRAST && l - points > 0) {
    points += 1;
    darker = colord({ h, s, l: Math.max(0, l - points), a });
  }

  if (points > MAX_DARKEN_POINTS && colord(BRAND_BUTTON_DARK_INK).contrast(base) >= MIN_CONTRAST) {
    return { fill, foreground: BRAND_BUTTON_DARK_INK };
  }

  return { fill: darker.toHex(), foreground: WHITE };
};
