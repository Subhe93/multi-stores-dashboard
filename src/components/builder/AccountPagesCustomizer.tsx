'use client';

// Look of the storefront account pages (login / register / password reset):
// a full-width background image or colour behind the centred form card.
// Stored as `theme_config.auth`; the parent (ThemePanel) autosaves it.

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageField } from './fields/FieldRenderer';
import { cn } from '@/lib/utils';

export type AuthImagePosition = 'center' | 'top' | 'bottom';

export interface AuthPagesConfig {
  background_image?: string;
  background_color?: string;
  image_position?: AuthImagePosition;
  overlay_opacity?: number;
}

const POSITIONS: AuthImagePosition[] = ['top', 'center', 'bottom'];
const MAX_OVERLAY = 90;

interface AccountPagesCustomizerProps {
  value: AuthPagesConfig | undefined;
  onChange: (next: AuthPagesConfig) => void;
  token: string;
  apiBase: string;
  locale: string;
}

export function AccountPagesCustomizer({ value, onChange, token, apiBase, locale }: AccountPagesCustomizerProps) {
  const t = useTranslations('builder.accountPages');
  const tb = useTranslations('builder');
  const v = value || {};

  // Drop empty keys so an unset field falls back to the default look.
  const set = (patch: Partial<AuthPagesConfig>) => {
    const next: Record<string, unknown> = { ...v, ...patch };
    for (const key of Object.keys(next)) {
      if (next[key] === '' || next[key] === undefined) delete next[key];
    }
    onChange(next as AuthPagesConfig);
  };

  const position = v.image_position || 'center';
  const overlay = v.overlay_opacity ?? 0;
  const color = v.background_color || '';

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-400 leading-snug">{t('hint')}</p>

      <div className="space-y-1.5">
        <Label className="text-[11.5px] font-medium text-zinc-700">{t('backgroundImage')}</Label>
        <ImageField
          value={v.background_image || ''}
          onChange={(url) => set({ background_image: url })}
          token={token}
          apiBase={apiBase}
          locale={locale}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11.5px] font-medium text-zinc-700 shrink-0">{t('backgroundColor')}</Label>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff'}
            onChange={(e) => set({ background_color: e.target.value })}
            className="h-7 w-8 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 shrink-0"
          />
          <Input
            className="h-7 w-22 text-[11px] font-mono"
            value={color}
            placeholder="#fff4cc"
            onChange={(e) => set({ background_color: e.target.value.trim() })}
          />
          {color && (
            <button
              type="button"
              onClick={() => set({ background_color: '' })}
              className="text-zinc-400 hover:text-zinc-900 shrink-0"
              title={tb('clear')}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {v.background_image && (
        <>
          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-medium text-zinc-700">{t('imageFocus')}</Label>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-zinc-100 p-0.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set({ image_position: p })}
                  className={cn(
                    'h-7 rounded text-[11px] font-medium transition',
                    position === p ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
                  )}
                >
                  {t(`position.${p}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11.5px] font-medium text-zinc-700">{t('overlay')}</Label>
              <span className="text-[10.5px] font-mono text-zinc-500">{overlay}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_OVERLAY}
              step={5}
              value={overlay}
              onChange={(e) => {
                const n = Number(e.target.value);
                set({ overlay_opacity: n > 0 ? n : undefined });
              }}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      )}

      <p className="text-[10px] text-zinc-400 leading-snug">{t('previewHint')}</p>
    </div>
  );
}
