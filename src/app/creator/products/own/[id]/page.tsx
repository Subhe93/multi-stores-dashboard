'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProductForm } from '@/components/product/ProductForm';
import { ProductMarketPricesTab } from '@/components/markets/ProductMarketPricesTab';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';

type Tab = 'details' | 'markets';

export default function CreatorEditOwnProductPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('creator.products.marketPrices');
  const { apps, loading } = useStoreApps();
  const marketsEnabled = isAppEnabled(apps, 'markets');
  const [tab, setTab] = useState<Tab>('details');
  // Mount the market-prices panel lazily, then keep it so unsaved edits survive tab switches.
  const [marketsMounted, setMarketsMounted] = useState(false);

  const showTabs = !loading && marketsEnabled;
  const activeTab: Tab = showTabs ? tab : 'details';

  // The wrapper is rendered from the start so the product form is never
  // re-parented (and remounted) once the apps request resolves.
  return (
    <div className="space-y-4">
      {showTabs && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = String(v) as Tab;
            setTab(next);
            if (next === 'markets') setMarketsMounted(true);
          }}
        >
          <TabsList>
            <TabsTrigger value="details">{t('detailsTab')}</TabsTrigger>
            <TabsTrigger value="markets">{t('tab')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className={activeTab === 'details' ? '' : 'hidden'}>
        <ProductForm
          mode="edit"
          productId={id}
          backUrl="/creator/products"
          postCreateUrl="/creator/products/own"
        />
      </div>
      {showTabs && marketsMounted && (
        <div className={activeTab === 'markets' ? '' : 'hidden'}>
          <ProductMarketPricesTab productId={id} />
        </div>
      )}
    </div>
  );
}
