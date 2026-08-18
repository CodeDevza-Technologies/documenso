import { prisma } from '@documenso/prisma';
import crypto from 'crypto';
import { DateTime } from 'luxon';

import { USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER } from '../../constants/email';
import { ONE_HOUR } from '../../constants/time';
import { sendConfirmationEmail } from '../auth/send-confirmation-email';
import { getMostRecentEmailVerificationToken } from './get-most-recent-email-verification-token';

type SendConfirmationTokenOptions = { email: string; force?: boolean };

export const sendConfirmationToken = async ({ email, force = false }: SendConfirmationTokenOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email verified');
  }

  const mostRecentToken = await getMostRecentEmailVerificationToken({ userId: user.id });

  // If we've sent a token in the last 5 minutes, don't send another one
  if (
    !force &&
    mostRecentToken?.createdAt &&
    DateTime.fromJSDate(mostRecentToken.createdAt).diffNow('minutes').minutes > -5
  ) {
    // return;
  }

  // A 6-digit OTP entered by the user on the verify screen. Codes are stored
  // prefixed with the user id (`<userId>:<code>`) so the unique constraint on
  // `token` cannot collide across users and verification is scoped per user.
  const code = crypto.randomInt(100_000, 1_000_000).toString();
  const token = `${user.id}:${code}`;

  const createdToken = await prisma.verificationToken.create({
    data: {
      identifier: USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER,
      token: token,
      expires: new Date(Date.now() + ONE_HOUR / 4),
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  if (!createdToken) {
    throw new Error(`Failed to create the verification token`);
  }

  try {
    await sendConfirmationEmail({ userId: user.id });

    return { success: true };
  } catch (err) {
    console.log(err);
    throw new Error(`Failed to send the confirmation email`);
  }
};
