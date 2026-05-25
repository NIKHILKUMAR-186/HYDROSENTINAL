import { Droplet, Gauge, Thermometer, Waves, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { get3DCardVariants } from "@/hooks/useAnimationUtils";

type Props = {
  label: string;
  value: number | undefined;
  unit: string;
  icon: "ph" | "tds" | "turbidity" | "temperature";
  safeRange: string;
  alert?: boolean;
  sparkline?: number[];
};

const ICONS: Record<Props["icon"], LucideIcon> = {
  ph: Droplet,
  tds: Gauge,
  turbidity: Waves,
  temperature: Thermometer,
};

export const SensorCard = ({ label, value, unit, icon, safeRange, alert, sparkline }: Props) => {
  const Icon = ICONS[icon];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const ranges: Record<Props['icon'], { min: number; max: number }> = {
    ph: { min: 0, max: 14 },
    tds: { min: 0, max: 1500 },
    turbidity: { min: 0, max: 500 },
    temperature: { min: -10, max: 50 },
  };

  const percent = (() => {
    if (value === undefined || value === null) return 0;
    const { min, max } = ranges[icon];
    return clamp((value - min) / (max - min), 0, 1);
  })();

  const gaugeColor = alert ? '#f97316' : '#22c55e';
  const statusTone = alert
    ? "border-amber-300/60 bg-gradient-to-br from-amber-50/96 via-white/90 to-orange-50/80 shadow-[0_22px_60px_-28px_rgba(245,158,11,0.16)] dark:border-amber-400/30 dark:bg-gradient-to-br dark:from-amber-500/10 dark:via-slate-950/70 dark:to-slate-950/85 dark:shadow-[0_22px_60px_-28px_rgba(245,158,11,0.28)]"
    : "border-cyan-200/60 bg-gradient-to-br from-white/95 via-sky-50/90 to-cyan-50/82 shadow-[0_20px_45px_-24px_rgba(14,165,233,0.18)] dark:border-emerald-400/20 dark:bg-gradient-to-br dark:from-emerald-500/10 dark:via-slate-950/70 dark:to-slate-950/85 dark:shadow-[0_22px_60px_-28px_rgba(34,197,94,0.24)]";
  return (
    <motion.div
      whileHover="hover"
      initial="initial"
      variants={get3DCardVariants()}
      className={`sensor-card group relative flex h-full min-h-[13rem] flex-col overflow-hidden rounded-[1.75rem] border p-2 transition-all duration-300 ease-out backdrop-blur-xl hover:-translate-y-1 hover:shadow-[0_30px_65px_-28px_rgba(14,165,233,0.22)] ${statusTone}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.08),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.08),transparent_30%)]" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[20px] uppercase text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-xsm  tracking-[-0.03em] text-slate-950 tabular-nums sm:text-6xl dark:text-white">
            {value !== undefined ? value.toFixed(icon === "ph" ? 2 : 1) : "—"}
            <span className="ml-2 text-base font-semibold text-slate-600 dark:text-slate-300">{unit}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/70 bg-white/80 shadow-[0_10px_24px_rgba(14,165,233,0.12)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle cx="22" cy="22" r="18" stroke="rgba(148,163,184,0.18)" strokeWidth="6" fill="none" className="dark:stroke-[rgba(255,255,255,0.12)]" />
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke={gaugeColor}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={Math.PI * 2 * 18}
                strokeDashoffset={Math.PI * 2 * 18 * (1 - percent)}
                style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1), stroke 300ms linear' }}
                transform="rotate(-90 22 22)"
              />
              <text x="22" y="26" fontSize="11" textAnchor="middle" fill="#939292"  style={{ fontWeight: 700 }}>{value !== undefined ? (icon === 'ph' ? value.toFixed(1) : Math.round(value)) : '—'}</text>
            </svg>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-[0_10px_24px_rgba(6,182,212,0.12)] ${
              alert ? "border-amber-300/40 bg-amber-500/10 text-amber-500 dark:text-amber-300" : "border-emerald-300/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-4 pt-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Safe range</p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{safeRange}</p>
        </div>
        <div className="h-6 w-24 opacity-90 transition-opacity duration-300 group-hover:opacity-100">
          {sparkline && sparkline.length > 0 ? (
            (() => {
              const spark = sparkline;
              const max = Math.max(...spark);
              const min = Math.min(...spark);
              const range = max - min || 1;
              const points = spark
                .slice(-10)
                .map((v, i) => `${(i / 9) * 100},${100 - ((v - min) / range) * 100}`)
                .join(" ");

              return (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <polyline
                    points={points}
                    fill="none"
                    stroke={alert ? "#fbbf24" : "#22d3ee"}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="motion-safe:animate-pulse drop-shadow-[0_0_12px_rgba(34,211,238,0.18)] dark:drop-shadow-[0_0_12px_rgba(34,211,238,0.18)]"
                    style={{ animationDuration: "4s" }}
                  />
                </svg>
              );
            })()
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};
