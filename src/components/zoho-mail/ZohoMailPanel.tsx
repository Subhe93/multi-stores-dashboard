'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  AtSign,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  LogOut,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useTransientFlag } from '@/lib/useTransientFlag';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { AppTurnedOff } from '@/components/apps/AppTurnedOff';
import { ConfirmDialog, ErrorBanner, SpinnerBlock } from '@/components/importer/ImporterBits';
import {
  DEFAULT_ZOHO_REGION,
  ZOHO_REGIONS,
  zohoApiConsoleUrl,
  zohoMailApi,
  type ZohoMailStatus,
} from './zohoMail.api';

interface ZohoMailPanelProps {
  token: string;
  // Default recipient of the test email (the creator's own address).
  userEmail: string;
}

type Notice = { type: 'success' | 'error'; text: string; detail?: string | null };

// 'all' removes token + client credentials; 'token' keeps the client.
type DisconnectMode = 'all' | 'token';

// Query params the OAuth callback appends when it redirects back here.
const CALLBACK_PARAMS = ['connected', 'error'] as const;

// Shape of an API error code (e.g. ZOHO_SEND_FAILED).
const CODE_RE = /^[A-Z][A-Z0-9_]+$/;

// API error codes and OAuth-callback `?error=` values → message keys
// (errors.<key>). Unlisted codes are looked up as they are.
const CODE_ALIASES: Record<string, string> = {
  STORE_APP_NOT_ENABLED: 'ZOHO_APP_DISABLED',
  ZOHO_MAIL_REQUIRES_INDEPENDENT: 'ZOHO_STORE_NOT_INDEPENDENT',
  ZOHO_MAIL_NOT_CONNECTED: 'ZOHO_NOT_CONNECTED',
  ZOHO_MAIL_FROM_NOT_ALLOWED: 'ZOHO_FROM_NOT_ALLOWED',
  ZOHO_MAIL_INVALID_REGION: 'ZOHO_INVALID_REGION',
  ZOHO_MAIL_INVALID_CLIENT: 'ZOHO_INVALID_CLIENT',
  ZOHO_MAIL_RECONNECT_REQUIRED: 'ZOHO_RECONNECT_REQUIRED',
  ZOHO_MAIL_API_ERROR: 'ZOHO_API_ERROR',
  ZOHO_MAIL_SEND_FAILED: 'ZOHO_SEND_FAILED',
  ZOHO_MAIL_NO_FROM_ADDRESS: 'ZOHO_NO_ACCOUNTS',
  ZOHO_MAIL_ATTACHMENT_TOO_LARGE: 'ZOHO_ATTACHMENT_TOO_LARGE',
  access_denied: 'ZOHO_OAUTH_DENIED',
  zoho_error: 'ZOHO_OAUTH_DENIED',
  missing_code: 'ZOHO_OAUTH_DENIED',
  invalid_state: 'ZOHO_STATE_INVALID',
  state_expired: 'ZOHO_STATE_INVALID',
  state_used: 'ZOHO_STATE_INVALID',
  invalid_server: 'ZOHO_STATE_INVALID',
  client_not_configured: 'ZOHO_CLIENT_NOT_CONFIGURED',
  not_allowed: 'ZOHO_APP_DISABLED',
  token_failed: 'ZOHO_TOKEN_EXCHANGE_FAILED',
  no_refresh_token: 'ZOHO_TOKEN_EXCHANGE_FAILED',
  accounts_failed: 'ZOHO_NO_ACCOUNTS',
  no_from_address: 'ZOHO_NO_ACCOUNTS',
};
const messageKey = (code: string): string => CODE_ALIASES[code] ?? code;

