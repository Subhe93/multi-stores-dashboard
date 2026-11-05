'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, MapPin, Phone, CheckCircle2, Clock, Info, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { TraderDetails } from '@/lib/storeStatus';
import Link from 'next/link';

// Provider profile as returned by GET /providers/:id (only the fields this page reads).
interface ProviderDetail {
  id: string;
  company_name: string;
  country?: string | null;
  phone?: string | null;
  description?: string | null;
  verified: boolean;
  created_at: string;
  user?: { email: string } | null;
  /** Legal company identity (read-only here; the provider edits it). */
  legal_details?: TraderDetails | null;
  legal_details_complete?: boolean;
}

/** Read-only view of the provider's legal details (same shape as store trader details). */
function LegalDetailsCard({ details, complete }: { details?: TraderDetails | null; complete: boolean }) {
  const t = useTranslations('admin');
  const tf = useTranslations('creator.traderDetails');
  const rows: [string, string | undefined][] = details
    ? [
        [tf('fields.legal_name'), details.legal_name],
        [tf('fields.business_type'), details.business_type ? tf(`businessType.${details.business_type}`) : undefined],
        [tf('fields.org_number'), details.org_number],
        [tf('fields.vat_number'), details.vat_number],
        [
          tf('fields.address_line1'),
          [details.address_line1, details.address_line2, [details.postal_code, details.city].filter(Boolean).join(' '), details.country]
            .filter(Boolean)
            .join(', '),
        ],
        [tf('fields.phone'), details.phone],
        [tf('fields.support_email'), details.support_email],
      ]
    : [];
  const vat = details?.vat_number ? details.vat_check : null;
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{t('providerLegalDetails')}</CardTitle>
          {complete ? (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 me-1" />
              {tf('complete')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              <Clock className="w-3 h-3 me-1" />
              {t('providerLegalDetailsIncomplete')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {!details ? (
          <p className="text-muted-foreground">{t('providerLegalDetailsMissing')}</p>
        ) : (
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            {rows
              .filter(([, v]) => !!v)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
          </dl>
        )}
        {vat && (
          <p
            className={`mt-3 inline-flex items-start gap-1 text-[11px] ${
              vat.valid === true ? 'text-emerald-700' : vat.valid === false ? 'text-red-600' : 'text-amber-700'
            }`}
          >
            {vat.valid === true ? (
              <CheckCircle2 className="mt-px size-3 shrink-0" />
            ) : vat.valid === false ? (
              <XCircle className="mt-px size-3 shrink-0" />
            ) : (
              <Info className="mt-px size-3 shrink-0" />
            )}
            <span>
              {vat.valid === true ? tf('vies.verified') : vat.valid === false ? tf('vies.invalidShort') : t('providerVatNotVerified')}
              {vat.valid === true && vat.name ? ` — ${vat.name}` : ''}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProviderDetailPage() {
  const t = useTranslations('admin');
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProvider = () => {
    if (!token || !id) return;
    api<ProviderDetail>(`/providers/${id}`, { token })
      .then(setProvider)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProvider(); }, [token, id]);

  const handleVerify = async () => {
    if (!token) return;
    await api(`/providers/${id}/verify`, { method: 'PUT', token });
    fetchProvider();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!provider) return <p className="text-center py-12 text-muted-foreground">{t('providerNotFound')}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/providers" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition">
            <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{provider.company_name}</h1>
            <p className="text-sm text-muted-foreground">{provider.user?.email}</p>
          </div>
        </div>
        {provider.verified
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 me-1" />{t('verified')}</Badge>
          : <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 me-1" />{t('pending')}</Badge>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('companyInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{provider.user?.email}</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{provider.country}</div>
            {provider.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{provider.phone}</div>}
            {provider.description && <p className="text-muted-foreground">{provider.description}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t('actions')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!provider.verified && (
              <Button size="sm" className="w-full" onClick={handleVerify}>{t('verifyProvider')}</Button>
            )}
            <p className="text-[10px] text-muted-foreground">{t('joinedDate', { date: new Date(provider.created_at).toLocaleDateString() })}</p>
          </CardContent>
        </Card>
      </div>

      <LegalDetailsCard details={provider.legal_details} complete={!!provider.legal_details_complete} />
    </div>
  );
}
