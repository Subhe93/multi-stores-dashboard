'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Loader2, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { ConfirmDialog } from '@/components/importer/ImporterBits';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';
import { useTransientFlag } from '@/lib/useTransientFlag';
import {
  addDomain,
  getDnsTarget,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
  type DnsTarget,
  type DomainView,
  type StoreDomainStatus,
} from '@/lib/markets.api';

export const DOMAIN_STATUS_CLASS: Record<StoreDomainStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  VERIFIED: 'bg-sky-50 text-sky-700 border-sky-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function CopyValue({ value }: { value: string }) {
  const t = useTranslations('creator.markets.domains');
  const [copied, flashCopied] = useTransientFlag(1500);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied();
    } catch {
      // Clipboard may be unavailable (insecure context); the value is still readable.
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <code className="truncate font-mono text-xs text-zinc-800" dir="ltr">{value}</code>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center rounded border border-zinc-200 bg-white p-1 text-zinc-600 hover:bg-zinc-50"
        aria-label={t('copy')}
      >
        {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
      </button>
    </span>
  );
}

interface DomainsPanelProps {
  marketId: string;
  domains: DomainView[];
  platformHostname: string;
  onChange: (domains: DomainView[]) => void;
}

/**
 * Hostnames of one market: add (optionally with a www → apex redirect), DNS
 * instructions from GET /markets/dns-target, creator "Verify" (a passing
 * verify makes the host ACTIVE at once) and the status badge. An admin can
 * suspend a host from the store's domains card.
 */
