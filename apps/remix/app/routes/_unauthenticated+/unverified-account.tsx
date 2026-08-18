import { authClient } from '@documenso/auth/client';
import { EMAIL_VERIFICATION_STATE } from '@documenso/lib/constants/email';
import { zEmail } from '@documenso/lib/utils/zod';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

export const ZVerifyEmailCodeFormSchema = z.object({
  email: zEmail().min(1),
  code: z.string().regex(/^\d{6}$/, { message: msg`Enter the 6-digit code from your email`.id }),
});

export type TVerifyEmailCodeFormSchema = z.infer<typeof ZVerifyEmailCodeFormSchema>;

export default function UnverifiedAccount() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const [isResending, setIsResending] = useState(false);

  const form = useForm<TVerifyEmailCodeFormSchema>({
    values: {
      email: searchParams.get('email') ?? '',
      code: '',
    },
    resolver: zodResolver(ZVerifyEmailCodeFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ email, code }: TVerifyEmailCodeFormSchema) => {
    try {
      const { state } = await authClient.emailPassword.verifyEmail({ email, code });

      if (state === EMAIL_VERIFICATION_STATE.VERIFIED) {
        toast({
          title: _(msg`Email verified`),
          description: _(msg`Welcome! Taking you to your account.`),
          duration: 3000,
        });

        // Full reload so the freshly issued session cookie is picked up.
        window.location.href = '/';
        return;
      }

      if (state === EMAIL_VERIFICATION_STATE.ALREADY_VERIFIED) {
        toast({
          title: _(msg`Email already verified`),
          description: _(msg`Your email is already verified. Please sign in.`),
        });

        await navigate('/signin');
        return;
      }

      if (state === EMAIL_VERIFICATION_STATE.EXPIRED) {
        toast({
          variant: 'destructive',
          title: _(msg`Code expired`),
          description: _(msg`That code has expired. We've sent a new one to your inbox.`),
        });

        return;
      }

      toast({
        variant: 'destructive',
        title: _(msg`Invalid code`),
        description: _(msg`That code isn't right. Check your email and try again.`),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: _(msg`Unable to verify`),
        description: _(msg`Something went wrong, or you've made too many attempts. Please try again shortly.`),
      });
    }
  };

  const onResendClick = async () => {
    const email = form.getValues('email');

    const parsed = zEmail().safeParse(email);

    if (!parsed.success) {
      form.setError('email', { message: _(msg`Enter your email address to resend the code`) });
      return;
    }

    try {
      setIsResending(true);

      await authClient.emailPassword.resendVerifyEmail({ email });

      toast({
        title: _(msg`Code sent`),
        description: _(msg`A new verification code is on its way to your inbox.`),
        duration: 5000,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: _(msg`Unable to send code`),
        description: _(msg`Please try again and make sure you enter the correct email address.`),
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="font-semibold text-2xl tracking-tight">
        <Trans>Check your email</Trans>
      </h1>

      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>
          We've sent a 6-digit verification code to your email address. Enter it below to activate your account.
        </Trans>
      </p>

      <div className="mt-8">
        <Form {...form}>
          <form className="flex w-full flex-col gap-y-4" onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Email Address</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Verification code</Trans>
                    </FormLabel>
                    <FormControl>
                      <PinInput {...field} value={field.value ?? ''} maxLength={6}>
                        {Array(6)
                          .fill(null)
                          .map((_i, i) => (
                            <PinInputGroup key={i}>
                              <PinInputSlot index={i} />
                            </PinInputGroup>
                          ))}
                      </PinInput>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <Button loading={isSubmitting} type="submit" size="lg" className="mt-2 w-full">
              <Trans>Verify email</Trans>
            </Button>
          </form>
        </Form>

        <p className="mt-8 text-center text-muted-foreground text-sm">
          <Trans>
            Didn't receive a code?{' '}
            <button
              type="button"
              onClick={onResendClick}
              disabled={isResending}
              className="font-medium text-primary duration-200 hover:opacity-70 disabled:opacity-50"
            >
              Resend code
            </button>
          </Trans>
        </p>
      </div>
    </div>
  );
}
