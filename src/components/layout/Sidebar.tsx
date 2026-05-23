'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { LogOut, ChevronRight } from 'lucide-react';
import { DashboardLocaleSwitcher } from '@/components/common/DashboardLocaleSwitcher';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  groups: NavGroup[];
  title: string;
  subtitle?: string;
  /** Stable role key for the badge color (Provider | Admin | Creator). Falls
   *  back to deriving from `subtitle` so the color survives translated subtitles. */
  role?: string;
  userLabel?: string;
  userSub?: string;
  avatarText?: string;
  onLogout?: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  Provider: 'bg-violet-100 text-violet-700',
  Admin:    'bg-rose-100 text-rose-700',
  Creator:  'bg-emerald-100 text-emerald-700',
};

export function AppSidebar({
  groups,
  title,
  subtitle,
  role,
  userLabel,
  userSub,
  avatarText,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('common');

  const initials = avatarText
    ?? (userLabel ?? title).slice(0, 2).toUpperCase();

  const roleKey = role ?? subtitle?.split(' ')[0] ?? '';
  const roleColor = ROLE_COLORS[roleKey] ?? 'bg-zinc-100 text-zinc-600';

  return (
    <aside className="w-[240px] shrink-0 bg-white min-h-screen flex flex-col border-e border-zinc-100">

      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-zinc-100">
        <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-bold tracking-tight">MS</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 leading-tight truncate">{title}</p>
          {subtitle && (
            <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/provider' &&
                    item.href !== '/admin' &&
                    item.href !== '/creator' &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900',
                    )}
                  >
                    {/* Active accent on the inline-start edge */}
                    {isActive && (
                      <span className="absolute inset-s-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/40 rounded-full" />
                    )}

                    <span className={cn(
                      'w-[18px] h-[18px] flex items-center justify-center shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600',
                    )}>
                      {item.icon}
                    </span>

                    <span className="flex-1 leading-none">{item.label}</span>

                    {item.badge != null && (
                      <span className={cn(
                        'text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-zinc-100 text-zinc-500',
                      )}>
                        {item.badge}
                      </span>
                    )}

                    {!isActive && (
                      <ChevronRight className="w-3 h-3 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Language switcher ── */}
      <div className="px-3 pt-3">
        <DashboardLocaleSwitcher />
      </div>

      {/* ── User card ── */}
      <div className="p-3 border-t border-zinc-100">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 transition group">
          {/* Avatar */}
          <div className="h-8 w-8 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">{initials}</span>
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            {userLabel && (
              <p className="text-[12px] font-medium text-zinc-900 leading-tight truncate">{userLabel}</p>
            )}
            {subtitle && (
              <span className={cn(
                'inline-block text-[9px] font-semibold rounded-full px-1.5 py-0.5 leading-tight mt-0.5',
                roleColor,
              )}>
                {subtitle}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            title={t('logout')}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-300 hover:text-zinc-700 hover:bg-zinc-100 transition opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