export function DomainsPanel({ marketId, domains, platformHostname, onChange }: DomainsPanelProps) {
  const t = useTranslations('creator.markets.domains');
  const { token } = useAuth();
  const describeError = useApiError();

  const [dnsTarget, setDnsTarget] = useState<DnsTarget | null>(null);
  const [hostname, setHostname] = useState('');
  const [withWww, setWithWww] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hostname awaiting the remove confirmation.
  const [removeTarget, setRemoveTarget] = useState<DomainView | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getDnsTarget(token)
      .then((res) => { if (!cancelled) setDnsTarget(res); })
      .catch(() => { if (!cancelled) setDnsTarget(null); });
    return () => { cancelled = true; };
  }, [token]);

  const normalized = hostname.trim().toLowerCase();
  // The www alias only makes sense for an apex host (no "www." prefix already).
  const wwwEligible = !!normalized && !normalized.startsWith('www.');

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!token || busy) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = () =>
    run('add', async () => {
      const apex = await addDomain(token!, marketId, normalized);
      // Commit the apex row right away so a failing www alias never loses it.
      const withApex = [...domains, apex];
      onChange(withApex);
      setHostname('');
      setWithWww(false);
      if (withWww && wwwEligible) {
        try {
          const www = await addDomain(token!, marketId, `www.${normalized}`, normalized);
          onChange([...withApex, www]);
        } catch (err) {
          setError(t('wwwFailed', { host: normalized, error: describeError(err) }));
        }
      }
    });

  const handleVerify = (d: DomainView) =>
    run(`verify:${d.id}`, async () => {
      try {
        const updated = await verifyDomain(token!, marketId, d.id);
        onChange(domains.map((x) => (x.id === d.id ? updated : x)));
      } catch (err) {
        // The failure body carries what DNS currently returns; show it on the row.
        const observed = err instanceof ApiError && Array.isArray(err.payload?.observed) ? (err.payload.observed as string[]) : null;
        if (observed) onChange(domains.map((x) => (x.id === d.id ? { ...x, dns: { ...x.dns, observed } } : x)));
        throw err;
      }
    });

  const handlePrimary = (d: DomainView) =>
    run(`primary:${d.id}`, async () => {
      await setPrimaryDomain(token!, marketId, d.id);
      onChange(domains.map((x) => ({ ...x, is_primary: x.id === d.id })));
    });

  const handleRemove = (d: DomainView) => setRemoveTarget(d);

  const confirmRemove = async () => {
    const d = removeTarget;
    if (!d) return;
    await run(`remove:${d.id}`, async () => {
      await removeDomain(token!, marketId, d.id);
      onChange(domains.filter((x) => x.id !== d.id));
    });
    // A failure is shown under the list; the dialog closes either way.
    setRemoveTarget(null);
  };

  // Null/empty while the platform has not published a CNAME target yet; the
  // panel then shows a note instead of an empty value (actions stay usable).
  const cname = dnsTarget?.cname || domains[0]?.dns?.expected_cname || '';
  const dnsConfigured = dnsTarget === null ? !!cname : !!(dnsTarget.cname || dnsTarget.a);

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
        <p className="text-[11px] text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border bg-zinc-50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{t('platformHost')}</span>
          <code className="font-mono" dir="ltr">{platformHostname}</code>
        </div>

        {domains.length > 0 && (
          <ul className="divide-y rounded-md border">
            {domains.map((d) => {
              const verifying = busy === `verify:${d.id}`;
              return (
                <li key={d.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <code className="font-mono text-sm" dir="ltr">{d.hostname}</code>
                      <Badge variant="outline" className={`text-[10px] ${DOMAIN_STATUS_CLASS[d.status]}`}>
                        {t(`status.${d.status}`)}
                      </Badge>
                      {d.is_primary && (
                        <Badge variant="outline" className="text-[10px] bg-zinc-900 text-white border-zinc-900">
                          <Star className="size-3" /> {t('primary')}
                        </Badge>
                      )}
                      {d.redirect_to && (
                        <span className="text-[11px] text-muted-foreground">{t('redirectsTo', { host: d.redirect_to })}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {d.status !== 'ACTIVE' && (
                        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => handleVerify(d)}>
                          {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {t('verify')}
                        </Button>
                      )}
                      {!d.is_primary && !d.redirect_to && (
                        <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={() => handlePrimary(d)}>
                          {t('setPrimary')}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        disabled={!!busy}
                        onClick={() => handleRemove(d)}
                        aria-label={t('remove')}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {d.status !== 'ACTIVE' && (
                    <div className="grid gap-1 rounded-md border bg-white px-3 py-2 text-[11px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
                      <span className="uppercase tracking-wide text-muted-foreground">{t('dns.type')}</span>
                      <span className="font-mono">CNAME</span>
                      <span className="uppercase tracking-wide text-muted-foreground">{t('dns.name')}</span>
                      <CopyValue value={d.hostname} />
                      <span className="uppercase tracking-wide text-muted-foreground">{t('dns.value')}</span>
                      {d.dns?.expected_cname || cname ? (
                        <CopyValue value={d.dns?.expected_cname || cname} />
                      ) : (
                        <span className="text-amber-700">{t('dnsNotConfigured')}</span>
                      )}
                      {d.dns?.observed && (
                        <>
                          <span className="uppercase tracking-wide text-muted-foreground">{t('dns.observed')}</span>
                          <span className="font-mono" dir="ltr">{d.dns.observed.length ? d.dns.observed.join(', ') : t('dns.observedNone')}</span>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('hostname')}</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-sm"
                dir="ltr"
                value={hostname}
                onChange={(e) => setHostname(e.target.value.trim().toLowerCase())}
                placeholder="shop.example.com"
              />
              <Button type="button" size="sm" className="h-8" disabled={!normalized || !!busy} onClick={handleAdd}>
                {busy === 'add' ? <Loader2 className="animate-spin" /> : <Plus />} {t('add')}
              </Button>
            </div>
          </div>
          {wwwEligible && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">{t('redirectWww', { host: normalized })}</p>
                <p className="text-[11px] text-muted-foreground">{t('redirectWwwDesc')}</p>
              </div>
              <ToggleSwitch checked={withWww} onChange={setWithWww} label={t('redirectWww', { host: normalized })} />
            </div>
          )}
          {dnsConfigured ? (
            <p className="text-[11px] text-muted-foreground">
              {t('dns.intro')}{' '}
              {cname && <code className="font-mono" dir="ltr">CNAME → {cname}</code>}
              {dnsTarget?.a && <>{cname ? ' · ' : ''}<code className="font-mono" dir="ltr">A → {dnsTarget.a}</code></>}
            </p>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">{t('dnsNotConfigured')}</p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">{t('activationNote')}</p>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </CardContent>

      <ConfirmDialog
        open={removeTarget !== null}
        title={t('remove')}
        description={removeTarget ? t(removeTarget.is_primary ? 'removePrimaryConfirm' : 'removeConfirm', { host: removeTarget.hostname }) : undefined}
        confirmLabel={t('remove')}
        destructive
        busy={removeTarget !== null && busy === `remove:${removeTarget.id}`}
        onConfirm={confirmRemove}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
      />
    </Card>
  );
}
