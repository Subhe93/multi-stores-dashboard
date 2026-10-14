'use client';

import { useCallback, useState } from 'react';
import { useApiError } from '@/lib/useApiError';
import { downloadInvoicePdf, type InvoiceSummary } from '@/lib/invoices.api';

/**
 * PDF download state shared by the invoice list, detail dialog and order
 * card: which document is in flight plus a translated error (503
 * INVOICE_PDF_UNAVAILABLE resolves through `errors.<code>`).
 */
export function useInvoicePdfDownload(token: string | null | undefined) {
  const describeError = useApiError();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = useCallback(
    async (invoice: Pick<InvoiceSummary, 'id' | 'number'>) => {
      if (!token || downloadingId) return;
      setDownloadingId(invoice.id);
      setDownloadError(null);
      try {
        await downloadInvoicePdf(token, invoice);
      } catch (err) {
        setDownloadError(describeError(err));
      } finally {
        setDownloadingId(null);
      }
    },
    // describeError is rebuilt every render but only reads stable translators.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, downloadingId],
  );

  return { download, downloadingId, downloadError, clearDownloadError: () => setDownloadError(null) };
}
