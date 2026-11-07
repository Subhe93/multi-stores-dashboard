'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OWN_KEY_PERMISSIONS,
  permissionCheck,
  type OwnKeyCheck,
  type OwnKeyPermission,
  type PermissionRow,
} from '@/lib/ownStripeKey';

function LevelBadge({ level }: { level: PermissionRow['level'] }) {
  const t = useTranslations('ownStripeKey.permissions');
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold',
        level === 'write'
          ? 'border-violet-200 bg-violet-50 text-violet-700'
          : 'border-sky-200 bg-sky-50 text-sky-700',
      )}
    >
      {level === 'write' ? t('write') : t('read')}
    </span>
  );
}

/**
 * Resource names stay in English: that is how the Stripe Dashboard shows them.
 * An isolated LTR run keeps "Group / Resource" readable while the cell itself
 * still aligns to the start edge in RTL.
 */
function ResourceName({ row }: { row: PermissionRow }) {
  return (
    <span className="block font-medium text-zinc-800">
      <bdi dir="ltr">
        <span className="text-muted-foreground">{row.group} / </span>
        {row.resource}
      </bdi>
    </span>
  );
}

/** The exact permission table to set on the restricted key (guide step 4). */
export function PermissionTable() {
  const t = useTranslations('ownStripeKey.permissions');
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t('resource')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('level')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {OWN_KEY_PERMISSIONS.map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-2 align-top">
                <ResourceName row={row} />
                <span className="block text-[11px] text-muted-foreground">
                  {t(`names.${row.key}`)}
                  {!row.required && <span className="ms-1 italic">({t('optional')})</span>}
                </span>
              </td>
              <td className="px-3 py-2 align-top">
                <LevelBadge level={row.level} />
              </td>
            </tr>
          ))}
          <tr className="bg-muted/20">
            <td className="px-3 py-2 text-[11px] text-muted-foreground">{t('everythingElse')}</td>
            <td className="px-3 py-2">
              <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 text-[10px] font-semibold text-zinc-600">
                {t('none')}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CheckIcon({ check }: { check: OwnKeyCheck }) {
  if (check === 'ok') return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
  if (check === 'missing') return <XCircle className="size-3.5 shrink-0 text-red-600" aria-hidden="true" />;
  return <CircleHelp className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />;
}

/**
 * Result checklist: one row per permission with ok / missing / unknown.
 * `missing` (from an OWN_KEY_MISSING_PERMISSIONS error) overrides the stored state.
 */
export function PermissionChecklist({
  permissions,
  missing,
}: {
  permissions?: Partial<Record<OwnKeyPermission, OwnKeyCheck>> | null;
  missing?: readonly string[] | null;
}) {
  const t = useTranslations('ownStripeKey.permissions');
  return (
    <ul className="divide-y rounded-lg border">
      {OWN_KEY_PERMISSIONS.map((row) => {
        const check = permissionCheck(permissions, row.key, missing);
        return (
          <li
            key={row.key}
            className={cn('flex items-start gap-2.5 px-3 py-2 text-xs', check === 'missing' && 'bg-red-50/70')}
          >
            <span className="mt-0.5">
              <CheckIcon check={check} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{t(`names.${row.key}`)}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <bdi dir="ltr">
                  {row.group} / {row.resource}
                </bdi>
                <LevelBadge level={row.level} />
                {!row.required && <span className="italic">({t('optional')})</span>}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-[11px] font-medium',
                check === 'ok' && 'text-emerald-700',
                check === 'missing' && 'text-red-700',
                check === 'unknown' && 'text-zinc-500',
              )}
            >
              {t(`check.${check}`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
