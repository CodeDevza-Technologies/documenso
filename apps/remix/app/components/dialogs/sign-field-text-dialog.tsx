import type { TTextFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DateTime, Info } from 'luxon';
import { useEffect, useState } from 'react';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * A text field with this placeholder is a date question: it gets a calendar, and its answer is
 * stored as the text dd/mm/yyyy. This is a contract with Operify, which sends date questions as
 * TEXT fields with this placeholder, a character limit of 10 and the label "<question> (dd/mm/yyyy)"
 * (backend-2.0 src/lib/signify/client.ts, questionField and signifyLabel).
 */
const DATE_QUESTION_PLACEHOLDER = 'dd/mm/yyyy';
const DATE_QUESTION_FORMAT = 'dd/MM/yyyy';
/**
 * The answer box: a placeholder dark enough to read (4.7:1) and one focus line, not a ring with a gap.
 */
const ANSWER_INPUT_CLASS_NAME =
  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-offset-0';

/** The characters-left count shows once this many or fewer remain. */
const CHARACTER_COUNT_SHOWN_FROM = 20;
const DATE_QUESTION_LABEL_SUFFIX = /\s*\(dd\/mm\/yyyy\)\s*$/i;

/** Takes 1/2/2026 as well as 01/02/2026. */
const parseDateAnswer = (text: string) => DateTime.fromFormat(text.trim(), 'd/M/yyyy');

const isDateAnswerOrEmpty = (text: string) => text.trim() === '' || parseDateAnswer(text).isValid;

const normaliseDateAnswer = (text: string) =>
  text.trim() === '' ? '' : parseDateAnswer(text).toFormat(DATE_QUESTION_FORMAT);

const ZDateAnswerSchema = z
  .string()
  .refine(isDateAnswerOrEmpty, { message: msg`Pick a date, or type one as dd/mm/yyyy`.id })
  .transform(normaliseDateAnswer);

const getFormSchema = ({ isDateQuestion, isRequired }: { isDateQuestion: boolean; isRequired: boolean }) => {
  const answer = isDateQuestion ? ZDateAnswerSchema : z.string();

  return z.object({
    text: isRequired ? answer.refine((text) => text.trim() !== '', { message: msg`Text is required`.id }) : answer,
  });
};

type TSignFieldTextFormSchema = { text: string };

export type SignFieldTextDialogProps = {
  fieldMeta?: TTextFieldMeta;
  /**
   * The answer already given, when the signer comes back to change it.
   */
  initialText?: string;
};

/**
 * `save` with an empty text clears an optional answer. `skip` leaves an optional question for now.
 */
export type SignFieldTextDialogResult = { action: 'save'; text: string } | { action: 'skip' } | null;

type DateQuestionCalendarProps = {
  month: DateTime;
  selected: DateTime | null;
  onMonthChange: (month: DateTime) => void;
  onSelect: (date: DateTime) => void;
};

/**
 * A month of days to pick from, Monday first, built from the house buttons. The shared Calendar
 * primitive is not used: its date library is not in the production image.
 */
