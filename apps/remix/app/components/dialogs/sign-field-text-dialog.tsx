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
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DateTime, Info } from 'luxon';
import { useState } from 'react';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

/**
 * A text field with this placeholder is a date question: it gets a calendar, and its answer is
 * stored as the text dd/mm/yyyy.
 */
const DATE_QUESTION_PLACEHOLDER = 'dd/mm/yyyy';
const DATE_QUESTION_FORMAT = 'dd/MM/yyyy';

const parseDateAnswer = (text: string) => DateTime.fromFormat(text.trim(), DATE_QUESTION_FORMAT);

const ZSignFieldTextFormSchema = z.object({
  text: z.string().min(1, { message: msg`Type an answer first`.id }),
});

const ZSignFieldDateFormSchema = z.object({
  text: z
    .string()
    .trim()
    .refine((text) => parseDateAnswer(text).isValid, { message: msg`Pick a date, or type one as dd/mm/yyyy`.id }),
});

type TSignFieldTextFormSchema = z.infer<typeof ZSignFieldTextFormSchema>;

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

          return (
            <Button
              key={day.day}
              type="button"
              variant={isSelected ? 'default' : 'ghost'}
              className={cn('h-11 w-11 p-0 font-normal', day.hasSame(today, 'day') && !isSelected && 'bg-muted')}
              aria-label={day.toFormat('cccc d LLLL yyyy')}
              aria-pressed={isSelected}
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

export type SignFieldTextDialogProps = {
  fieldMeta?: TTextFieldMeta;
};

export const SignFieldTextDialog = createCallable<SignFieldTextDialogProps, string | null>(({ call, fieldMeta }) => {
  const { t } = useLingui();

  const isDateQuestion = fieldMeta?.placeholder?.trim().toLowerCase() === DATE_QUESTION_PLACEHOLDER;

  const form = useForm<TSignFieldTextFormSchema>({
    resolver: zodResolver(isDateQuestion ? ZSignFieldDateFormSchema : ZSignFieldTextFormSchema),
    defaultValues: {
      text: '',
    },
  });

  const [calendarMonth, setCalendarMonth] = useState(() => DateTime.now().startOf('month'));

  const typedDate = parseDateAnswer(form.watch('text'));

  return (
    <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
      <DialogContent
        position="center"
        // A date question opens on the calendar, not the phone keyboard.
        onOpenAutoFocus={isDateQuestion ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="whitespace-normal">{fieldMeta?.label || <Trans>Your answer</Trans>}</DialogTitle>

          {isDateQuestion && (
            <DialogDescription>
              <Trans>Pick a date, or type it in.</Trans>
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => call.end(data.text))}>
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
                          placeholder={DATE_QUESTION_PLACEHOLDER}
                          maxLength={10}
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
                        <Textarea
                          id="custom-text"
                          placeholder={fieldMeta?.placeholder || t`Type your answer`}
                          className={cn('w-full rounded-md', {
                            'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                              fieldState.error,
                          })}
                          {...field}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                    {!isDateQuestion &&
                      fieldMeta?.characterLimit !== undefined &&
                      fieldMeta?.characterLimit > 0 &&
                      !fieldState.error && (
                        <div className="text-muted-foreground text-sm">
                          <Plural
                            value={fieldMeta?.characterLimit - (field.value?.length ?? 0)}
                            one="# character left"
                            other="# characters left"
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
                <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit">
                  <Trans>Save</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
