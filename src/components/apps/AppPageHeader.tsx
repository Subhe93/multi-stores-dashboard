import type { LucideIcon } from 'lucide-react';

interface AppPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  // Optional page-level actions shown at the inline end (e.g. "Add market").
  actions?: React.ReactNode;
}

/** Shared header of the store-app pages (markets, B2B, invoices). */
export function AppPageHeader({ icon: Icon, title, subtitle, actions }: AppPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
