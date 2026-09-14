'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  BookOpen,
  CreditCard,
  ExternalLink,
  ShieldAlert,
  UserCog,
  Palette,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'admin' | 'creator';

// Static operating guide for admins. Everything here documents behaviour that
// already exists in the platform (store-type switch on the creator page, the
// creator's payment settings); keep it in sync when those flows change.

function RoleBadge({ role }: { role: Role }) {
  const t = useTranslations('guide');
  return role === 'admin' ? (
    <Badge variant="outline" className="text-[10px] gap-1 bg-violet-50 text-violet-700 border-violet-200">
      <UserCog className="size-3" />
      {t('roleAdmin')}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] gap-1 bg-sky-50 text-sky-700 border-sky-200">
      <Palette className="size-3" />
      {t('roleCreator')}
    </Badge>
  );
}

function Step({
  index,
  role,
  title,
  body,
  action,
}: {
  index: number;
  role: Role;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-white p-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
        {index}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          <RoleBadge role={role} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
        {action && (
          <Link href={action.href}>
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              {action.label}
              <ExternalLink className="size-3" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: 'amber' | 'zinc' }) {
  const cls =
    tone === 'amber'
      ? 'rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800'
      : 'rounded-md border bg-zinc-50 p-3 text-zinc-700';
  return (
    <ul className={`list-disc space-y-1 ps-7 text-xs leading-relaxed ${cls}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function AdminGuidePage() {
  const t = useTranslations('guide');

  const convertSteps: { role: Role; title: string; body: string; action?: { href: string; label: string } }[] = [
    { role: 'admin', title: t('convertStep1Title'), body: t('convertStep1Body'), action: { href: '/admin/creators', label: t('openCreators') } },
    { role: 'admin', title: t('convertStep2Title'), body: t('convertStep2Body') },
    { role: 'creator', title: t('convertStep3Title'), body: t('convertStep3Body') },
    { role: 'creator', title: t('convertStep4Title'), body: t('convertStep4Body') },
    { role: 'creator', title: t('convertStep5Title'), body: t('convertStep5Body') },
    { role: 'admin', title: t('convertStep6Title'), body: t('convertStep6Body'), action: { href: '/admin/settings', label: t('openSettings') } },
  ];

  const methods: { key: 'cod' | 'stripe' | 'kustom'; name: string; controlledBy: string; where: string; conditions: string }[] = [
    { key: 'cod', name: t('methodCod'), controlledBy: t('methodCodBy'), where: t('methodCodWhere'), conditions: t('methodCodConditions') },
    { key: 'stripe', name: t('methodStripe'), controlledBy: t('methodStripeBy'), where: t('methodStripeWhere'), conditions: t('methodStripeConditions') },
    { key: 'kustom', name: t('methodKustom'), controlledBy: t('methodKustomBy'), where: t('methodKustomWhere'), conditions: t('methodKustomConditions') },
  ];

  const kustomSteps: { role: Role; title: string; body: string }[] = [
    { role: 'creator', title: t('kustomStep1Title'), body: t('kustomStep1Body') },
    { role: 'creator', title: t('kustomStep2Title'), body: t('kustomStep2Body') },
    { role: 'creator', title: t('kustomStep3Title'), body: t('kustomStep3Body') },
    { role: 'admin', title: t('kustomStep4Title'), body: t('kustomStep4Body') },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <BookOpen className="size-4" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="convert">
        <TabsList variant="line" className="border-b w-full justify-start rounded-none px-0">
          <TabsTrigger value="convert" className="flex-none px-3">
            <ArrowLeftRight className="size-4" />
            {t('tabConvert')}
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-none px-3">
            <CreditCard className="size-4" />
            {t('tabPayments')}
          </TabsTrigger>
        </TabsList>

        {/* ── Marketplace → Independent conversion ── */}
        <TabsContent value="convert" className="space-y-4 pt-2">
          <Card className="shadow-none">
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{t('convertIntro')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs font-semibold">{t('marketplaceTitle')}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t('marketplaceDesc')}</p>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs font-semibold">{t('independentTitle')}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t('independentDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-amber-600" />
                {t('beforeTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList tone="amber" items={[t('before1'), t('before2'), t('before3'), t('before4')]} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('stepsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {convertSteps.map((s, i) => (
                <Step key={s.title} index={i + 1} role={s.role} title={s.title} body={s.body} action={s.action} />
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('effectsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BulletList tone="zinc" items={[t('effect1'), t('effect2'), t('effect3'), t('effect4')]} />
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t('revertTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-muted-foreground">{t('revertBody')}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Payment methods ── */}
        <TabsContent value="payments" className="space-y-4 pt-2">
          <Card className="shadow-none">
            <CardContent className="pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{t('paymentsIntro')}</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('methodsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-start text-muted-foreground">
                      <th className="py-2 pe-3 text-start font-medium">{t('colMethod')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{t('colControlledBy')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{t('colWhere')}</th>
                      <th className="py-2 text-start font-medium">{t('colConditions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((m) => (
                      <tr key={m.key} className="border-b last:border-0 align-top">
                        <td className="py-2.5 pe-3 font-medium whitespace-nowrap">{m.name}</td>
                        <td className="py-2.5 pe-3">{m.controlledBy}</td>
                        <td className="py-2.5 pe-3 text-muted-foreground">{m.where}</td>
                        <td className="py-2.5 text-muted-foreground">{m.conditions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <UserCog className="size-4" />
                {t('adminNoteTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList tone="zinc" items={[t('adminNote1'), t('adminNote2'), t('adminNote3')]} />
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('kustomStepsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {kustomSteps.map((s, i) => (
                <Step key={s.title} index={i + 1} role={s.role} title={s.title} body={s.body} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
