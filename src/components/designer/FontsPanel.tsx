'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, Trash2, Upload, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import {
  deleteFont,
  getTemplate,
  listFonts,
  listTemplates,
  uploadFont,
  FONT_MAX_MB,
  type DesignerFontView,
} from '@/lib/designer/designer.api';
import type { TemplateSpecV1 } from '@multi-stores/core/designer';
import { formatBytes } from '@/components/importer/ImporterBits';

/** Families of the imported NPP (Namez) templates, named only as an example when present. */
const NPP_EXAMPLE_FAMILIES = ['montserrat', 'anton', 'righteous'];

/** Google static file suffix per weight (`Family-SemiBold.ttf`). */
const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

/** One face the store's templates use (from the text elements). */
interface UsedFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  templates: string[];
}

const faceKey = (family: string, weight: number, style: string) => `${family.trim().toLowerCase()}|${weight}|${style || 'normal'}`;

/** Google-style file name of a face, e.g. `Open Sans` 600 italic → `OpenSans-SemiBoldItalic.ttf`. */
function suggestedFile(f: { family: string; weight: number; style: string }): string {
  const base = WEIGHT_NAMES[f.weight] ?? String(f.weight);
  const suffix = f.style === 'italic' ? (base === 'Regular' ? 'Italic' : `${base}Italic`) : base;
  return `${f.family.replace(/\s+/g, '')}-${suffix}.ttf`;
}

const googleUrl = (family: string) => `https://fonts.google.com/specimen/${encodeURIComponent(family.trim()).replace(/%20/g, '+')}`;

/**
 * Faces used by the text elements of the store's templates (live version,
 * else the latest draft), with the names of the templates using them.
 */
async function loadUsedFaces(token: string): Promise<{ faces: UsedFace[]; nppExample: boolean }> {
  const list = await listTemplates(token, { limit: 200 });
  const live = list.items.filter((x) => x.status !== 'ARCHIVED');
  const details = await Promise.all(live.map((x) => getTemplate(token, x.id).catch(() => null)));
  const byKey = new Map<string, UsedFace>();
  let nppExample = false;
  for (const d of details) {
    if (!d) continue;
    const spec: TemplateSpecV1 | null = d.current_spec ?? d.latest_version?.spec ?? null;
    if (!spec) continue;
    for (const surface of spec.surfaces ?? []) {
      for (const el of surface.elements ?? []) {
        if (el.type !== 'text' || !el.font?.family) continue;
        const style = el.font.style === 'italic' ? 'italic' : 'normal';
        const key = faceKey(el.font.family, el.font.weight, style);
        const face = byKey.get(key) ?? { family: el.font.family.trim(), weight: el.font.weight, style, templates: [] };
        if (!face.templates.includes(d.name)) face.templates.push(d.name);
        byKey.set(key, face);
        if (d.source === 'npp' && NPP_EXAMPLE_FAMILIES.includes(el.font.family.trim().toLowerCase())) nppExample = true;
      }
    }
  }
  const faces = [...byKey.values()].sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight || a.style.localeCompare(b.style));
  return { faces, nppExample };
}

const AUTO = '__auto__';
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

interface UploadOutcome {
  file: string;
  ok: boolean;
  text: string;
}

/**
 * Fonts of the "Assets & fonts" tab: a checklist of the faces the store's
 * templates use that have no uploaded file yet (with Google Fonts download
 * steps), multi-file upload (family / weight / style are read from Google
 * file names such as `Montserrat-SemiBold.ttf`), and the store's faces with
 * in-use protection on delete.
 */
