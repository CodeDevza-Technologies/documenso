import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '@documenso/lib/constants/direct-templates';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { ZFullFieldSchema } from '@documenso/lib/types/field';
import {
  createFieldCanvasStyleCache,
  type FieldCanvasStyleCache,
} from '@documenso/lib/universal/field-renderer/field-canvas-style';
import { createSpinner } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { EnvelopeRecipientFieldTooltip } from '@documenso/ui/components/document/envelope-recipient-field-tooltip';
import { EnvelopeFieldToolTip } from '@documenso/ui/components/field/envelope-field-tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Field, FieldType, type Recipient, RecipientRole, type Signature, SigningStatus } from '@prisma/client';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo, useRef } from 'react';
import { match } from 'ts-pattern';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { handleCheckboxFieldClick } from '~/utils/field-signing/checkbox-field';
import { handleDropdownFieldClick } from '~/utils/field-signing/dropdown-field';
import { handleEmailFieldClick } from '~/utils/field-signing/email-field';
import { handleInitialsFieldClick } from '~/utils/field-signing/initial-field';
import { handleNameFieldClick } from '~/utils/field-signing/name-field';
import { handleNumberFieldClick } from '~/utils/field-signing/number-field';
import { handleSignatureFieldClick } from '~/utils/field-signing/signature-field';
import { handleTextFieldClick } from '~/utils/field-signing/text-field';

import { useRequiredDocumentSigningAuthContext } from '../document-signing/document-signing-auth-provider';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

/**
 * The smallest tap target, in CSS pixels, every field gets whatever its drawn size.
 */
const MIN_FIELD_HIT_SIZE_PX = 44;

/**
 * How far inside the field's box its outline is drawn, in CSS pixels, so the outline keeps clear
 * of the caption printed just above the box. The box itself, its fill and the sealed PDF keep the
 * field's own geometry.
 */
const FIELD_OUTLINE_INSET_PX = 3;

/**
 * Draws a field's box on the signing page: the fill over the whole box, reaching 1 px past its edge
 * so the PDF's own thin box line never shows, and the outline drawn inside the box. Left-aligned
 * content (answers, hints, tick boxes) moves in by the same amount so it keeps its gap from the
 * outline. Only the screen changes: the sealed PDF draws the field from its own geometry.
 */
const drawFieldFrame = (fieldGroup: Konva.Group, scale: number, fieldType: FieldType) => {
  const fieldRect = fieldGroup.findOne<Konva.Rect>('.field-rect');

  if (fieldType !== FieldType.SIGNATURE) {
    for (const child of fieldGroup.getChildren()) {
      if (child !== fieldRect && !child.hasName('loading-spinner-group')) {
        child.x(child.x() + FIELD_OUTLINE_INSET_PX / scale);
      }
    }
  }

  fieldRect?.sceneFunc((context, shape) => {
    const cover = 1 / scale;
    const inset = FIELD_OUTLINE_INSET_PX / scale;

    context.beginPath();
    context.rect(-cover, -cover, shape.width() + cover * 2, shape.height() + cover * 2);
    context.closePath();
    context.fillShape(shape);

    context.beginPath();
    context.rect(inset, inset, shape.width() - inset * 2, shape.height() - inset * 2);
    context.closePath();
    context.strokeShape(shape);
  });
};

type FieldBox = { x: number; y: number; width: number; height: number };

const toFieldBox = (
  field: Pick<Field, 'positionX' | 'positionY' | 'width' | 'height'>,
  pageWidth: number,
  pageHeight: number,
): FieldBox => ({
  x: (Number(field.positionX) / 100) * pageWidth,
  y: (Number(field.positionY) / 100) * pageHeight,
  width: (Number(field.width) / 100) * pageWidth,
  height: (Number(field.height) / 100) * pageHeight,
});

/**
 * How far a field's tap area reaches past each edge of its drawn box, in page units: enough for
 * a 44 px target, centred on the box, and never more than half the gap to a neighbouring field,
 * so two grown areas split the space between them instead of overlapping.
 */
