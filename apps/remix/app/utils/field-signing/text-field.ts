import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';

type HandleTextFieldClickOptions = {
  field: TFieldText;
  text: string | null;
};

/**
 * The value to sign the text field with, `skip` when the signer leaves an optional question for
 * now, or null when they cancel. An answered field opens with its answer so it can be changed.
 */
export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> | 'skip' | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.TEXT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (text) {
    return {
      type: FieldType.TEXT,
      value: text,
    };
  }

  const result = await SignFieldTextDialog.call({
    fieldMeta: field.fieldMeta,
    initialText: field.inserted ? field.customText : '',
  });

  if (!result) {
    return null;
  }

  if (result.action === 'skip') {
    return 'skip';
  }

  // Unchanged: nothing to save.
  if (field.inserted && result.text === field.customText) {
    return null;
  }

  return {
    type: FieldType.TEXT,
    value: result.text === '' ? null : result.text,
  };
};
