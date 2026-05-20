'use client';

import { NotificationBell } from '@/components/common/NotificationBell';

interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
  extras?: React.ReactNode;
}

export function DashboardHeader({ userRole, extras }: DashboardHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 shrink-0">
      {/* Left: empty — page titles live inside each page */}
      <div />

      {/* Right: extras + notifications */}
      <div className="flex items-center gap-2">
        {extras}
        <NotificationBell role={userRole || ''} />
      </div>
    </header>
  );
}