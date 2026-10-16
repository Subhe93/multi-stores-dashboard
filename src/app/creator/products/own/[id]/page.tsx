'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProductForm } from '@/components/product/ProductForm';
import { ProductMarketPricesTab } from '@/components/markets/ProductMarketPricesTab';
import { ProductDesignerTab } from '@/components/designer/ProductDesignerTab';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAppEnabled, useStoreApps } from '@/lib/useStoreApps';
import { useUrlTab } from '@/lib/useUrlTab';

const TABS = ['details', 'markets', 'designer'] as const;
type Tab = (typeof TABS)[number];

export default function CreatorEditOwnProductPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('creator.products.marketPrices');
  const td = useTranslations('creator.designer.product');
  const { apps, loading } = useStoreApps();
  const marketsEnabled = isAppEnabled(apps, 'markets');
  const designerEnabled = isAppEnabled(apps, 'designer');
  // `?tab=designer` (links from the designer template page) opens that tab.
  const [tab, setTab] = useUrlTab(TABS, 'details');
  // Mount the side panels lazily, then keep them so unsaved edits survive tab switches.
  const [marketsMounted, setMarketsMounted] = useState(false);
  const [designerMounted, setDesignerMounted] = useState(false);

  const showTabs = !loading && (marketsEnabled || designerEnabled);
  const activeTab: Tab =
    showTabs && ((tab === 'markets' && marketsEnabled) || (tab === 'designer' && designerEnabled)) ? tab : 'details';

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
            // Keep the panel being left mounted too (it may have been opened from the URL).
            if (next === 'markets' || activeTab === 'markets') setMarketsMounted(true);
            if (next === 'designer' || activeTab === 'designer') setDesignerMounted(true);
          }}
        >
          <TabsList>
            <TabsTrigger value="details">{t('detailsTab')}</TabsTrigger>
            {marketsEnabled && <TabsTrigger value="markets">{t('tab')}</TabsTrigger>}
            {designerEnabled && <TabsTrigger value="designer">{td('tab')}</TabsTrigger>}
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
      {showTabs && marketsEnabled && (marketsMounted || activeTab === 'markets') && (
        <div className={activeTab === 'markets' ? '' : 'hidden'}>
          <ProductMarketPricesTab productId={id} />
        </div>
      )}
      {showTabs && designerEnabled && (designerMounted || activeTab === 'designer') && (
        <div className={activeTab === 'designer' ? '' : 'hidden'}>
          <ProductDesignerTab productId={id} />
        </div>
      )}
    </div>
  );
}
