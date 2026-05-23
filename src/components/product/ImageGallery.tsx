'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Loader2, ImageIcon, Star } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UploadedImage } from '@/lib/useImageUpload';

type Translator = ReturnType<typeof useTranslations>;

interface ProductImage {
  id: string;
  url: string;
  alt_text?: string;
  is_featured?: boolean;
}

interface ImageGalleryProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  onPickAndUpload: (multiple?: boolean) => Promise<UploadedImage[]>;
  uploading?: boolean;
}

function SortableImage({ img, onSetFeatured, onDelete, t }: {
  img: ProductImage;
  onSetFeatured: () => void;
  onDelete: () => void;
  t: Translator;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}
      className="relative aspect-square bg-zinc-100 rounded-lg overflow-hidden group border cursor-grab active:cursor-grabbing"
      {...attributes} {...listeners}>
      <img src={img.url} alt={img.alt_text || ''} className="w-full h-full object-cover pointer-events-none" />

      {img.is_featured && (
        <div className="absolute top-1 left-1">
          <Badge className="text-[8px] bg-amber-500 hover:bg-amber-500 gap-0.5 px-1 py-0">
            <Star className="w-2.5 h-2.5 fill-current" /> {t('image.featured')}
          </Badge>
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
        {!img.is_featured && (
          <button onPointerDown={e => e.stopPropagation()} onClick={onSetFeatured}
            className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-amber-50" title={t('image.setAsFeatured')}>
            <Star className="w-3.5 h-3.5 text-amber-500" />
          </button>
        )}
        <button onPointerDown={e => e.stopPropagation()} onClick={onDelete}
          className="h-7 w-7 bg-white rounded-md flex items-center justify-center hover:bg-red-50" title={t('common.delete')}>
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  );
}

export function ImageGallery({ images, onChange, onPickAndUpload, uploading = false }: ImageGalleryProps) {
  const t = useTranslations();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleUpload = async (multiple = true) => {
    const uploaded = await onPickAndUpload(multiple);
    const hasFeatured = images.some(img => img.is_featured);
    const newImages = uploaded.map((img, i) => ({
      id: img.id,
      url: img.url,
      is_featured: !hasFeatured && i === 0, // only first uploaded image becomes featured if none exists
    }));
    onChange([...images, ...newImages]);
  };

  const handleDelete = (id: string) => {
    const updated = images.filter(img => img.id !== id);
    if (updated.length > 0 && !updated.some(img => img.is_featured)) {
      updated[0] = { ...updated[0]!, is_featured: true };
    }
    onChange(updated);
  };

  const handleSetFeatured = (id: string) => {
    onChange(images.map(img => ({ ...img, is_featured: img.id === id })));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = images.findIndex(img => img.id === active.id);
    const newIdx = images.findIndex(img => img.id === over.id);
    onChange(arrayMove(images, oldIdx, newIdx));
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{t('image.media')}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t('image.mediaHint', { count: images.length })}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUpload(true)} disabled={uploading}>
            {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            {t('image.uploadImages')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {images.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-5 gap-2">
                {images.map(img => (
                  <SortableImage
                    key={img.id}
                    img={img}
                    onSetFeatured={() => handleSetFeatured(img.id)}
                    onDelete={() => handleDelete(img.id)}
                    t={t}
                  />
                ))}

                <button onClick={() => handleUpload(true)} disabled={uploading}
                  className="aspect-square border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center hover:border-zinc-300 transition disabled:opacity-50">
                  {uploading ? <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" /> : (
                    <>
                      <Upload className="w-5 h-5 text-zinc-300 mb-1" />
                      <span className="text-[9px] text-muted-foreground">{t('common.add')}</span>
                    </>
                  )}
                </button>
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <button onClick={() => handleUpload(true)} disabled={uploading}
            className="w-full border-2 border-dashed border-zinc-200 rounded-lg p-10 text-center hover:border-zinc-300 transition disabled:opacity-50">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-zinc-300 mx-auto mb-2 animate-spin" />
            ) : (
              <ImageIcon className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            )}
            <p className="text-sm font-medium text-muted-foreground">{t('image.dropOrClick')}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{t('image.uploadHint')}</p>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
