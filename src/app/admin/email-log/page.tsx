'use client';

import { useTranslations } from 'next-intl';
import { EmailLogTable } from '@/components/mail/EmailLogTable';

// Admin view of the email delivery log: every store plus platform mail.
export default function AdminEmailLogPage() {
  const t = useTranslations('emailLog');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminSubtitle')}</p>
      </div>
      <EmailLogTable endpoint="/mail/admin/logs" showStore />
    </div>
  );
}
