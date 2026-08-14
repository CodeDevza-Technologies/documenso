import { Img, Link, Section } from '../components';
import { useBranding } from '../providers/branding';
import { getSafeBrandingUrl } from '../utils/branding-url';

export type TemplateBrandingLogoProps = {
  assetBaseUrl: string;
  className?: string;
};

/**
 * Renders the email logo, centered.
 *
 * - When custom branding is enabled with a logo, the branding logo is shown.
 *   If a safe (http/https) Brand Website is configured, the logo links to it.
 * - Otherwise the Codedevza AI Sign logo is shown.
 */
export const TemplateBrandingLogo = ({ assetBaseUrl, className = 'mb-4 h-12' }: TemplateBrandingLogoProps) => {
  const branding = useBranding();

  const hasCustomBrandingLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  const logoSrc = hasCustomBrandingLogo ? branding.brandingLogo : new URL('/static/logo.png', assetBaseUrl).toString();

  const logo = <Img src={logoSrc} alt="Codedevza AI Sign" className={`mx-auto ${className}`} />;

  const safeBrandingUrl = hasCustomBrandingLogo ? getSafeBrandingUrl(branding.brandingUrl) : null;

  return (
    <Section className="text-center">
      {safeBrandingUrl ? (
        <Link href={safeBrandingUrl} target="_blank">
          {logo}
        </Link>
      ) : (
        logo
      )}
    </Section>
  );
};

export default TemplateBrandingLogo;
