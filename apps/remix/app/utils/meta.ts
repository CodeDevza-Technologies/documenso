import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { i18n, type MessageDescriptor } from '@lingui/core';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'OperifyAI — secure, effortless document signing. Send, sign, and manage documents with a fast, modern signing experience.';

  return [
    {
      title: title ? `${i18n._(title)} - OperifyAI` : 'OperifyAI',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'OperifyAI, document signing, e-signatures, sign documents online, fast signing, smart templates, secure signing',
    },
    {
      name: 'author',
      content: 'OperifyAI',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'OperifyAI - Secure, Effortless Document Signing',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};

/**
 * A recipient page's tab: the title, and the same no-indexing rule as the recipient layout, which a
 * route's own meta replaces.
 */
export const recipientMetaTags = (title: string) => [
  { title },
  { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
];

/**
 * The provider a recipient sees named: the team that sent the document when its pages carry its
 * branding (the caller passes no name otherwise), or Operify AI.
 */
export const recipientProviderName = (teamName?: string | null) => teamName?.trim() || 'Operify AI';
