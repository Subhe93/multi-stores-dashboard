import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, trend, trendValue, icon }: StatCardProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
          </div>
          {icon && (
            <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
              {icon}
            </div>
          )}
        </div>
        {(subtitle || trendValue) && (
          <div className="flex items-center gap-1.5 mt-2">
            {trendValue && (
              <span
                className={`text-[11px] font-semibold ${
                  trend === 'up' ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </span>
            )}
            {subtitle && (
              <span className="text-[11px] text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
