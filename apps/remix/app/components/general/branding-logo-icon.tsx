import OperifyIcon from '@documenso/assets/operify-icon.png';
import { cn } from '@documenso/ui/lib/utils';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

export const BrandingLogoIcon = ({ className, ...props }: LogoProps) => {
  return <img src={OperifyIcon} alt="OperifyAI" className={cn('object-contain', className)} {...props} />;
};
