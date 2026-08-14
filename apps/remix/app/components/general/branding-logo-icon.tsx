import CodedevzaIcon from '@documenso/assets/codedevza-icon-black.png';
import { cn } from '@documenso/ui/lib/utils';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

export const BrandingLogoIcon = ({ className, ...props }: LogoProps) => {
  return (
    <img src={CodedevzaIcon} alt="Codedevza AI" className={cn('object-contain dark:invert', className)} {...props} />
  );
};
