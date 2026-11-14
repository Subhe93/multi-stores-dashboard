'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDown, ArrowUp, BadgeCheck, GripVertical, ImageIcon, MessageSquareQuote, Pencil, Play, Plus, Star, Trash2, Video,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { resolveMediaUrl } from '@/lib/media';
import type { VideoUploadConfig } from '@/lib/useVideoUpload';
import {
  MAX_STORIES_PER_PRODUCT, emptyStory, moveStory, storyText, type EditorStory,
} from '@/lib/productStories';
import { StoryDialog } from './StoryDialog';

type Translator = ReturnType<typeof useTranslations>;

/** Request from the form to open one story (client check or API refusal). */
export interface StoryOpenRequest {
  index: number;
  message: string;
  /** Changes on every request so the same story can be reopened. */
  nonce: number;
}

interface StoriesManagerProps {
  stories: EditorStory[];
  onChange: (stories: EditorStory[]) => void;
  locales: string[];
  primaryLocale: string;
  token: string | null;
  videoConfig: VideoUploadConfig | null;
  openRequest?: StoryOpenRequest | null;
  /** List-wide save refusal (e.g. the limit), shown under the list. */
  error?: string;
}

function StoryRow({
  story, index, count, primaryLocale, onEdit, onRemove, onMove, t,
}: {
  story: EditorStory;
  index: number;
  count: number;
  primaryLocale: string;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  t: Translator;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: story.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };
  const text = storyText(story, primaryLocale, primaryLocale);
  const isVideo = !!story.url && story.kind !== 'image';
  const thumb = story.kind === 'image' ? story.url : story.poster_url;
  const name = story.name.trim() || t('story.untitled');

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 bg-background px-2 py-2">
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('story.dragHandle', { name })}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <div className={`relative size-12 shrink-0 overflow-hidden rounded-md border ${isVideo ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
        {thumb ? (
          <img src={resolveMediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
        ) : isVideo ? (
          <Video className="absolute inset-0 m-auto size-4 text-zinc-500" aria-hidden="true" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-4 text-zinc-300" aria-hidden="true" />
        )}
        {isVideo && (
          <span className="absolute inset-0 m-auto flex size-5 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-2.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-medium">{name}</span>
          {story.verified && (
            <BadgeCheck className="size-3.5 shrink-0 text-emerald-600" aria-label={t('story.verified')} />
          )}
        </span>
        {text.subtitle.trim() && (
          <span className="block truncate text-xs text-muted-foreground">{text.subtitle}</span>
        )}
        {story.rating > 0 && (
          <span className="mt-0.5 flex items-center gap-0.5" role="img" aria-label={t('story.ratingValue', { rating: story.rating })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden="true"
                className={`size-3 ${n <= story.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`}
              />
            ))}
          </span>
        )}
      </button>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
          aria-label={t('story.moveUp')}
          title={t('story.moveUp')}
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
        >
          <ArrowUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === count - 1}
          aria-label={t('story.moveDown')}
          title={t('story.moveDown')}
          className="rounded p-1 hover:bg-muted disabled:opacity-30"
        >
          <ArrowDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('story.edit')}
          title={t('story.edit')}
          className="rounded p-1 hover:bg-muted"
        >
          <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('story.remove')}
          title={t('story.remove')}
          className="rounded p-1 hover:bg-red-50"
        >
          <Trash2 className="size-3.5 text-red-500" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * Customer stories of a product (contract section 5). Edits stay local and
 * are saved with the product (`stories` on the product save body).
 */
export function StoriesManager({
  stories, onChange, locales, primaryLocale, token, videoConfig, openRequest, error,
}: StoriesManagerProps) {
  const t = useTranslations();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [dialogStory, setDialogStory] = useState<EditorStory | null>(null);
  const [dialogError, setDialogError] = useState('');
  const atLimit = stories.length >= MAX_STORIES_PER_PRODUCT;

  const openStory = (index: number, message = '') => {
    const story = stories[index];
    if (!story) return;
    setEditIndex(index);
    setDialogStory(story);
    setDialogError(message);
    setDialogOpen(true);
  };

  const openAdd = () => {
    if (atLimit) return;
    setEditIndex(null);
    setDialogStory(emptyStory(locales));
    setDialogError('');
    setDialogOpen(true);
  };

  // The form asks to open a story (failed client check or API refusal).
  useEffect(() => {
    if (!openRequest) return;
    openStory(openRequest.index, openRequest.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.nonce]);

  const handleSave = (story: EditorStory) => {
    if (editIndex === null) {
      if (stories.length >= MAX_STORIES_PER_PRODUCT) return;
      onChange([...stories, story]);
    } else {
      onChange(stories.map((s, i) => (i === editIndex ? story : s)));
    }
    setDialogOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stories.findIndex((s) => s.key === active.id);
    const to = stories.findIndex((s) => s.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(moveStory(stories, from, to));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold">{t('story.title')}</span>
            <span className="text-xs text-muted-foreground tabular-nums">({stories.length}/{MAX_STORIES_PER_PRODUCT})</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t('story.hint')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={openAdd} disabled={atLimit}>
          <Plus className="me-1 size-3" /> {t('story.add')}
        </Button>
      </div>

      {stories.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t('story.empty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stories.map((s) => s.key)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded-md border">
              {stories.map((story, i) => (
                <StoryRow
                  key={story.key}
                  story={story}
                  index={i}
                  count={stories.length}
                  primaryLocale={primaryLocale}
                  onEdit={() => openStory(i)}
                  onRemove={() => onChange(stories.filter((_, j) => j !== i))}
                  onMove={(to) => onChange(moveStory(stories, i, to))}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {atLimit && (
        <p className="text-[11px] text-muted-foreground">{t('story.limitReached', { max: MAX_STORIES_PER_PRODUCT })}</p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <StoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        story={dialogStory}
        isNew={editIndex === null}
        locales={locales}
        primaryLocale={primaryLocale}
        token={token}
        videoConfig={videoConfig}
        externalError={dialogError}
        onSave={handleSave}
      />
    </div>
  );
}
