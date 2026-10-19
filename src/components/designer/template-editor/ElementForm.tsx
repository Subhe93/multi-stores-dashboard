'use client';

import { useTranslations } from 'next-intl';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DesignElement } from '@multi-stores/core/designer';
import type { FontFaceOption } from '@/lib/designer/templateSpec';
import { TemplateElementForm, elementFieldId } from '@/components/designer/TemplateElementForm';
import { FieldError } from '@/components/designer/DesignerBits';

interface ElementFormProps {
  element: DesignElement;
  index: number;
  name: string;
  /** field → message for this element. */
  errors: Record<string, string>;
  fontOptions: FontFaceOption[];
  locales: string[];
  imageUrl: string | null;
  onChange: (next: DesignElement) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPickImage: () => void;
}

/** Card of the selected element: title, id, duplicate / remove and the field form. */
export function ElementForm({
  element, index, name, errors, fontOptions, locales, imageUrl, onChange, onDuplicate, onRemove, onPickImage,
}: ElementFormProps) {
  const t = useTranslations('creator.designer.editor');
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-semibold">{name}</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {t(`types.${element.type}`)} ·{' '}
            <span className="font-mono" dir="ltr" id={elementFieldId(index, 'id')}>
              {element.id}
            </span>
          </p>
          <FieldError text={errors.id || errors.type} />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t('duplicate')} onClick={onDuplicate}>
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7 text-red-600" aria-label={t('removeElement')} onClick={onRemove}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <TemplateElementForm
          key={`${index}-${element.id}`}
          element={element}
          index={index}
          onChange={onChange}
          errors={errors}
          fontOptions={fontOptions}
          locales={locales}
          imageUrl={imageUrl}
          onPickImage={onPickImage}
        />
      </CardContent>
    </Card>
  );
}
