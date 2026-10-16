import OperifyLockup from '@documenso/assets/operify-logo-lockup.png';
import OperifyLockupDark from '@documenso/assets/operify-logo-lockup-dark.png';
import { cn } from '@documenso/ui/lib/utils';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLSpanElement>;

/**
 * The OperifyAI lockup (mark and wordmark) at the height the caller gives, with the white
 * wordmark on dark backgrounds.
 */
export const BrandingLogo = ({ className, ...props }: LogoProps) => {
  return (
    <span className={cn('inline-flex items-center align-middle', className)} {...props}>
      <img src={OperifyLockup} alt="OperifyAI" className="block h-full w-auto object-contain dark:hidden" />
      <img src={OperifyLockupDark} alt="OperifyAI" className="hidden h-full w-auto object-contain dark:block" />
    </span>
  );
};
