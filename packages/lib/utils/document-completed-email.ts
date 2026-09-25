/**
 * The completion email's subject and attachment names.
 *
 * Every completion email used to share the subject "Signing Complete!", so an
 * inbox stacked every signed document into one conversation. The subject now
 * names the document the way Operify's invite does ("<team>: <title> for
 * signature (<reference>)"): "<team>: <title> signed (<reference>)". The
 * reference is the single item's file name, which Operify sets to its own
 * request reference; it is left out when it adds nothing (several items, or
 * the same text as the title).
 */

const PDF_SUFFIX = /\.pdf$/i;

export const stripPdfSuffix = (name: string): string => name.trim().replace(PDF_SUFFIX, '').trim();

export const buildDocumentCompletedSubject = ({
  teamName,
  title,
  itemTitles,
}: {
  teamName?: string | null;
  title: string;
  itemTitles: string[];
}): string => {
  const cleanTitle = title.trim();
  const reference = itemTitles.length === 1 ? stripPdfSuffix(itemTitles[0] ?? '') : '';
  const suffix = reference && reference !== stripPdfSuffix(cleanTitle) ? ` (${reference})` : '';
  const prefix = teamName?.trim() ? `${teamName.trim()}: ` : '';

  return `${prefix}${cleanTitle} signed${suffix}`;
};

/** An attachment name with exactly one ".pdf", whatever the item title carried. */
export const completedAttachmentName = (name: string): string => `${stripPdfSuffix(name) || 'document'}.pdf`;
