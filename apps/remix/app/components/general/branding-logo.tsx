import CodedevzaIcon from '@documenso/assets/codedevza-icon-black.png';
import { cn } from '@documenso/ui/lib/utils';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLSpanElement>;

export const BrandingLogo = ({ className, ...props }: LogoProps) => {
  return (
    <span className={cn('inline-flex items-center gap-2 align-middle', className)} {...props}>
      <img src={CodedevzaIcon} alt="Codedevza AI" className="h-full w-auto object-contain dark:invert" />
      <span className="whitespace-nowrap font-semibold text-foreground text-lg leading-none tracking-tight">
        Codedevza AI
      </span>
    </span>
  );
};
