import { Trans } from '@lingui/react/macro';

import { Button, Heading, Img, Section, Text } from '../components';

export type TemplateConfirmationEmailProps = {
  confirmationLink: string;
  assetBaseUrl: string;
  confirmationCode?: string;
};

export const TemplateConfirmationEmail = ({
  confirmationLink,
  assetBaseUrl,
  confirmationCode,
}: TemplateConfirmationEmailProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  if (confirmationCode) {
    return (
      <>
        <Img src={getAssetUrl('/static/mail-open.png')} alt="" className="mx-auto mt-2 h-12 w-12" />

        <Section className="mt-6">
          <Heading className="mb-0 text-center font-semibold text-foreground text-lg">
            <Trans>Confirm your email</Trans>
          </Heading>

          <Text className="mx-auto mt-2 mb-0 max-w-[85%] text-center text-base text-muted-foreground">
            <Trans>Enter this code on the verification screen to activate your account.</Trans>
          </Text>

          <Section className="mx-auto mt-6 max-w-[300px] rounded-xl border border-border border-solid bg-muted px-6 py-5 text-center">
            <Text className="my-0 font-bold text-4xl text-foreground tracking-widest">{confirmationCode}</Text>
          </Section>

          <Text className="mt-5 mb-0 text-center text-muted-foreground text-sm">
            <Trans>This code expires in 15 minutes.</Trans>
          </Text>

          <Text className="mt-2 text-center text-muted-foreground text-xs">
            <Trans>Didn't create an account? You can safely ignore this email.</Trans>
          </Text>
        </Section>
      </>
    );
  }

  return (
    <Section className="flex-row items-center justify-center">
      <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-foreground text-lg">
        <Trans>Welcome to Codedevza AI!</Trans>
      </Text>

      <Text className="my-1 text-center text-base text-muted-foreground">
        <Trans>Before you get started, please confirm your email address by clicking the button below:</Trans>
      </Text>

      <Section className="mt-8 mb-6 text-center">
        <Button
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground text-sm no-underline"
          href={confirmationLink}
        >
          <Trans>Confirm email</Trans>
        </Button>
        <Text className="mt-8 text-center text-muted-foreground text-sm italic">
          <Trans>
            You can also copy and paste this link into your browser: {confirmationLink} (link expires in 1 hour)
          </Trans>
        </Text>
      </Section>
    </Section>
  );
};
