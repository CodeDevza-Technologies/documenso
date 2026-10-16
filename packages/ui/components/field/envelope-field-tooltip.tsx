import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { Field } from '@prisma/client';
import { TooltipArrow } from '@radix-ui/react-tooltip';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../primitives/tooltip';

const tooltipVariants = cva('font-semibold', {
  variants: {
    color: {
      default: 'border-2 fill-white',
      warning: 'border-0 bg-orange-300 fill-orange-300 text-orange-900',
    },
  },
  defaultVariants: {
    color: 'default',
  },
});

interface EnvelopeFieldToolTipProps extends VariantProps<typeof tooltipVariants> {
  children: React.ReactNode;
  className?: string;
  field: Pick<Field, 'id' | 'inserted' | 'fieldMeta' | 'positionX' | 'positionY' | 'width' | 'height' | 'page'>;
  /**
   * `inside` draws an outline on the field with the text inside it, instead of a bubble above
   * that can cover the field above.
   */
  placement?: 'top' | 'inside';
  /** With `inside`: the outline's colour, to match the field's own. */
  outlineColor?: string;
}

/**
 * Renders a tooltip for a given field.
 */
export function EnvelopeFieldToolTip({
  children,
  color,
  className = '',
  field,
  placement = 'top',
  outlineColor,
}: EnvelopeFieldToolTipProps) {
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const { height, width } = getBoundingClientRect($page);

    const fieldX = (Number(field.positionX) / 100) * width;
    const fieldY = (Number(field.positionY) / 100) * height;

    const fieldHeight = (Number(field.height) / 100) * height;
    const fieldWidth = (Number(field.width) / 100) * width;

    setCoords({
      x: fieldX,
      y: fieldY,
      height: fieldHeight,
      width: fieldWidth,
    });
  }, [field.height, field.page, field.positionX, field.positionY, field.width]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  useEffect(() => {
    const onResize = () => {
      calculateCoords();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateCoords]);

  useEffect(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const observer = new ResizeObserver(() => {
      calculateCoords();
    });

    observer.observe($page);

    return () => {
      observer.disconnect();
    };
  }, [calculateCoords, field.page]);

  const style = {
    top: `${coords.y}px`,
    left: `${coords.x}px`,
    height: `${coords.height}px`,
    width: `${coords.width}px`,
  };

  if (placement === 'inside') {
    return (
      <div
        id="field-tooltip"
        className={cn(
          // A 2px outline 3px inside the box edge, exactly over the field's own outline, so the two
          // read as one rectangle.
          'pointer-events-none absolute z-20 flex items-center justify-center overflow-hidden rounded-sm outline outline-2 outline-orange-400 -outline-offset-4',
          children && 'bg-orange-100 text-orange-900',
          className,
        )}
        style={outlineColor ? { ...style, outlineColor } : style}
      >
        {children && <span className="truncate px-1 font-medium text-xs">{children}</span>}
      </div>
    );
  }

  return (
    <div id="field-tooltip" className={cn('pointer-events-none absolute')} style={style}>
      <TooltipProvider>
        <Tooltip delayDuration={0} open={!field.inserted || !field.fieldMeta}>
          <TooltipTrigger className="absolute inset-0 w-full"></TooltipTrigger>

          <TooltipContent className={tooltipVariants({ color, className: cn(className, 'z-40') })} sideOffset={2}>
            {children}
            <TooltipArrow />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
