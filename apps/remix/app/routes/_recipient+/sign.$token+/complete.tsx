import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { downloadFile } from '@documenso/lib/client-only/download-file';
import { fetchPDF } from '@documenso/lib/client-only/download-pdf';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { isSignupEnabledForProvider } from '@documenso/lib/constants/auth';
import { loadRecipientBrandingByTeamId } from '@documenso/lib/server-only/branding/load-recipient-branding';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { extractDerivedDocumentEmailSettings } from '@documenso/lib/types/document-email';
import { darkenForContrast } from '@documenso/lib/utils/brand-button-contrast';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { trpc } from '@documenso/trpc/react';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, FieldType, RecipientRole } from '@prisma/client';
import { CheckCircle2, Clock8, DownloadIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { ClaimAccount } from '~/components/general/claim-account';
import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { RecipientBranding } from '~/components/general/recipient-branding';
import { recipientMetaTags, recipientProviderName } from '~/utils/meta';
import { useCspNonce } from '~/utils/nonce';

import type { Route } from './+types/complete';

export function meta({ data }: Route.MetaArgs) {
  const provider = recipientProviderName(data?.teamName);

  if (!data?.isDocumentAccessValid) {
    return recipientMetaTags(provider);
  }

  const { title } = data.document;

  return recipientMetaTags(i18n._(msg`${title} signed · ${provider}`));
}

/**
 * The signed copy's file name: the document's title, safe on any filesystem, or the uploaded file's
 * name when the title is empty.
 */
const toSignedCopyFileName = (title: string, uploadedName: string) => {
  const safe = (name: string) =>
    name
      .replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
      // Windows cannot save a file whose name ends with a dot or a space.
      .replace(/[.\s]+$/, '');

  const name = safe(title) || safe(uploadedName.replace(/\.pdf$/i, '')) || 'document';

  return `${name} (signed).pdf`;
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document || !document.documentData) {
    throw new Response('Not Found', { status: 404 });
  }

  const branding = await loadRecipientBrandingByTeamId({ teamId: document.teamId });

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: document.authOptions,
    recipient,
    userId: user?.id,
  });

  if (!isDocumentAccessValid) {
    return {
      isDocumentAccessValid: false,
      teamName: branding.allowCustomBranding ? (document.team?.name ?? null) : null,
      recipientEmail: recipient.email,
      branding,
    } as const;
  }

  const signatures = await getRecipientSignatures({ recipientId: recipient.id });
  const isExistingUser = await getUserByEmail({ email: recipient.email })
    .then((u) => !!u)
    .catch(() => false);

  const recipientName =
    recipient.name || fields.find((field) => field.type === FieldType.NAME)?.customText || recipient.email;

  const canSignUp = !isExistingUser && isSignupEnabledForProvider('email');

  const canRedirectToFolder = user && document.userId === user.id && document.folderId && document.team?.url;

  const returnToHomePath = canRedirectToFolder ? `/t/${document.team.url}/documents/f/${document.folderId}` : '/';

  // Whether the signed copy is emailed to each recipient once everyone has signed: the page only
  // promises an email when the document will send one.
  const emailsSignedCopy = extractDerivedDocumentEmailSettings(document.documentMeta).documentCompleted;

  // The status line is text on white in the team's colour: at least 4.5:1, even for a pale brand.
  const statusColor = darkenForContrast(branding.colors?.primary ?? '#1fb97f', 4.5);

  return {
    isDocumentAccessValid: true,
    teamName: branding.allowCustomBranding ? (document.team?.name ?? null) : null,
    emailsSignedCopy,
    statusColor,
    canSignUp,
    recipientName,
    recipientEmail: recipient.email,
    signatures,
    document,
    recipient,
    returnToHomePath,
    branding,
  };
}

