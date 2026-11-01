'use client';

import { Suspense } from 'react';
import { CustomerListView } from '@/components/customers/CustomerListView';

export default function AdminCustomersPage() {
  // useSearchParams (URL filter state) needs a Suspense boundary.
  return (
    <Suspense>
      <CustomerListView scope="admin" />
    </Suspense>
  );
}
