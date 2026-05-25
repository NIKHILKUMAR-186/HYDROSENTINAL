import { ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { toIsoTimestamp } from "@/lib/deviceStore";

export const StatusBanner = ({ status, updatedAt, simulatorRunning }: { status?: "SAFE" | "NOT SAFE"; updatedAt?: string; simulatorRunning?: boolean }) => {
  const safe = status === "SAFE";
  const unknown = !status;
  const toneClass = unknown
    ? "border-slate-200/80 bg-gradient-to-br from-white/96 via-slate-50/90 to-sky-50/80 text-slate-950 shadow-[0_22px_60px_-28px_rgba(14,165,233,0.14)] dark:border-slate-600/50 dark:bg-slate-950/70 dark:text-slate-100"
    : safe
    ? "border-emerald-300/60 bg-gradient-to-br from-emerald-50/96 via-white/90 to-sky-50/80 text-slate-950 shadow-[0_22px_60px_-28px_rgba(16,185,129,0.18)] dark:border-emerald-400/30 dark:bg-gradient-to-br dark:from-emerald-500/15 dark:via-emerald-950/55 dark:to-slate-950/80 dark:text-emerald-50 dark:shadow-[0_22px_60px_-28px_rgba(16,185,129,0.45)]"
    : "border-amber-300/60 bg-gradient-to-br from-amber-50/96 via-white/90 to-orange-50/80 text-slate-950 shadow-[0_22px_60px_-28px_rgba(245,158,11,0.16)] dark:border-amber-400/30 dark:bg-gradient-to-br dark:from-amber-500/15 dark:via-amber-950/55 dark:to-slate-950/80 dark:text-amber-50 dark:shadow-[0_22px_60px_-28px_rgba(245,158,11,0.35)]";

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border p-5 sm:p-5 backdrop-blur-xl transition-all duration-300 ${toneClass}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.8),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.08),transparent_28%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/40 bg-white/80 shadow-[0_10px_25px_rgba(14,165,233,0.12)] backdrop-blur ${
              !unknown ? "animate-pulse-glow" : ""
            } ${safe ? "bg-emerald-500/10" : !unknown ? "bg-amber-500/10" : ""} dark:border-white/10 dark:bg-white/8 dark:shadow-[0_10px_25px_rgba(0,0,0,0.2)]`}
          >
            {unknown ? (
              <ShieldAlert className="h-7 w-7 text-slate-500 dark:text-slate-300" />
            ) : safe ? (
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-7 w-7 text-rose-400" />
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300/80">Current water status</p>
            <h2 className={`mt-2 text-4xl font-black tracking-[-0.03em] sm:text-5xl ${unknown ? "text-slate-950 dark:text-white" : safe ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
              {unknown ? "Awaiting data" : safe ? "Safe" : "Not Safe"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300/90">
              {unknown
                ? "Live readings will populate this status as soon as the selected device reports fresh values."
                : safe
                ? "All monitored parameters are currently within the safe operating range."
                : "One or more readings have crossed the safe range and need attention."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end lg:gap-4">
          {!unknown && (
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                safe
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
              }`}
            >
                <span className={`h-2 w-2 rounded-full ${safe ? "bg-emerald-500 dark:bg-emerald-300" : "bg-amber-500 dark:bg-amber-300"}`} />
              Live
            </span>
          )}
          {updatedAt && (
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-right text-xs text-slate-700 shadow-[0_10px_24px_rgba(14,165,233,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:shadow-inner dark:shadow-black/10">
                <p className="uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Last reading</p>
                <p className="mt-1 font-semibold text-slate-950 dark:text-white">{(() => {
                const iso = toIsoTimestamp(updatedAt);
                return iso ? new Date(iso).toLocaleTimeString() : String(updatedAt);
              })()}</p>
            </div>
          )}
          {simulatorRunning !== undefined && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-[0_10px_24px_rgba(14,165,233,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-inner dark:shadow-black/10">
                <Activity className={`h-4 w-4 ${simulatorRunning ? "text-emerald-500 animate-pulse dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`} />
                <span className="font-medium capitalize">{simulatorRunning ? "Simulator Running" : "Simulator Paused"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
