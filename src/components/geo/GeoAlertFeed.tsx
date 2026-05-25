type AlertItem = {
  id: string;
  deviceId: string;
  message: string;
  status: "safe" | "moderate" | "unsafe";
  timestamp: string;
};

type Props = {
  alerts: AlertItem[];
};

import { toIsoTimestamp } from '@/lib/deviceStore';

export const GeoAlertFeed = ({ alerts }: Props) => {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <h4 className="text-sm font-semibold text-slate-950 dark:text-white">Geo Alert Feed</h4>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">No active geo alerts.</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                alert.status === "unsafe"
                  ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200"
                  : alert.status === "moderate"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              }`}
            >
              <p className="font-semibold">{alert.message}</p>
                <p className="mt-1 opacity-80">
                {alert.deviceId} - {(() => {
                  const iso = toIsoTimestamp(alert.timestamp);
                  return iso ? new Date(iso).toLocaleTimeString() : String(alert.timestamp);
                })()}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
