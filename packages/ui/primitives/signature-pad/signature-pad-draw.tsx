import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { SIGNATURE_CANVAS_DPI, SIGNATURE_MIN_COVERAGE_THRESHOLD } from '@documenso/lib/constants/signatures';

import { Trans } from '@lingui/react/macro';
import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';
import type { MouseEvent, PointerEvent, RefObject, TouchEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

const checkSignatureValidity = (element: RefObject<HTMLCanvasElement>) => {
  if (!element.current) {
    return false;
  }

  const ctx = element.current.getContext('2d');

  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, element.current.width, element.current.height);
  const data = imageData.data;
  let filledPixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      filledPixels++;
    }
  }

  const filledPercentage = filledPixels / totalPixels;
  const isValid = filledPercentage > SIGNATURE_MIN_COVERAGE_THRESHOLD;

  return isValid;
};

/**
 * The drawing as an image cropped to its ink (every stroke), with a margin, so wherever it was drawn
 * on the pad it is centred and fills its field. An empty pad gives the whole canvas back.
 */
const toInkDataUrl = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');

  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return canvas.toDataURL();
  }

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }

  if (right < 0) {
    return canvas.toDataURL();
  }

  const margin = Math.round(Math.max(right - left, bottom - top) * 0.04) + 2;
  const x = Math.max(0, left - margin);
  const y = Math.max(0, top - margin);
  const w = Math.min(width, right + margin + 1) - x;
  const h = Math.min(height, bottom + margin + 1) - y;

  const cropped = document.createElement('canvas');
  cropped.width = w;
  cropped.height = h;
  cropped.getContext('2d')?.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  return cropped.toDataURL();
};

export type SignaturePadDrawProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

export const SignaturePadDraw = ({ className, value, onChange, ...props }: SignaturePadDrawProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const $imageData = useRef<ImageData | null>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(null);

  const [selectedColor, setSelectedColor] = useState('black');

  const perfectFreehandOptions = useMemo(() => {
    const size = $el.current ? Math.min($el.current.height, $el.current.width) * 0.03 : 10;

    return {
      size,
      thinning: 0.25,
      streamline: 0.5,
      smoothing: 0.5,
      end: {
        taper: size * 2,
      },
    } satisfies StrokeOptions;
  }, []);

  const onMouseDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(true);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    setCurrentLine([point]);
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);
    const lastPoint = currentLine[currentLine.length - 1];

    if (lastPoint && point.distanceTo(lastPoint) > 5) {
      setCurrentLine([...currentLine, point]);

      // Update the canvas here to draw the lines
      if ($el.current) {
        const ctx = $el.current.getContext('2d');

        if (ctx) {
          ctx.restore();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = selectedColor;

          lines.forEach((line) => {
            const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));

            ctx.fill(pathData);
          });

          const pathData = new Path2D(getSvgPathFromStroke(getStroke([...currentLine, point], perfectFreehandOptions)));
          ctx.fill(pathData);
        }
      }
    }
  };

  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addLine = true) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(false);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    const newLines = [...lines];

    if (addLine && currentLine.length > 0) {
      newLines.push([...currentLine, point]);
      setCurrentLine([]);
    }

    setLines(newLines);

    if ($el.current && newLines.length > 0) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        ctx.restore();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = selectedColor;

        newLines.forEach((line) => {
          const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));
          ctx.fill(pathData);
        });

        const isValidSignature = checkSignatureValidity($el);

        setIsSignatureValid(isValidSignature);

        if (isValidSignature) {
          onChange?.(toInkDataUrl($el.current));
        }
        ctx.save();
      }
    }
  };

  const onMouseEnter = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if ('buttons' in event && event.buttons === 1) {
      onMouseDown(event);
    }
  };

  const onMouseLeave = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (isPressed) {
      onMouseUp(event, true);
    } else {
      onMouseUp(event, false);
    }
  };

  const onClearClick = () => {
    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
      $imageData.current = null;
    }

    if ($fileInput.current) {
      $fileInput.current.value = '';
    }

    onChange('');

    setLines([]);
    setCurrentLine([]);
    setIsPressed(false);
  };

  const onUndoClick = () => {
    if (lines.length === 0 || !$el.current) {
      return;
    }

    const newLines = lines.slice(0, -1);
    setLines(newLines);

    // Clear and redraw the canvas
    const ctx = $el.current.getContext('2d');
    const { width, height } = $el.current;
    ctx?.clearRect(0, 0, width, height);

    if ($imageData.current) {
      ctx?.putImageData($imageData.current, 0, 0);
    }

    newLines.forEach((line) => {
      const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));
      ctx?.fill(pathData);
    });

    onChange?.(toInkDataUrl($el.current));
  };

  unsafe_useEffectOnce(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if ($el.current && value) {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        // A signature made earlier is cropped to its ink: show it centred on the pad.
        const drawWidth = Math.min(width, img.width);
        const drawHeight = Math.min(height, img.height);

        ctx?.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);

        const defaultImageData = ctx?.getImageData(0, 0, width, height) || null;

        $imageData.current = defaultImageData;
      };

      img.src = value;
    }
  });

  const hasDrawing = isPressed || lines.length > 0 || currentLine.length > 0 || Boolean(value);

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {/* The drawing area spans the whole pad: no control sits over it, so no stroke is broken. */}
      <div className="relative flex aspect-signature-pad items-center justify-center rounded-md border border-muted-foreground bg-muted/25 text-center">
        {/* An empty pad shows where to sign: a light line and a muted hint, gone once drawing starts. */}
        {!hasDrawing && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-[30%]">
            <span className="mb-1 block text-muted-foreground text-sm">
              <Trans>Sign here</Trans>
            </span>
            <div className="h-px w-full bg-muted-foreground" />
          </div>
        )}

        <canvas
          data-testid="signature-pad-draw"
          ref={$el}
          className={cn('h-full w-full', {
            'dark:hue-rotate-180 dark:invert': selectedColor === 'black',
          })}
          style={{ touchAction: 'none' }}
          onPointerMove={(event) => onMouseMove(event)}
          onPointerDown={(event) => onMouseDown(event)}
          onPointerUp={(event) => onMouseUp(event)}
          onPointerLeave={(event) => onMouseLeave(event)}
          onPointerEnter={(event) => onMouseEnter(event)}
          {...props}
        />
      </div>

      {/* The pad's controls, in a row under it whose height is kept from the start, so the dialog
          never jumps when undo and Clear signature appear. */}
      <div className="mt-2 grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2">
          {/* Always in its place, off until there is a stroke to undo, so the row never changes. */}
          <button
            type="button"
            title="undo"
            disabled={lines.length === 0}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground ring-offset-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            onClick={onUndoClick}
          >
            <Undo2 className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Undo</Trans>
            </span>
          </button>

          {isSignatureValid === false && (
            <span className="text-destructive text-xs">
              <Trans>Signature is too small</Trans>
            </span>
          )}
        </div>

        {/* Centred, so it stays put when undo and Clear signature appear. */}
        <SignaturePadColorPicker
          className="static [&>button]:m-0"
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        />

        <div className="flex justify-end">
          {hasDrawing && (
            <button
              type="button"
              className="flex h-11 items-center rounded-md border border-muted-foreground bg-background px-3 text-muted-foreground text-xs ring-offset-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onClearClick()}
            >
              <Trans>Clear Signature</Trans>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