const getFieldHitMargins = (box: FieldBox, neighbours: FieldBox[], scale: number) => {
  const minSize = MIN_FIELD_HIT_SIZE_PX / scale;
  const growX = Math.max(0, (minSize - box.width) / 2);
  const growY = Math.max(0, (minSize - box.height) / 2);

  const margins = { top: growY, bottom: growY, left: growX, right: growX };

  for (const other of neighbours) {
    const overlapsColumn = other.x < box.x + box.width && other.x + other.width > box.x;
    const overlapsRow = other.y < box.y + box.height && other.y + other.height > box.y;

    if (overlapsColumn && other.y >= box.y + box.height) {
      margins.bottom = Math.min(margins.bottom, (other.y - (box.y + box.height)) / 2);
    }

    if (overlapsColumn && other.y + other.height <= box.y) {
      margins.top = Math.min(margins.top, (box.y - (other.y + other.height)) / 2);
    }

    if (overlapsRow && other.x >= box.x + box.width) {
      margins.right = Math.min(margins.right, (other.x - (box.x + box.width)) / 2);
    }

    if (overlapsRow && other.x + other.width <= box.x) {
      margins.left = Math.min(margins.left, (box.x - (other.x + other.width)) / 2);
    }
  }

  return margins;
};

type GenericLocalField = TEnvelope['fields'][number] & {
  recipient: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>;
};