export function FontsPanel({ token }: { token: string }) {
  const t = useTranslations('creator.designer.fonts');
  const locale = useLocale();
  const describeError = useApiError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fonts, setFonts] = useState<DesignerFontView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState('');
  const [weight, setWeight] = useState(AUTO);
  const [style, setStyle] = useState(AUTO);
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [used, setUsed] = useState<{ faces: UsedFace[]; nppExample: boolean } | null>(null);
  const [usedError, setUsedError] = useState(false);

  const load = useCallback(() => {
    listFonts(token)
      .then((list) => setFonts(Array.isArray(list) ? list : []))
      .catch((err) => {
        setFonts([]);
        setError(describeError(err));
      });
    // describeError only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    loadUsedFaces(token)
      .then((res) => {
        if (!cancelled) setUsed(res);
      })
      .catch(() => {
        if (!cancelled) {
          setUsed({ faces: [], nppExample: false });
          setUsedError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const uploadedKeys = new Set((fonts ?? []).filter((x) => !x.superseded).map((x) => faceKey(x.family, x.weight, x.style)));
  const missing = (used?.faces ?? []).filter((f) => !uploadedKeys.has(faceKey(f.family, f.weight, f.style)));
  const missingFamilies = [...new Set(missing.map((f) => f.family))];

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const results: UploadOutcome[] = [];
    // Overrides only make sense for a single file; several files rely on their names.
    const single = files.length === 1;
    for (const file of files) {
      if (file.size > FONT_MAX_MB * 1024 * 1024) {
        results.push({ file: file.name, ok: false, text: t('tooLarge', { max: FONT_MAX_MB }) });
        continue;
      }
      try {
        const res = await uploadFont(token, {
          file,
          family: single && family.trim() ? family.trim() : undefined,
          weight: single && weight !== AUTO ? Number(weight) : undefined,
          style: single && style !== AUTO ? (style as 'normal' | 'italic') : undefined,
        });
        const face = `${res.font.family} ${res.font.weight}${res.font.style === 'italic' ? ' italic' : ''}`;
        results.push({
          file: file.name,
          ok: true,
          text: res.deduped ? t('resultDeduped', { face }) : res.replaced.length ? t('resultReplaced', { face }) : t('resultAdded', { face }),
        });
      } catch (err) {
        const text =
          err instanceof ApiError && err.code === 'DESIGNER_FONT_INVALID' ? t('resultInvalid') : describeError(err);
        results.push({ file: file.name, ok: false, text });
      }
    }
    setOutcomes(results);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    load();
  };

  const remove = async (f: DesignerFontView) => {
    setDeleting(f.id);
    setRowError(null);
    try {
      await deleteFont(token, f.id);
      load();
    } catch (err) {
      setRowError({ id: f.id, text: err instanceof ApiError && err.code === 'DESIGNER_ASSET_IN_USE' ? t('inUse') : describeError(err) });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('guideTitle')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('guideIntro')}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {!used || !fonts ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : usedError ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground">{t('guideLoadFailed')}</p>
          ) : used.faces.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground">{t('guideNoFonts')}</p>
          ) : missing.length === 0 ? (
            <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" />
              {t('guideAllUploaded', { count: used.faces.length })}
            </p>
          ) : (
            <>
              <p className="font-medium text-amber-800">{t('guideMissingCount', { count: missing.length })}</p>
              <ul className="divide-y rounded-md border">
                {missing.map((f) => (
                  <li key={faceKey(f.family, f.weight, f.style)} className="space-y-0.5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CircleDashed className="size-4 shrink-0 text-amber-600" />
                      <span className="font-medium" dir="auto">
                        {f.family} {f.weight}
                        {f.style === 'italic' ? ` ${t('styleItalic')}` : ''}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {suggestedFile(f)}
                      </span>
                      <span className="ms-auto text-[11px] text-amber-700">{t('missing')}</span>
                    </div>
                    <p className="ps-6 text-[11px] text-muted-foreground" dir="auto">
                      {t('guideUsedBy', { templates: f.templates.join(', ') })}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <ol className="list-decimal space-y-1.5 ps-5 text-muted-foreground">
            <li>
              {t('step1')}{' '}
              {missingFamilies.length > 0 && (
                <span className="inline-flex flex-wrap gap-x-2">
                  {missingFamilies.map((fam) => (
                    <a
                      key={fam}
                      href={googleUrl(fam)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-6 items-center gap-0.5 font-medium text-foreground underline underline-offset-2"
                    >
                      {fam}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </span>
              )}
            </li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>
          {used?.nppExample && <p className="text-muted-foreground">{t('nppExample')}</p>}
          <p className="rounded-md bg-zinc-50 p-2.5 text-muted-foreground">{t('altSource')}</p>
          <p className="text-muted-foreground">{t('licenseNote')}</p>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('uploadTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('uploadHint', { max: FONT_MAX_MB })}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="dz-font-family" className="text-[11px] font-normal text-muted-foreground">
                  {t('family')}
                </Label>
                <Input id="dz-font-family" className="h-8 text-xs" maxLength={64} placeholder={t('auto')} value={family} onChange={(e) => setFamily(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t('weight')}</span>
                <SearchableSelect
                  value={weight}
                  onChange={setWeight}
                  options={[{ value: AUTO, label: t('auto') }, ...WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))]}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t('style')}</span>
                <SearchableSelect
                  value={style}
                  onChange={setStyle}
                  options={[
                    { value: AUTO, label: t('auto') },
                    { value: 'normal', label: t('styleNormal') },
                    { value: 'italic', label: t('styleItalic') },
                  ]}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('overridesHint')}</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button type="button" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {t('chooseFiles')}
            </Button>
            {outcomes.length > 0 && (
              <ul className="space-y-1 rounded-md border p-2 text-xs">
                {outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {o.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />}
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {o.file}
                      </span>
                      <span className={o.ok ? '' : 'text-red-700'}>{o.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('listTitle', { count: fonts?.length ?? 0 })}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
            {!fonts ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : fonts.length === 0 ? (
              <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {fonts.map((f) => (
                  <li key={f.id} className="space-y-1 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {f.family} {f.weight}
                        {f.style === 'italic' ? ` ${t('styleItalic')}` : ''}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {f.format}
                      </Badge>
                      {f.superseded && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground" title={t('supersededHint')}>
                          {t('superseded')}
                        </Badge>
                      )}
                      <span className="ms-auto text-muted-foreground">{formatBytes(f.bytes, locale)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-600"
                        aria-label={t('delete')}
                        disabled={deleting === f.id}
                        onClick={() => remove(f)}
                      >
                        {deleting === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                    {rowError?.id === f.id && <p className="text-red-600">{rowError.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
