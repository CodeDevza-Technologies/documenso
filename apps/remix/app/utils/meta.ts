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