export const EnvelopeSignerPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { t, i18n } = useLingui();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();
  const { sessionData } = useOptionalSession();

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();
  const { toast } = useToast();

  const {
    envelopeData,
    recipient,
    recipientFields,
    recipientFieldsRemaining,
    showPendingFieldTooltip,
    focusedField,
    setFocusedField,
    skipField,
    signField: signFieldInternal,
    email: emailState,
    setEmail,
    fullName: fullNameState,
    setFullName,
    signature: signatureState,
    setSignature,
    selectedAssistantRecipientFields,
    selectedAssistantRecipient,
    isDirectTemplate,
  } = useRequiredEnvelopeSigningContext();

  // Note: We're using refs here due to the closure within the signField function.
  const fullName = useRef(fullNameState);
  const email = useRef(emailState);
  const signature = useRef(signatureState);

  useEffect(() => {
    fullName.current = fullNameState;
    email.current = emailState;
    signature.current = signatureState;
  }, [fullNameState, emailState, signatureState]);

  // The field the flow is opening, so its handler can tell that from the signer's own tap.
  const openingFieldId = useRef<number | null>(null);

  const cachedRenderFields = useRef<Map<number, Field & { signature?: Signature | null }>>(new Map());
  const prevShowPendingFieldTooltip = useRef(showPendingFieldTooltip);

  const { onFieldSigned, onFieldUnsigned } = useEmbedSigningContext() || {};

  const { stage, pageLayer, konvaContainer, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => createPageCanvas(stage, pageLayer),
    pageData,
  );

  const { scale, pageNumber } = pageData;

  const { envelope } = envelopeData;

  const localPageFields = useMemo(() => {
    let fieldsToRender = recipientFields;

    if (recipient.role === RecipientRole.ASSISTANT) {
      fieldsToRender = selectedAssistantRecipientFields;
    }

    return fieldsToRender.filter(
      (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
    );
  }, [recipientFields, selectedAssistantRecipientFields, pageNumber, currentEnvelopeItem?.id]);

  /**
   * Returns fields that have been fully signed by other recipients for this specific
   * page.
   */
  const localPageOtherRecipientFields = useMemo((): GenericLocalField[] => {
    const signedRecipients = envelope.recipients.filter(
      (recipient) => recipient.signingStatus === SigningStatus.SIGNED,
    );

    return signedRecipients.flatMap((recipient) => {
      return recipient.fields
        .filter(
          (field) =>
            field.page === pageNumber &&
            field.envelopeItemId === currentEnvelopeItem?.id &&
            (field.inserted || field.fieldMeta?.readOnly),
        )
        .map((field) => ({
          ...field,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            signingStatus: recipient.signingStatus,
            role: recipient.role,
          },
        }));
    });
  }, [envelope.recipients, pageNumber, currentEnvelopeItem?.id]);

  const unsafeRenderFieldOnLayer = (
    unparsedField: Field & { signature?: Signature | null },
    fieldCanvasStyleCache: FieldCanvasStyleCache,
  ) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldToRender = ZFullFieldSchema.parse(unparsedField);

    const isValidating = showPendingFieldTooltip && isFieldUnsignedAndRequired(fieldToRender);

    const color = fieldToRender.fieldMeta?.readOnly ? 'readOnly' : isValidating ? 'orange' : 'green';

    const { fieldGroup } = renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: fieldToRender.id.toString(),
        ...fieldToRender,
        width: Number(fieldToRender.width),
        height: Number(fieldToRender.height),
        positionX: Number(fieldToRender.positionX),
        positionY: Number(fieldToRender.positionY),
        isValidating,
        signature: unparsedField.signature,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color,
      mode: 'sign',
      fieldCanvasStyleCache,
    });

    // A tap target of at least 44 px around the drawn box. Only the hit region grows: the box as
    // drawn, and the field's geometry in the sealed PDF, stay as they are.
    drawFieldFrame(fieldGroup, scale, fieldToRender.type);

    const fieldRectForHit = fieldGroup.findOne<Konva.Rect>('.field-rect');

    if (fieldRectForHit) {
      const box = toFieldBox(fieldToRender, unscaledViewport.width, unscaledViewport.height);
      const neighbours = localPageFields
        .filter((f) => f.id !== fieldToRender.id)
        .map((f) => toFieldBox(f, unscaledViewport.width, unscaledViewport.height));
      const { top, bottom, left, right } = getFieldHitMargins(box, neighbours, scale);

      fieldRectForHit.hitFunc((context, shape) => {
        context.beginPath();
        context.rect(-left, -top, shape.width() + left + right, shape.height() + top + bottom);
        context.closePath();
        context.fillStrokeShape(shape);
      });
    }

    const handleFieldGroupClick = (e: KonvaEventObject<Event>) => {
      const currentTarget = e.currentTarget as Konva.Group;
      const target = e.target as Konva.Shape;

      const fieldRect = fieldGroup.findOne('.field-rect');
      const fieldWidth = fieldRect ? fieldRect.width() : fieldGroup.width();
      const fieldHeight = fieldRect ? fieldRect.height() : fieldGroup.height();

      const foundField = localPageFields.find((f) => f.id === unparsedField.id);
      const foundLoadingGroup = currentTarget.findOne('.loading-spinner-group');

      if (!foundField || foundLoadingGroup || foundField.fieldMeta?.readOnly) {
        return;
      }

      let localEmail: string | null = email.current;
      let localFullName: string | null = fullName.current;
      let placeholderEmail: string | null = null;

      if (recipient.role === RecipientRole.ASSISTANT) {
        localEmail = selectedAssistantRecipient?.email || null;
        localFullName = selectedAssistantRecipient?.name || null;
      }

      // Allows us let the user set a different email than their current logged in email.
      if (isDirectTemplate) {
        placeholderEmail = sessionData?.user?.email || email.current || recipient.email;

        if (!placeholderEmail || placeholderEmail === DIRECT_TEMPLATE_RECIPIENT_EMAIL) {
          placeholderEmail = null;
        }
      }

      const loadingSpinnerGroup = createSpinner({
        fieldWidth,
        fieldHeight,
      });

      const parsedFoundField = ZFullFieldSchema.parse(foundField);

      match(parsedFoundField)
        /**
         * CHECKBOX FIELD.
         */
        .with({ type: FieldType.CHECKBOX }, (field) => {
          // A tap in the grown area around a single tick box ticks it.
          const clickedCheckboxIndex =
            target.getAttr('internalCheckboxIndex') === undefined && field.fieldMeta.values?.length === 1
              ? 0
              : Number(target.getAttr('internalCheckboxIndex'));

          if (Number.isNaN(clickedCheckboxIndex)) {
            return;
          }

          void handleCheckboxFieldClick({ field, clickedCheckboxIndex })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * RADIO FIELD.
         */
        .with({ type: FieldType.RADIO }, (field) => {
          const selectedRadioIndex = Number(target.getAttr('internalRadioIndex'));
          const fieldCustomText = Number(field.customText);

          if (Number.isNaN(selectedRadioIndex)) {
            return;
          }

          fieldGroup.add(loadingSpinnerGroup);

          // Uncheck the value if it's already pressed.
          const value = field.inserted && selectedRadioIndex === fieldCustomText ? null : selectedRadioIndex;

          void signField(field.id, {
            type: FieldType.RADIO,
            value,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * NUMBER FIELD.
         */
        .with({ type: FieldType.NUMBER }, (field) => {
          void handleNumberFieldClick({ field, number: null })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * TEXT FIELD.
         */
        .with({ type: FieldType.TEXT }, (field) => {
          void handleTextFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload === 'skip') {
                skipField(field.id);
                return;
              }

              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * EMAIL FIELD.
         */
        .with({ type: FieldType.EMAIL }, (field) => {
          void handleEmailFieldClick({ field, email: localEmail, placeholderEmail })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setEmail(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * INITIALS FIELD.
         */
        .with({ type: FieldType.INITIALS }, (field) => {
          const initials = localFullName ? extractInitials(localFullName) : null;

          void handleInitialsFieldClick({ field, initials })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * NAME FIELD.
         */
        .with({ type: FieldType.NAME }, (field) => {
          void handleNameFieldClick({ field, name: localFullName })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setFullName(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DROPDOWN FIELD.
         */
        .with({ type: FieldType.DROPDOWN }, (field) => {
          void handleDropdownFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DATE FIELD.
         */
        .with({ type: FieldType.DATE }, (field) => {
          fieldGroup.add(loadingSpinnerGroup);

          void signField(field.id, {
            type: FieldType.DATE,
            value: !field.inserted,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * SIGNATURE FIELD.
         */
        .with({ type: FieldType.SIGNATURE }, (field) => {
          // Opened by Next: always show the pad, with any signature already made, so Next never
          // signs on the signer's behalf.
          const isOpenedByNext = openingFieldId.current === field.id;
          openingFieldId.current = null;

          void handleSignatureFieldClick({
            field,
            fullName: fullName.current,
            signature: signature.current,
            alwaysAsk: isOpenedByNext,
            typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
            uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
            drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
          })
            .then(async (payload) => {
              if (!payload) {
                return;
              }

              fieldGroup.add(loadingSpinnerGroup);

              if (payload.value) {
                await executeActionAuthProcedure({
                  onReauthFormSubmit: async (authOptions) => {
                    await signField(field.id, payload, authOptions);

                    loadingSpinnerGroup.destroy();
                  },
                  actionTarget: field.type,
                });

                setSignature(payload.value);
              } else {
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        .exhaustive();
    };

    fieldGroup.off('pointerdown');
    fieldGroup.on('pointerdown', handleFieldGroupClick);
  };

  const renderFieldOnLayer = (
    unparsedField: Field & { signature?: Signature | null },
    fieldCanvasStyleCache: FieldCanvasStyleCache,
  ) => {
    try {
      unsafeRenderFieldOnLayer(unparsedField, fieldCanvasStyleCache);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  const renderFields = () => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldCanvasStyleCache = createFieldCanvasStyleCache();

    // Render current recipient fields which have changed or are not currently rendered.
    for (const field of localPageFields) {
      const existingCachedField = cachedRenderFields.current.get(field.id);
      const isFieldCurrentlyRendered = pageLayer.current.findOne(`#${field.id}`);

      if (
        !isFieldCurrentlyRendered ||
        !existingCachedField ||
        existingCachedField.inserted !== field.inserted ||
        existingCachedField.customText !== field.customText
      ) {
        renderFieldOnLayer(field, fieldCanvasStyleCache);
        cachedRenderFields.current.set(field.id, field);
      }
    }

    // Render other recipient signed and inserted fields.
    for (const field of localPageOtherRecipientFields) {
      try {
        const { fieldGroup } = renderField({
          scale,
          pageLayer: pageLayer.current,
          field: {
            renderId: field.id.toString(),
            ...field,
            width: Number(field.width),
            height: Number(field.height),
            positionX: Number(field.positionX),
            positionY: Number(field.positionY),
            fieldMeta: field.fieldMeta,
          },
          translations: getClientSideFieldTranslations(i18n),
          pageWidth: unscaledViewport.width,
          pageHeight: unscaledViewport.height,
          color: 'readOnly',
          editable: false,
          mode: 'sign',
          fieldCanvasStyleCache,
        });

        // Other-recipient fields are display-only — they have no click handlers
        // and shouldn't intercept events meant for the current recipient's
        // fields. Disable hit detection on the entire group.
        fieldGroup.listening(false);
        drawFieldFrame(fieldGroup, scale, field.type);
      } catch (err) {
        console.error('Unable to render one or more fields belonging to other recipients.');
        console.error(err);
      }
    }
  };

  const signField = async (fieldId: number, payload: TSignEnvelopeFieldValue, authOptions?: TRecipientActionAuth) => {
    try {
      const { inserted } = await signFieldInternal(fieldId, payload, authOptions);

      // ?: The two callbacks below are used within the embedding context
      if (inserted && onFieldSigned) {
        const value = payload.value ? JSON.stringify(payload.value) : undefined;
        const isBase64 = value ? isBase64Image(value) : undefined;

        onFieldSigned({ fieldId, value, isBase64 });
      }

      if (!inserted && onFieldUnsigned) {
        onFieldUnsigned({ fieldId });
      }
    } catch (err) {
      console.error(err);

      toast({
        title: t`Error`,
        description: t`An error occurred while signing the field.`,
        variant: 'destructive',
      });

      throw err;
    }
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    renderFields();
    currentPageLayer.batchDraw();
  };

  /**
   * Render fields when they are changed or inserted.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // When the pending-field tooltip toggles, all unsigned required fields need to
    // be re-rendered so their stroke color updates (green <-> orange). Field-level
    // properties like `inserted` and `customText` haven't changed, so the cache
    // would otherwise skip them — clear it to force a fresh render.
    if (prevShowPendingFieldTooltip.current !== showPendingFieldTooltip) {
      cachedRenderFields.current.clear();
      prevShowPendingFieldTooltip.current = showPendingFieldTooltip;
    }

    renderFields();

    pageLayer.current.batchDraw();
  }, [localPageFields, showPendingFieldTooltip]);

  /**
   * Open the dialog of the field the signer is being taken to, once its page has rendered.
   */
  useEffect(() => {
    if (!focusedField?.open || !pageLayer.current) {
      return;
    }

    const field = localPageFields.find((f) => f.id === focusedField.id);
    const fieldGroup = pageLayer.current.findOne(`#${focusedField.id}`);

    if (!field || field.inserted || !fieldGroup) {
      return;
    }

    setFocusedField({ ...focusedField, open: false });
    openingFieldId.current = field.id;
    fieldGroup.fire('pointerdown', { target: fieldGroup, currentTarget: fieldGroup });
  }, [focusedField, localPageFields, pageData.imageLoadingState]);

  /**
   * Rerender the whole page if the selected assistant recipient changes.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // Rerender the whole page.
    pageLayer.current.destroyChildren();
    cachedRenderFields.current.clear();

    renderFields();

    pageLayer.current.batchDraw();
  }, [selectedAssistantRecipient]);

  if (!currentEnvelopeItem) {
    return null;
  }

  // The field the signer is being taken to, else the first required field still empty.
  const highlightedField =
    recipientFields.find((field) => field.id === focusedField?.id && !field.inserted) ?? recipientFieldsRemaining[0];

  return (
    <>
      {showPendingFieldTooltip &&
        highlightedField?.envelopeItemId === currentEnvelopeItem.id &&
        highlightedField.page === pageNumber && (
          // Drawn inside the field so it never covers the question above it. Text and tick-box
          // fields only get the outline, so their own label stays readable.
          <EnvelopeFieldToolTip key={highlightedField.id} field={highlightedField} color="warning" placement="inside">
            {match(highlightedField.type)
              .with(FieldType.TEXT, FieldType.CHECKBOX, () => null)
              .with(FieldType.SIGNATURE, () => <Trans>Tap to sign</Trans>)
              .otherwise(() => (
                <Trans>Click to insert field</Trans>
              ))}
          </EnvelopeFieldToolTip>
        )}

      {localPageOtherRecipientFields.map((field) => (
        <EnvelopeRecipientFieldTooltip
          key={field.id}
          field={field}
          showFieldStatus={true}
          showRecipientTooltip={true}
        />
      ))}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};
