import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  accentClass?: string;
  className?: string;
}

const DashboardCard = ({
  title,
  value,
  description,
  icon: Icon,
  accentClass = "bg-cyan-100 text-cyan-600",
  className = "",
}: DashboardCardProps) => {
  return (
    <div
      className={`premium-card dashboard-summary-card group relative overflow-hidden rounded-[1.75rem] border border-cyan-200/55 bg-gradient-to-br from-white/96 via-sky-50/92 to-cyan-50/84 p-5 min-h-[12rem] shadow-[0_20px_40px_-18px_rgba(14,165,233,0.18)] backdrop-blur-[14px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-22px_rgba(14,165,233,0.22)] dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_40px_-12px_rgba(2,6,23,0.6)] dark:hover:shadow-[0_30px_60px_-20px_rgba(2,6,23,0.7)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {description}
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 ring-1 ring-cyan-200/80 shadow-[0_10px_24px_rgba(6,182,212,0.12)] dark:bg-white/5 dark:ring-white/6 dark:shadow-md">
          <Icon className={`h-5 w-5 ${accentClass}`} />
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
