import OperifyIcon from '@documenso/assets/operify-icon.png';
import { cn } from '@documenso/ui/lib/utils';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLSpanElement>;

export const BrandingLogo = ({ className, ...props }: LogoProps) => {
  return (
    <span className={cn('inline-flex items-center gap-2 align-middle', className)} {...props}>
      <img src={OperifyIcon} alt="OperifyAI" className="h-full w-auto object-contain" />
      <span className="whitespace-nowrap font-semibold text-foreground text-lg leading-none tracking-tight">
        OperifyAI
      </span>
    </span>
  );
};
