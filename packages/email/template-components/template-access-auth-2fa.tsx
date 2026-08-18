import { Plural, Trans } from '@lingui/react/macro';

import { Heading, Img, Section, Text } from '../components';

export type TemplateAccessAuth2FAProps = {
  documentTitle: string;
  code: string;
  userEmail: string;
  userName: string;
  expiresInMinutes: number;
  assetBaseUrl?: string;
};

export const TemplateAccessAuth2FA = ({
  documentTitle,
  code,
  userName,
  expiresInMinutes,
  assetBaseUrl = 'http://localhost:3002',
}: TemplateAccessAuth2FAProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <div>
      <Img src={getAssetUrl('/static/mail-open.png')} alt="" className="mx-auto mt-2 h-12 w-12" />

      <Section className="mt-6">
        <Heading className="mb-0 text-center font-semibold text-foreground text-lg">
          <Trans>Your verification code</Trans>
        </Heading>

        <Text className="mx-auto mt-2 mb-0 max-w-[85%] text-center text-base text-muted-foreground">
          <Trans>
            Hi {userName}, enter this code to continue with
            <br />"{documentTitle}"
          </Trans>
        </Text>

        <Section className="mx-auto mt-6 max-w-[300px] rounded-xl border border-border border-solid bg-muted px-6 py-5 text-center">
          <Text className="my-0 font-bold text-4xl text-foreground tracking-widest">{code}</Text>
        </Section>

        <Text className="mt-5 mb-0 text-center text-muted-foreground text-sm">
          <Plural
            value={expiresInMinutes}
            one="This code expires in # minute."
            other="This code expires in # minutes."
          />
        </Text>

        <Text className="mt-2 text-center text-muted-foreground text-xs">
          <Trans>Didn't request this code? You can safely ignore this email.</Trans>
        </Text>
      </Section>
    </div>
  );
};