export default function CompletedSigningPage({ loaderData }: Route.ComponentProps) {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isDownloadingSignedCopy, setIsDownloadingSignedCopy] = useState(false);

  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;
  const cspNonce = useCspNonce();

  const {
    isDocumentAccessValid,
    emailsSignedCopy,
    statusColor,
    canSignUp,
    recipientName,
    signatures,
    document,
    recipient,
    recipientEmail,
    returnToHomePath,
    branding,
  } = loaderData;

  // Poll signing status every few seconds
  const { data: signingStatusData } = trpc.envelope.signingStatus.useQuery(
    {
      token: recipient?.token || '',
    },
    {
      refetchInterval: 3000,
      initialData: match(document?.status)
        .with(DocumentStatus.COMPLETED, () => ({ status: 'COMPLETED' }) as const)
        .with(DocumentStatus.REJECTED, () => ({ status: 'REJECTED' }) as const)
        .with(DocumentStatus.PENDING, () => ({ status: 'PENDING' }) as const)
        .otherwise(() => ({ status: 'PENDING' }) as const),
    },
  );

  // Use signing status from query if available, otherwise fall back to document status
  const signingStatus = signingStatusData?.status ?? 'PENDING';

  const singleEnvelopeItem =
    isDocumentAccessValid && document.envelopeItems.length === 1 ? document.envelopeItems[0] : null;

  const onDownloadSignedCopy = async () => {
    if (!singleEnvelopeItem || isDownloadingSignedCopy) {
      return;
    }

    setIsDownloadingSignedCopy(true);

    try {
      const { blob } = await fetchPDF({
        envelopeItem: singleEnvelopeItem,
        token: recipient?.token,
        version: 'signed',
      });

      downloadFile({
        filename: toSignedCopyFileName(document?.title ?? '', singleEnvelopeItem.title),
        data: blob,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`We couldn’t download the signed copy. Try again.`),
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingSignedCopy(false);
    }
  };

  if (!isDocumentAccessValid) {
    return (
      <>
        <RecipientBranding branding={branding} cspNonce={cspNonce} />
        <DocumentSigningAuthPageView email={recipientEmail} />
      </>
    );
  }

  return (
    <>
      <RecipientBranding branding={branding} cspNonce={cspNonce} />
      <div
        className={cn(
          '-mx-4 flex flex-col items-center overflow-hidden px-4 pt-16 md:-mx-8 md:px-8 lg:pt-20 xl:pt-28',
          { 'pt-0 lg:pt-0 xl:pt-0': canSignUp },
        )}
      >
        <div
          className={cn('relative mt-6 flex w-full flex-col items-center justify-center', {
            'mt-0 flex-col divide-y overflow-hidden pt-6 md:pt-16 lg:flex-row lg:divide-x lg:divide-y-0 lg:pt-20 xl:pt-24':
              canSignUp,
          })}
        >
          <div
            className={cn('flex flex-col items-center', {
              'mb-8 p-4 md:mb-0 md:p-12': canSignUp,
            })}
          >
            <Badge
              variant="neutral"
              size="default"
              className="mb-6 rounded-xl border border-border bg-transparent ring-0"
            >
              <span className="block max-w-[calc(100vw-4rem)] truncate font-medium md:max-w-[28rem]">
                {document.title}
              </span>
            </Badge>

            {/* The signature on a plain, still card: a 1px border, without the vendor's glowing border, ring,
                sheen or tilt after the pointer. Nothing on it is clickable, so a typed signature is weight 500
                in full ink (the theme foreground, #0f172a in light) and keeps its colour on hover. It is as wide
                as a drawn signature's card, so a typed one, which has no width of its own, never shrinks it. */}
            <SigningCard3D
              name={recipientName}
              signature={signatures.at(0)}
              className="[&>div]:!bg-none [&>div]:![transform:none] [&_.gradient-border-mask_span]:!font-medium [&_.gradient-border-mask_span]:!text-foreground min-w-[min(24rem,calc(100vw-2rem))] md:min-w-[28rem] [&_.gradient-border-mask]:border [&_.gradient-border-mask]:border-border [&_.gradient-border-mask]:shadow-none [&_.gradient-border-mask]:before:hidden"
            />

            <h2 className="mt-6 max-w-[35ch] text-center font-medium text-2xl leading-normal md:text-3xl lg:text-4xl">
              {recipient.role === RecipientRole.SIGNER && <Trans>Document Signed</Trans>}
              {recipient.role === RecipientRole.VIEWER && <Trans>Document Viewed</Trans>}
              {recipient.role === RecipientRole.APPROVER && <Trans>Document Approved</Trans>}
            </h2>

            {match({ status: signingStatus, deletedAt: document.deletedAt })
              .with({ status: 'COMPLETED' }, () => (
                <div className="mt-4 flex items-center text-center" style={{ color: statusColor }}>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>Everyone has signed</Trans>
                  </span>
                </div>
              ))
              .with({ status: 'PROCESSING' }, () => (
                <div className="mt-4 flex items-center text-center" style={{ color: statusColor }}>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    <Trans>Processing document</Trans>
                  </span>
                </div>
              ))
              .with({ deletedAt: null }, () => (
                <div className="mt-4 flex items-center text-center" style={{ color: statusColor }}>
                  <Clock8 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>Waiting for others to sign</Trans>
                  </span>
                </div>
              ))
              .otherwise(() => (
                <div className="flex items-center text-center text-red-600">
                  <Clock8 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>Document no longer available to sign</Trans>
                  </span>
                </div>
              ))}

            {/* What happens next, said only as far as it is true: an email only when the document sends one. */}
            {match({ status: signingStatus, deletedAt: document.deletedAt })
              .with({ status: 'COMPLETED' }, () => (
                <p className="mt-2.5 max-w-[60ch] text-center text-muted-foreground text-sm">
                  {emailsSignedCopy ? (
                    <Trans>Everyone has signed! You will receive an email copy of the signed document.</Trans>
                  ) : (
                    <Trans>Download the signed copy below.</Trans>
                  )}
                </p>
              ))
              .with({ status: 'PROCESSING' }, () => (
                <p className="mt-2.5 max-w-[60ch] text-center text-muted-foreground text-sm">
                  {emailsSignedCopy ? (
                    <Trans>
                      All recipients have signed. The document is being processed and you will receive an email copy
                      shortly.
                    </Trans>
                  ) : (
                    <Trans>Everyone has signed. You can download the signed copy here when it’s ready.</Trans>
                  )}
                </p>
              ))
              .with({ deletedAt: null }, () => (
                <p className="mt-2.5 max-w-[60ch] text-center text-muted-foreground text-sm">
                  {emailsSignedCopy ? (
                    <Trans>You will receive an email copy of the signed document once everyone has signed.</Trans>
                  ) : (
                    <Trans>Once everyone has signed, you can download the signed copy from this page.</Trans>
                  )}
                </p>
              ))
              .otherwise(() => (
                <p className="mt-2.5 max-w-[60ch] text-center text-muted-foreground text-sm">
                  <Trans>
                    This document has been cancelled by the owner and is no longer available for others to sign.
                  </Trans>
                </p>
              ))}

            <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-4 md:w-auto md:max-w-none md:flex-row md:items-center">
              {/* Offered as soon as the page learns the signed copy is ready, not only on a reload. */}
              {(isDocumentCompleted(document) || signingStatus === 'COMPLETED') &&
                // One document: one tap downloads its signed copy. Several: the picker lists them.
                (singleEnvelopeItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 md:h-10"
                    loading={isDownloadingSignedCopy}
                    onClick={onDownloadSignedCopy}
                  >
                    {!isDownloadingSignedCopy && <DownloadIcon className="mr-2 h-5 w-5" />}
                    {/* Its own context, so the en catalogue can say "Download the signed copy" here only. */}
                    <Trans context="Recipient completion download button">Download</Trans>
                  </Button>
                ) : (
                  <EnvelopeDownloadDialog
                    largeButtons
                    envelopeId={document.envelopeId}
                    envelopeStatus={signingStatus === 'COMPLETED' ? DocumentStatus.COMPLETED : document.status}
                    envelopeItems={document.envelopeItems}
                    token={recipient?.token}
                    trigger={
                      <Button type="button" variant="outline" className="h-12 md:h-10">
                        <DownloadIcon className="mr-2 h-5 w-5" />
                        <Trans context="Recipient completion download button">Download</Trans>
                      </Button>
                    }
                  />
                ))}

              {user && (
                <Button asChild className="h-12 md:h-10">
                  <Link to={returnToHomePath}>
                    <Trans>Go Back Home</Trans>
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center">
            {canSignUp && (
              <div className="flex max-w-xl flex-col items-center justify-center p-4 md:p-12">
                <h2 className="mt-8 text-center font-medium text-xl md:mt-0">
                  <Trans>Need to sign documents?</Trans>
                </h2>

                <p className="mt-4 max-w-[55ch] text-center text-muted-foreground/60 leading-normal">
                  <Trans>Create your account and start using state-of-the-art document signing.</Trans>
                </p>

                <ClaimAccount defaultName={recipientName} defaultEmail={recipient.email} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
