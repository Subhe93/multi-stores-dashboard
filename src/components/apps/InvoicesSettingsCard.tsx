'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/common/ToggleSwitch';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { AppSettingsFooter } from '@/components/apps/AppSettingsFooter';
import { useStoreAppSettingsForm } from '@/components/apps/useStoreAppSettingsForm';
import type { MyStoreAppView } from '@/lib/storeApps.registry';
import {
  COD_ISSUE_ON,
  normalizeInvoiceSettings,
  sameInvoiceSettings,
  type CodIssueOn,
  type InvoiceSettings,
} from '@/lib/invoices';

interface InvoicesSettingsCardProps {
  app: MyStoreAppView;
  token: string;
}

/**
 * Behaviour flags of the "invoices" app ("Settings" tab of the Invoices
 * page). Seller identity and numbering live on their own tabs.
 */
export function InvoicesSettingsCard({ app, token }: InvoicesSettingsCardProps) {
  const t = useTranslations('creator.apps.invoices.settings');
  const { form, update, saving, dirty, save, error, saved } = useStoreAppSettingsForm({
    app,
    token,
    normalize: normalizeInvoiceSettings,
    same: sameInvoiceSettings,
    fallbackError: t('saveFailed'),
  });

  const codOptions = COD_ISSUE_ON.map((value) => ({
    value,
    label: value === 'delivered' ? t('codDelivered') : t('codCreated'),
  }));

  const toggleRow = (
    key: keyof Pick<InvoiceSettings, 'auto_issue' | 'attach_pdf_to_email' | 'credit_on_cancel'>,
    label: string,
    hint: string,
  ) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <Label className="text-sm font-normal">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ToggleSwitch checked={form[key]} disabled={saving} onChange={(next) => update(key, next)} label={label} />
    </div>
  );

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {toggleRow('auto_issue', t('autoIssue'), t('autoIssueHint'))}

        <div className="max-w-md space-y-1.5">
          <Label className="text-sm font-normal">{t('codIssueOn')}</Label>
          <SearchableSelect
            value={form.cod_issue_on}
            onChange={(value) => update('cod_issue_on', value as CodIssueOn)}
            options={codOptions}
          />
          <p className="text-xs text-muted-foreground">{t('codIssueOnHint')}</p>
        </div>

        {toggleRow('attach_pdf_to_email', t('attachPdf'), t('attachPdfHint'))}
        {toggleRow('credit_on_cancel', t('creditOnCancel'), t('creditOnCancelHint'))}

        <AppSettingsFooter error={error} saved={saved} savedLabel={t('saved')} saving={saving} dirty={dirty} onSave={save} />
      </CardContent>
    </Card>
  );
}