function TechnicalDetail({ text }: { text: string }) {
  const t = useTranslations('creator.zohoMail');
  return (
    <p className="wrap-break-word text-[11px] text-muted-foreground">
      {t('details')}{' '}
      <span className="font-mono" dir="ltr">
        {text}
      </span>
    </p>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (notice.type === 'error') {
    return (
      <div className="space-y-1">
        <ErrorBanner message={notice.text} />
        {notice.detail && <TechnicalDetail text={notice.detail} />}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <span>{notice.text}</span>
    </div>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-sm">{children}</dd>
    </div>
  );
}

/** One numbered step of the setup wizard. */
function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
          done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-600'
        }`}
      >
        {done ? <Check className="size-3.5" /> : n}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pb-1">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const t = useTranslations('creator.zohoMail.setup.redirect');
  const [copied, flashCopied] = useTransientFlag(1500);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied();
    } catch {
      // Clipboard may be unavailable (insecure context); the value is still selectable.
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        readOnly
        value={value}
        dir="ltr"
        className="h-8 min-w-0 flex-1 bg-zinc-50 font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t('title')}
      />
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        {copied ? <Check className="text-emerald-600" /> : <Copy />}
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}

/**
 * Zoho Mail store app. Like the Zoho Mail WordPress plugin, every store uses
 * its own Zoho OAuth client: region → redirect URI → API console → client
 * credentials → authorize → sender → test.
 */
export function ZohoMailPanel({ token, userEmail }: ZohoMailPanelProps) {
  const t = useTranslations('creator.zohoMail');
  const tErrors = useTranslations('errors');
  const tc = useTranslations('common');
  const locale = useLocale();
  const uid = useId();

  const [status, setStatus] = useState<ZohoMailStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appDisabled, setAppDisabled] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Client form (steps 1 and 4).
  const [region, setRegion] = useState<string>(DEFAULT_ZOHO_REGION);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [clientMsg, setClientMsg] = useState<Notice | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [senderMsg, setSenderMsg] = useState<Notice | null>(null);

  const [testTo, setTestTo] = useState(userEmail);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Notice | null>(null);

  const [disconnectMode, setDisconnectMode] = useState<DisconnectMode | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  /** Friendly text for an API error code, or null when the code is unknown. */
  const fromCode = (code: string | null | undefined): string | null =>
    code && tErrors.has(messageKey(code)) ? tErrors(messageKey(code)) : null;

  /** Friendly text for a thrown API error; unknown codes get the fallback. */
  const describe = (err: unknown, fallback: string): string =>
    (err instanceof ApiError ? fromCode(err.code) : null) ?? fallback;

  /** Raw server text, kept as a technical detail when no friendly mapping exists. */
  const rawDetail = (err: unknown): string | null => {
    if (err instanceof ApiError && fromCode(err.code)) return null;
    return err instanceof Error && err.message ? err.message : null;
  };

  const adopt = (next: ZohoMailStatus) => {
    setStatus(next);
    setRegion(next.region ?? DEFAULT_ZOHO_REGION);
    setClientId(next.client_id ?? '');
    setClientSecret('');
    setFromAddress(next.from_address ?? next.available_from[0] ?? '');
    setFromName(next.from_name ?? '');
  };

  // Result of the OAuth round trip (?connected=1 / ?error=<code>), read once
  // and removed from the URL so a reload does not repeat the message.
  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('connected');
    const error = url.searchParams.get('error');
    if (!connected && !error) return;
    if (error) {
      const known = fromCode(error);
      setNotice({ type: 'error', text: known ?? t('callback.failed'), detail: known ? null : error });
    } else if (connected === '1') {
      setNotice({ type: 'success', text: t('callback.connected') });
    }
    for (const key of CALLBACK_PARAMS) url.searchParams.delete(key);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    // Runs once on mount; the translators are stable for the mounted locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    zohoMailApi
      .status(token)
      .then((s) => {
        if (cancelled) return;
        if (!s.enabled) setAppDisabled(true);
        adopt(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && messageKey(err.code ?? '') === 'ZOHO_APP_DISABLED') setAppDisabled(true);
        else setLoadError(describe(err, t('loadFailed')));
      });
    return () => {
      cancelled = true;
    };
    // Load once per token; the helpers only use stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };

  const regionLabel = (value: string | null): string => {
    const r = ZOHO_REGIONS.find((x) => x.value === value);
    return r ? `${t(`regions.${r.key}`)} (${r.value})` : value || '—';
  };

  const regionOptions = ZOHO_REGIONS.map((r) => ({ value: r.value, label: `${t(`regions.${r.key}`)} (${r.value})` }));

  const handleSaveClient = async () => {
    const id = clientId.trim();
    const secret = clientSecret.trim();
    if (savingClient || !id) return;
    setSavingClient(true);
    setClientMsg(null);
    try {
      adopt(
        await zohoMailApi.saveClient(token, {
          region,
          client_id: id,
          // Omitted = keep the stored secret.
          ...(secret ? { client_secret: secret } : {}),
        }),
      );
      setClientMsg({ type: 'success', text: t('setup.client.saved') });
    } catch (err) {
      setClientMsg({ type: 'error', text: describe(err, t('setup.client.saveFailed')), detail: rawDetail(err) });
    } finally {
      setSavingClient(false);
    }
  };

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const { authorize_url } = await zohoMailApi.connect(token);
      if (!authorize_url) throw new Error('missing authorize_url');
      // The spinner stays on while the browser navigates to Zoho.
      window.location.href = authorize_url;
    } catch (err) {
      setConnectError(describe(err, t('setup.authorize.failed')));
      setConnecting(false);
    }
  };

  const handleSave = async () => {
    if (saving || !fromAddress) return;
    setSaving(true);
    setSenderMsg(null);
    try {
      adopt(await zohoMailApi.save(token, { from_address: fromAddress, from_name: fromName.trim() }));
      setSenderMsg({ type: 'success', text: t('sender.saved') });
    } catch (err) {
      setSenderMsg({ type: 'error', text: describe(err, t('sender.saveFailed')), detail: rawDetail(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setSenderMsg(null);
    try {
      adopt(await zohoMailApi.refreshAddresses(token));
      setSenderMsg({ type: 'success', text: t('sender.refreshed') });
    } catch (err) {
      setSenderMsg({ type: 'error', text: describe(err, t('sender.refreshFailed')), detail: rawDetail(err) });
    } finally {
      setRefreshing(false);
    }
  };

  const handleTest = async () => {
    const to = testTo.trim();
    if (testing || !to) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const result = await zohoMailApi.test(token, to);
      if (result?.ok) {
        setTestMsg({ type: 'success', text: t('test.sent', { to }) });
      } else {
        const known = result?.error && CODE_RE.test(result.error) ? fromCode(result.error) : null;
        setTestMsg({ type: 'error', text: known ?? t('test.failed'), detail: known ? null : (result?.error ?? null) });
      }
    } catch (err) {
      setTestMsg({ type: 'error', text: describe(err, t('test.failed')), detail: rawDetail(err) });
    } finally {
      setTesting(false);
      // verified_at / last_error changed on the server either way.
      zohoMailApi
        .status(token)
        .then(adopt)
        .catch(() => undefined);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectMode) return;
    const keepClient = disconnectMode === 'token';
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      adopt(await zohoMailApi.disconnect(token, keepClient));
      setDisconnectMode(null);
      setClientMsg(null);
      setSenderMsg(null);
      setTestMsg(null);
      setNotice({ type: 'success', text: keepClient ? t('disconnect.tokenOnly.done') : t('disconnect.done') });
    } catch (err) {
      setDisconnectError(describe(err, t('disconnect.failed')));
    } finally {
      setDisconnecting(false);
    }
  };

  if (appDisabled) return <AppTurnedOff icon={AtSign} />;
  if (loadError) return <ErrorBanner message={loadError} />;
  if (!status) return <SpinnerBlock />;

  const connected = status.connected;
  const clientConfigured = status.client_configured;
  const lastErrorText = status.last_error && CODE_RE.test(status.last_error) ? fromCode(status.last_error) : null;
  const senderDirty = fromAddress !== (status.from_address ?? '') || fromName.trim() !== (status.from_name ?? '');
  const fromOptions = status.available_from.map((a) => ({ value: a, label: a }));

  // Client form state: region / client id changes force a new authorization.
  const regionChanged = region !== (status.region ?? DEFAULT_ZOHO_REGION);
  const clientIdChanged = clientId.trim() !== (status.client_id ?? '');
  const clientDirty = regionChanged || clientIdChanged || clientSecret.trim() !== '';
  const secretReady = clientSecret.trim() !== '' || status.has_client_secret;
  const canSaveClient = !savingClient && clientId.trim() !== '' && secretReady && clientDirty;
  const reauthNeeded = connected && (regionChanged || clientIdChanged);
  const consoleUrl = zohoApiConsoleUrl(region);

  const disconnectCopy =
    disconnectMode === 'token'
      ? {
          title: t('disconnect.tokenOnly.title'),
          body: t('disconnect.tokenOnly.body'),
          confirm: t('disconnect.tokenOnly.confirm'),
        }
      : { title: t('disconnect.title'), body: t('disconnect.body'), confirm: t('disconnect.confirm') };

  return (
    <div className="max-w-3xl space-y-4">
      {notice && <NoticeBanner notice={notice} />}

      {/* What the app does */}
      <Card className="shadow-none">
        <CardContent className="flex items-start gap-3 py-5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>{t('about.emails')}</p>
            <p>{t('about.fallback')}</p>
            <p className="flex items-start gap-1.5">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-600" />
              <span>{t('about.permission')}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">{t('status.title')}</CardTitle>
            {connected ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                {t('status.connected')}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
                {t('status.notConnected')}
              </Badge>
            )}
          </div>
          {!connected && <CardDescription className="text-xs">{t('status.notConnectedHint')}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && (
            <dl className="grid gap-3 sm:grid-cols-2">
              <StatusRow label={t('status.email')}>
                <span dir="ltr">{status.connected_email ?? '—'}</span>
              </StatusRow>
              <StatusRow label={t('status.region')}>{regionLabel(status.region)}</StatusRow>
              <StatusRow label={t('status.connectedAt')}>{formatDate(status.connected_at)}</StatusRow>
              <StatusRow label={t('status.verifiedAt')}>
                {status.verified_at ? formatDate(status.verified_at) : t('status.neverVerified')}
              </StatusRow>
            </dl>
          )}

          {status.last_error && (
            <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                <span>
                  {t('status.lastError')}
                  {status.last_error_at && (
                    <span className="ms-1 font-normal text-red-600">({formatDate(status.last_error_at)})</span>
                  )}
                </span>
              </p>
              <p className="ps-5">{lastErrorText ?? t('status.lastErrorGeneric')}</p>
              {(status.last_error_detail || !lastErrorText) && (
                <p className="wrap-break-word ps-5 font-mono text-[11px] text-red-600" dir="ltr">
                  {status.last_error_detail || status.last_error}
                </p>
              )}
            </div>
          )}

          {(connected || clientConfigured) && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              {connected && (
                <Button size="sm" variant="outline" onClick={() => setDisconnectMode('token')}>
                  {t('disconnect.tokenOnly.button')}
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDisconnectMode('all')}>
                <LogOut className="rtl:-scale-x-100" />
                {t('disconnect.button')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup wizard (steps 1–5) */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t('setup.title')}</CardTitle>
          <CardDescription className="text-xs">{t('setup.hint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Step n={1} title={t('setup.region.title')} done={!!status.region && !regionChanged}>
            <SearchableSelect
              id={`${uid}-region`}
              options={regionOptions}
              value={region}
              onChange={setRegion}
            />
            <p className="text-[11px] text-muted-foreground">{t('setup.region.hint')}</p>
          </Step>

          <Step n={2} title={t('setup.redirect.title')}>
            {status.redirect_uri ? (
              <CopyField value={status.redirect_uri} />
            ) : (
              <p className="text-xs text-amber-700">{t('setup.redirect.missing')}</p>
            )}
            <p className="text-[11px] text-muted-foreground">{t('setup.redirect.hint')}</p>
          </Step>

          <Step n={3} title={t('setup.console.title')}>
            <ol className="list-decimal space-y-1 ps-4 text-xs text-muted-foreground">
              <li>{t('setup.console.open')}</li>
              <li>{t('setup.console.addClient')}</li>
              <li>
                {t('setup.console.fill')}
                <ul className="mt-1 list-disc space-y-0.5 ps-4">
                  <li>{t('setup.console.fieldName')}</li>
                  <li>{t('setup.console.fieldHomepage')}</li>
                  <li>{t('setup.console.fieldRedirect')}</li>
                </ul>
              </li>
              <li>{t('setup.console.create')}</li>
            </ol>
            <a
              href={consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <ExternalLink className="rtl:-scale-x-100" />
              {t('setup.console.link')}
              <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                {consoleUrl.replace('https://', '')}
              </span>
            </a>
          </Step>

          <Step n={4} title={t('setup.client.title')} done={clientConfigured && !clientDirty}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-client-id`} className="text-xs">
                  {t('setup.client.clientId')}
                </Label>
                <Input
                  id={`${uid}-client-id`}
                  className="h-8 font-mono text-sm"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="1000.XXXXXXXXXXXXXXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-client-secret`} className="text-xs">
                  {t('setup.client.clientSecret')}
                </Label>
                <Input
                  id={`${uid}-client-secret`}
                  className="h-8 font-mono text-sm"
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={status.has_client_secret ? '••••••••' : ''}
                />
                {status.has_client_secret && (
                  <p className="text-[11px] text-muted-foreground">{t('setup.client.secretSaved')}</p>
                )}
              </div>
            </div>
            {reauthNeeded ? (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                <span>{t('setup.client.changedWarning')}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t('setup.client.reauthHint')}</p>
            )}
            {clientMsg && <NoticeBanner notice={clientMsg} />}
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveClient} disabled={!canSaveClient}>
                {savingClient && <Loader2 className="animate-spin" />}
                {savingClient ? tc('saving') : t('setup.client.save')}
              </Button>
            </div>
          </Step>

          <Step n={5} title={t('setup.authorize.title')} done={connected}>
            <p className="text-xs text-muted-foreground">
              {clientConfigured ? t('setup.authorize.hint') : t('setup.authorize.needsClient')}
            </p>
            {clientConfigured && clientDirty && (
              <p className="text-[11px] text-amber-700">{t('setup.authorize.saveFirst')}</p>
            )}
            {connectError && <ErrorBanner message={connectError} />}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={connected ? 'outline' : 'default'}
                disabled={!clientConfigured || clientDirty || connecting}
                onClick={handleConnect}
              >
                {connecting ? <Loader2 className="animate-spin" /> : <PlugZap />}
                {connecting
                  ? t('setup.authorize.opening')
                  : connected
                    ? t('setup.authorize.reauthorize')
                    : t('setup.authorize.button')}
              </Button>
            </div>
          </Step>
        </CardContent>
      </Card>

      {/* Step 6: sender */}
      {connected && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('sender.title')}</CardTitle>
            <CardDescription className="text-xs">{t('sender.hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-from`} className="text-xs">
                  {t('sender.fromAddress')}
                </Label>
                {fromOptions.length > 0 ? (
                  <SearchableSelect
                    id={`${uid}-from`}
                    options={fromOptions}
                    value={fromAddress}
                    onChange={setFromAddress}
                    placeholder={t('sender.fromAddressPlaceholder')}
                  />
                ) : (
                  <p className="text-xs text-amber-700">{t('sender.noAddresses')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-name`} className="text-xs">
                  {t('sender.fromName')}
                </Label>
                <Input
                  id={`${uid}-name`}
                  className="h-8 text-sm"
                  value={fromName}
                  maxLength={100}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder={t('sender.fromNamePlaceholder')}
                />
                <p className="text-[11px] text-muted-foreground">{t('sender.fromNameHint')}</p>
              </div>
            </div>

            {senderMsg && <NoticeBanner notice={senderMsg} />}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
                {refreshing ? t('sender.refreshing') : t('sender.refresh')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !fromAddress || !senderDirty}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? tc('saving') : tc('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: test */}
      {connected && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('test.title')}</CardTitle>
            <CardDescription className="text-xs">{t('test.hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!status.from_address && <p className="text-xs text-amber-700">{t('test.needsFrom')}</p>}
            <div className="flex gap-2">
              <Input
                className="h-8 flex-1 text-sm"
                type="email"
                dir="ltr"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={t('test.to')}
                aria-label={t('test.to')}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={testing || !testTo.trim() || !status.from_address}
              >
                {testing ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
                {testing ? t('test.sending') : t('test.send')}
              </Button>
            </div>
            {testMsg && <NoticeBanner notice={testMsg} />}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={disconnectMode !== null}
        title={disconnectCopy.title}
        description={disconnectCopy.body}
        confirmLabel={disconnectCopy.confirm}
        destructive
        busy={disconnecting}
        error={disconnectError}
        onConfirm={handleDisconnect}
        onOpenChange={(o) => {
          if (!o) {
            setDisconnectMode(null);
            setDisconnectError(null);
          }
        }}
      />
    </div>
  );
}
