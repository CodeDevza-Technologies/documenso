export interface TemplateDocumentImageProps {
  assetBaseUrl: string;
  className?: string;
}

/**
 * The generic document preview graphic was removed from all emails in favour of
 * a cleaner, more professional layout (logo → message → CTA). Kept as a no-op so
 * existing callers don't need to change.
 */
export const TemplateDocumentImage = (_props: TemplateDocumentImageProps) => {
  return null;
};

export default TemplateDocumentImage;