const DateQuestionCalendar = ({ month, selected, onMonthChange, onSelect }: DateQuestionCalendarProps) => {
  const { t } = useLingui();

  const leadingBlanks = month.weekday - 1;
  const days = Array.from({ length: month.daysInMonth ?? 0 }, (_, index) => month.plus({ days: index }));
  const today = DateTime.now();

  // The day keyboard focus lands on when the dialog opens: the chosen day, else today, else the 1st.
  const focusDay = days.find((day) => (selected ? day.hasSame(selected, 'day') : day.hasSame(today, 'day'))) ?? days[0];

  return (
    <div className="mx-auto w-fit">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 p-0"
          aria-label={t`Previous month`}
          onClick={() => onMonthChange(month.minus({ months: 1 }))}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        <p className="font-medium text-sm" aria-live="polite">
          {month.toFormat('LLLL yyyy')}
        </p>

        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 p-0"
          aria-label={t`Next month`}
          onClick={() => onMonthChange(month.plus({ months: 1 }))}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-7">
        {Info.weekdays('short').map((weekday) => (
          <span key={weekday} className="flex h-8 w-11 items-center justify-center text-muted-foreground text-xs">
            {weekday.slice(0, 2)}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {days.map((day) => {
          const isSelected = selected !== null && day.hasSame(selected, 'day');
          const isToday = day.hasSame(today, 'day');

          return (
            <Button
              key={day.day}
              type="button"
              variant={isSelected ? 'default' : 'none'}
              // Only the chosen day is filled and only today is marked. Hover fills only where there is
              // a pointer that hovers (a tap leaves no grey day behind), and focus is the button's ring.
              className={cn(
                'h-11 w-11 p-0 font-normal',
                !isSelected && '[@media(hover:hover)]:hover:bg-accent',
                // Darker than the brand green so today reads at 5:1, still underlined.
                isToday && !isSelected && 'font-medium text-emerald-700 underline underline-offset-4',
              )}
              aria-label={day.toFormat('cccc d LLLL yyyy')}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              data-calendar-focus={day === focusDay ? '' : undefined}
              onClick={() => onSelect(day)}
            >
              {day.day}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export const SignFieldTextDialog = createCallable<SignFieldTextDialogProps, SignFieldTextDialogResult>(
  ({ call, fieldMeta, initialText = '' }) => {
    const { t } = useLingui();

    const isDateQuestion = fieldMeta?.placeholder?.trim().toLowerCase() === DATE_QUESTION_PLACEHOLDER;
    const isRequired = fieldMeta?.required === true;
    const isEditing = initialText !== '';
    const characterLimit =
      fieldMeta?.characterLimit && fieldMeta.characterLimit > 0 ? fieldMeta.characterLimit : undefined;

    // The calendar makes the format plain, so the date question's title drops it.
    const title = isDateQuestion ? fieldMeta?.label?.replace(DATE_QUESTION_LABEL_SUFFIX, '') : fieldMeta?.label;

    const form = useForm<TSignFieldTextFormSchema>({
      resolver: zodResolver(getFormSchema({ isDateQuestion, isRequired })),
      defaultValues: {
        text: initialText,
      },
    });

    const typedDate = parseDateAnswer(form.watch('text'));

    const [calendarMonth, setCalendarMonth] = useState(() =>
      (typedDate.isValid ? typedDate : DateTime.now()).startOf('month'),
    );

    // The tap that opened this dialog ends with a mousedown on its overlay, which would take focus
    // out of the dialog to the page. Keep it inside; outside taps still close it (pointerdown).
    useEffect(() => {
      const keepFocusInDialog = (event: MouseEvent) => {
        if (event.target instanceof Element && !event.target.closest('[role="dialog"]')) {
          event.preventDefault();
        }
      };

      document.addEventListener('mousedown', keepFocusInDialog, true);

      return () => document.removeEventListener('mousedown', keepFocusInDialog, true);
    }, []);

    const onSubmit = ({ text }: TSignFieldTextFormSchema) => {
      // Saving an optional question left empty is a skip, unless it clears an earlier answer.
      if (text.trim() === '' && !isEditing) {
        call.end({ action: 'skip' });
        return;
      }

      call.end({ action: 'save', text });
    };

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent
          position="center"
          // Only the date question has a description; saying so stops Radix warning about it.
          {...(!isDateQuestion && { 'aria-describedby': undefined })}
          // A date question opens on the calendar, not the phone keyboard: focus goes to a day. A
          // changed answer opens with its text selected, ready to retype.
          onOpenAutoFocus={(event) => {
            const container = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;

            if (isDateQuestion) {
              event.preventDefault();
              (container?.querySelector<HTMLElement>('[data-calendar-focus]') ?? container)?.focus();
            } else if (isEditing) {
              event.preventDefault();

              const input = container?.querySelector<HTMLInputElement>('#custom-text');

              input?.focus();
              input?.select();
            }
          }}
          // The field that opened this lives on a canvas and cannot take focus back, so focus goes to
          // the next step: the Next or Finish button.
          onCloseAutoFocus={(event) => {
            const nextStep = Array.from(document.querySelectorAll<HTMLElement>('[data-signing-next-step]')).find(
              (element) => element.offsetParent !== null,
            );

            if (nextStep) {
              event.preventDefault();
              nextStep.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="whitespace-normal font-medium">{title || <Trans>Enter Text</Trans>}</DialogTitle>

            {isDateQuestion && (
              <DialogDescription>
                <Trans>Pick a date, or type it in.</Trans>
              </DialogDescription>
            )}
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        {isDateQuestion ? (
                          <Input
                            id="custom-text"
                            inputMode="numeric"
                            autoComplete="off"
                            enterKeyHint="done"
                            placeholder={DATE_QUESTION_PLACEHOLDER}
                            maxLength={characterLimit ?? DATE_QUESTION_PLACEHOLDER.length}
                            className={ANSWER_INPUT_CLASS_NAME}
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);

                              const date = parseDateAnswer(event.target.value);

                              if (date.isValid) {
                                setCalendarMonth(date.startOf('month'));
                              }
                            }}
                          />
                        ) : (
                          // One line: answers are short (a PO number, a name), and Enter saves.
                          <Input
                            id="custom-text"
                            autoComplete="off"
                            enterKeyHint="done"
                            maxLength={characterLimit}
                            placeholder={fieldMeta?.placeholder || t`Enter your text here`}
                            className={cn(ANSWER_INPUT_CLASS_NAME, {
                              'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                                fieldState.error,
                            })}
                            {...field}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                      {/* Only near the limit, so a short answer box carries no counter. */}
                      {!isDateQuestion &&
                        characterLimit !== undefined &&
                        characterLimit - (field.value?.length ?? 0) <= CHARACTER_COUNT_SHOWN_FROM &&
                        !fieldState.error && (
                          <div className="text-muted-foreground text-sm">
                            <Plural
                              value={characterLimit - (field.value?.length ?? 0)}
                              one="# character remaining"
                              other="# characters remaining"
                            />
                          </div>
                        )}
                    </FormItem>
                  )}
                />

                {isDateQuestion && (
                  <DateQuestionCalendar
                    month={calendarMonth}
                    selected={typedDate.isValid ? typedDate : null}
                    onMonthChange={setCalendarMonth}
                    onSelect={(date) =>
                      form.setValue('text', date.toFormat(DATE_QUESTION_FORMAT), { shouldValidate: true })
                    }
                  />
                )}

                <DialogFooter>
                  {isRequired || isEditing ? (
                    <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                      <Trans>Cancel</Trans>
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={() => call.end({ action: 'skip' })}>
                      <Trans>Skip</Trans>
                    </Button>
                  )}

                  {/* An empty date is a Skip (optional) or not yet an answer (required). */}
                  <Button type="submit" disabled={isDateQuestion && !isEditing && form.watch('text').trim() === ''}>
                    <Trans>Enter</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
