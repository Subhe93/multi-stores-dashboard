'use client';

import { NotificationBell } from '@/components/common/NotificationBell';

interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
}

export function DashboardHeader({ userRole }: DashboardHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 shrink-0">
      {/* Left: empty — page titles live inside each page */}
      <div />

      {/* Right: notifications */}
      <div className="flex items-center gap-1">
        <NotificationBell role={userRole || ''} />
      </div>
    </header>
  );
}