import { ZoneInsight } from "@/lib/geoIntelligence";

type Props = {
  zones: ZoneInsight[];
};

export const ZoneIntelligencePanel = ({ zones }: Props) => {
  if (!zones.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        No zone intelligence available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {zones.slice(0, 6).map((zone) => (
        <article
          key={zone.zoneId}
          className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{zone.zoneId}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {zone.devices.length} devices in zone
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                zone.riskLevel === "unsafe"
                  ? "bg-red-500/15 text-red-600 dark:text-red-300"
                  : zone.riskLevel === "moderate"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {zone.riskLevel}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div>Avg safety score: {zone.avgSafetyScore}</div>
            <div>Unsafe devices: {zone.unsafeCount}</div>
          </div>
        </article>
      ))}
    </div>
  );
};
