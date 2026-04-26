'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { custom_product_id?: string; reason?: string; [key: string]: any } | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  data: Notification[];
  unread_count: number;
}

const POLL_INTERVAL_MS = 60_000;

/** Map a notification type → relative dashboard path. Returns null if no navigation. */
function notificationHref(role: string, n: Notification): string | null {
  const id = n.data?.custom_product_id;
  if (!id) return null;

  switch (n.type) {
    case 'CUSTOM_PRODUCT_SUBMITTED':
    case 'CUSTOM_PRODUCT_RESUBMITTED':
      return role === 'PROVIDER' ? `/provider/reviews/${id}` : null;
    case 'CUSTOM_PRODUCT_APPROVED':
    case 'CUSTOM_PRODUCT_REJECTED':
      return role === 'CREATOR' ? `/creator/custom-products/${id}` : null;
    default:
      return null;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ role }: { role: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api<NotificationsResponse>('/notifications?limit=10', { token });
      setItems(res?.data || []);
      setUnread(res?.unread_count || 0);
    } catch {
      // silent
    }
  }, [token]);

  // Initial fetch + polling
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, fetchNotifications]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((v) => !v);
    if (!open) fetchNotifications();
  };

  const handleClickItem = async (n: Notification) => {
    setOpen(false);
    if (!n.is_read && token) {
      try { await api(`/notifications/${n.id}/read`, { method: 'PUT', token }); } catch {}
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread((u) => Math.max(0, u - 1));
    }
    const href = notificationHref(role, n);
    if (href) router.push(href);
  };

  const handleMarkAllRead = async () => {
    if (!token || unread === 0) return;
    setLoading(true);
    try {
      await api('/notifications/read-all', { method: 'PUT', token });
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnread(0);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-zinc-200 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-zinc-400">
                No notifications yet
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickItem(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50 transition-colors text-left ${
                    !n.is_read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  {!n.is_read && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${!n.is_read ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}