'use client';

interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
}

export function DashboardHeader({ userName, userRole }: DashboardHeaderProps) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div>
        <h2 className="text-sm text-gray-500">Welcome back</h2>
        <p className="font-semibold text-gray-900">{userName || 'User'}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
          {userRole}
        </span>
      </div>
    </header>
  );
}
