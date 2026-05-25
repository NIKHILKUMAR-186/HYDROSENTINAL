/**
 * DeviceDetailPopup.tsx - Beautiful glassmorphic device detail card
 * Shows live water quality data, battery, location, and analytics
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  X,
  MapPin,
  Battery,
  Wifi,
  TrendingUp,
  AlertTriangle,
  Clock,
  Droplet,
  Gauge,
  Thermometer,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceRecord } from "@/lib/deviceStore";
import { determineMarkerStatus } from "@/lib/mapService";

interface DeviceDetailPopupProps {
  device: DeviceRecord;
  latestReading?: {
    ph?: number;
    tds?: number;
    temperature?: number;
    turbidity?: number;
    status?: string;
    timestamp?: string;
  };
  onClose?: () => void;
  onAnalytics?: () => void;
  recentReadings?: Array<{
    timestamp: string;
    tds: number;
  }>;
}

export const DeviceDetailPopup: React.FC<DeviceDetailPopupProps> = ({
  device,
  latestReading,
  onClose,
  onAnalytics,
  recentReadings = [],
}) => {
  const status = useMemo(
    () => determineMarkerStatus(device, latestReading),
    [device, latestReading],
  );

  const statusColor = {
    healthy: { bg: "from-emerald-600 to-emerald-700", text: "text-emerald-400" },
    warning: { bg: "from-amber-600 to-amber-700", text: "text-amber-400" },
    critical: { bg: "from-red-600 to-red-700", text: "text-red-400" },
    offline: { bg: "from-gray-600 to-gray-700", text: "text-gray-400" },
    simulator: { bg: "from-blue-600 to-blue-700", text: "text-blue-400" },
  }[status];

  const tdsSparkline = useMemo(() => {
    if (recentReadings.length < 2) return null;
    const tdsValues = recentReadings.map((r) => r.tds);
    const min = Math.min(...tdsValues);
    const max = Math.max(...tdsValues);
    const range = max - min || 1;

    return tdsValues.map((v) => ({
      height: ((v - min) / range) * 100,
      value: v,
    }));
  }, [recentReadings]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed inset-x-4 bottom-20 md:bottom-auto md:right-4 md:top-24 z-50 w-auto max-w-sm"
    >
      <div
        className={`relative rounded-[1.5rem] backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden bg-gradient-to-br ${statusColor.bg}/10`}
      >
        {/* Animated background gradient */}
        <div
          className={`absolute inset-0 opacity-5 bg-gradient-to-br ${statusColor.bg}`}
        />

        {/* Header */}
        <div className={`relative px-6 py-4 bg-gradient-to-r ${statusColor.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${statusColor.text} animate-pulse`}
                />
                <h3 className="text-lg font-black text-white truncate">
                  {device.name}
                </h3>
              </div>
              <p className="text-xs text-white/80">{device.uniqueId}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "healthy"
                  ? "bg-emerald-400"
                  : status === "warning"
                    ? "bg-amber-400"
                    : status === "critical"
                      ? "bg-red-400"
                      : "bg-gray-400"
              }`}
            />
            <span className="text-xs font-semibold text-white capitalize">
              {status === "offline" ? "Offline" : latestReading?.status || "Unknown"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="relative px-6 py-5 space-y-4">
          {/* Water Quality Grid */}
          {latestReading && (
            <div className="grid grid-cols-2 gap-3">
              {latestReading.ph !== undefined && (
                <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Droplet className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      pH
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {latestReading.ph.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {latestReading.ph >= 6.5 && latestReading.ph <= 8.5
                      ? "Optimal"
                      : "Abnormal"}
                  </p>
                </div>
              )}

              {latestReading.tds !== undefined && (
                <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      TDS
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {latestReading.tds}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">ppm</p>
                </div>
              )}

              {latestReading.turbidity !== undefined && (
                <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      NTU
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {latestReading.turbidity.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Turbidity</p>
                </div>
              )}

              {latestReading.temperature !== undefined && (
                <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Thermometer className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      TEMP
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {latestReading.temperature.toFixed(1)}°
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Celsius</p>
                </div>
              )}
            </div>
          )}

          {/* TDS Sparkline Chart */}
          {tdsSparkline && tdsSparkline.length > 1 && (
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  TDS Trend
                </span>
                <TrendingUp className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="flex items-end gap-1 h-12 bg-white/5 rounded-lg p-2">
                {tdsSparkline.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-cyan-500 to-cyan-300 rounded-t opacity-70 hover:opacity-100 transition"
                    style={{ height: `${Math.max(point.height, 5)}%` }}
                    title={`${point.value} ppm`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Device Info */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
            {device.location && (
              <div className="flex items-start gap-2 col-span-2">
                <MapPin className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-300 font-semibold">Location</p>
                  <p className="text-slate-500 truncate text-[11px]">
                    {device.location}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-yellow-400" />
              <div>
                <p className="text-slate-400">Battery</p>
                <p className="text-white font-semibold">{device.battery ?? 0}%</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-slate-400">Type</p>
                <p className="text-white font-semibold capitalize">
                  {device.deviceType || "Unknown"}
                </p>
              </div>
            </div>

            {latestReading?.timestamp && (
              <div className="flex items-center gap-2 col-span-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-400">Last Update</p>
                  <p className="text-white font-semibold truncate text-[11px]">
                    {new Date(latestReading.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Alert if warning or critical */}
          {(status === "warning" || status === "critical") && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-start gap-2 bg-red-500/10 rounded-lg p-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-red-300">
                  {status === "critical" ? "Critical Status" : "Warning"}
                </p>
                <p className="text-red-200/80 mt-1">
                  Water quality parameters exceed safe thresholds. Immediate action recommended.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="relative px-6 py-4 bg-white/5 border-t border-white/10 flex gap-2">
          {onAnalytics && (
            <Button
              onClick={onAnalytics}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white text-sm"
            >
              View Analytics
            </Button>
          )}
          <Button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white text-sm"
          >
            Close
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
