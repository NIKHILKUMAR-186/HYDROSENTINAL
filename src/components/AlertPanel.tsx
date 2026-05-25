import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toIsoTimestamp } from "@/lib/deviceStore";
import {
  AlertLevel,
  WaterAlert,
  WATER_THRESHOLDS,
} from "@/services/alertService";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Brain,
  CheckCircle2,
  Clock,
  DownloadCloud,
  Eye,
  FileBarChart2,
  Filter,
  ChartLine,
  RefreshCw,
  Siren,
  ShieldCheck,
  Target,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";

interface AlertPanelProps {
  alerts: WaterAlert[];
  currentLevel: AlertLevel | null;
  isLoading?: boolean;
  onViewAlert?: (alert: WaterAlert) => void;
  onAcknowledgeAlert?: (id: string) => void;
  onResolveAlert?: (id: string) => void;
}

type TimeWindow = "hour" | "day" | "week";
type HistoryFilter = "today" | "7d" | "30d" | "critical" | "warning" | "resolved" | "all";

type ChartState = {
  label: string;
  value: number;
  tone: string;
};

const formatTime = (timestampValue: unknown): string => {
  const iso = toIsoTimestamp(timestampValue);
  const date = iso
    ? new Date(iso)
    : typeof timestampValue === "number"
      ? new Date(timestampValue)
      : new Date(String(timestampValue));

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatDateTime = (timestampValue: unknown): string => {
  const iso = toIsoTimestamp(timestampValue);
  const date = iso
    ? new Date(iso)
    : typeof timestampValue === "number"
      ? new Date(timestampValue)
      : new Date(String(timestampValue));

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getSeverityTone = (level: AlertLevel): string => {
  switch (level) {
    case AlertLevel.DANGER:
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
    case AlertLevel.WARNING:
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    default:
      return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
  }
};

const getAlertLabel = (level: AlertLevel): string => {
  switch (level) {
    case AlertLevel.DANGER:
      return "Critical";
    case AlertLevel.WARNING:
      return "Warning";
    default:
      return "Info";
  }
};

const getIntervalMinutes = (window: TimeWindow): number => {
  switch (window) {
    case "hour":
      return 10;
    case "day":
      return 240;
    case "week":
      return 24 * 60;
  }
};

const getWindowLabel = (window: TimeWindow): string => {
  switch (window) {
    case "hour":
      return "Last hour";
    case "day":
      return "Last day";
    case "week":
      return "Last week";
  }
};

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  currentLevel,
  isLoading = false,
  onViewAlert,
  onAcknowledgeAlert,
  onResolveAlert,
}) => {
  const [selectedWindow, setSelectedWindow] = useState<TimeWindow>("day");
  const [selectedHistoryFilter, setSelectedHistoryFilter] = useState<HistoryFilter>("today");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [incidentStart, setIncidentStart] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => b.timestamp - a.timestamp),
    [alerts],
  );

  const latestAlert = sortedAlerts[0] ?? null;
  const previousAlert = sortedAlerts[1] ?? null;

  const now = Date.now();
  const alertTimeline = useMemo(() => {
    const baseTimeline = sortedAlerts.slice(0, 6).map((alert, index) => {
      const ageMinutes = Math.max(0, Math.round((now - alert.timestamp) / 60000));
      const lifecycle =
        alert.level === AlertLevel.DANGER
          ? "Critical escalation"
          : alert.level === AlertLevel.WARNING
            ? "Operator warning"
            : "Telemetry update";

      return {
        id: alert.id,
        time: formatTime(alert.timestamp),
        title: alert.message,
        detail: lifecycle,
        ageMinutes,
        level: alert.level,
        emphasis: index === 0,
      };
    });

    if (baseTimeline.length === 0) {
      return [
        {
          id: "system-normal",
          time: "Now",
          title: "System normal",
          detail: "No active alert telemetry in the selected window.",
          ageMinutes: 0,
          level: AlertLevel.SAFE,
          emphasis: true,
        },
      ];
    }

    return baseTimeline;
  }, [sortedAlerts, now]);

  const activeAlerts = useMemo(
    () => sortedAlerts.filter((alert) => alert.level === AlertLevel.DANGER || alert.level === AlertLevel.WARNING),
    [sortedAlerts],
  );

  const criticalAlerts = useMemo(
    () => sortedAlerts.filter((alert) => alert.level === AlertLevel.DANGER),
    [sortedAlerts],
  );

  const warningAlerts = useMemo(
    () => sortedAlerts.filter((alert) => alert.level === AlertLevel.WARNING),
    [sortedAlerts],
  );

  const resolvedAlerts = useMemo(
    () => sortedAlerts.filter((alert) => now - alert.timestamp > 2 * 60 * 60 * 1000),
    [sortedAlerts, now],
  );

  const infoAlerts = useMemo(
    () => sortedAlerts.filter((alert) => now - alert.timestamp <= 2 * 60 * 60 * 1000 && alert.level === AlertLevel.WARNING),
    [sortedAlerts, now],
  );

  const systemState = useMemo(() => {
    if (currentLevel === AlertLevel.DANGER || criticalAlerts.length > 0) {
      return "Critical Response";
    }
    if (currentLevel === AlertLevel.WARNING || warningAlerts.length > 0) {
      return "Monitoring";
    }
    return "Stable";
  }, [currentLevel, criticalAlerts.length, warningAlerts.length]);

  const emergencyMode = systemState === "Critical Response";

  useEffect(() => {
    if (emergencyMode && incidentStart === null) {
      setIncidentStart(Date.now());
    }
    if (!emergencyMode && incidentStart !== null) {
      setIncidentStart(null);
    }
  }, [emergencyMode, incidentStart]);

  useEffect(() => {
    if (!emergencyMode && !incidentStart) {
      return;
    }

    const interval = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [emergencyMode, incidentStart]);

  useEffect(() => {
    if (!selectedAlertId && latestAlert) {
      setSelectedAlertId(latestAlert.id);
    }
  }, [latestAlert, selectedAlertId]);

  const incidentElapsed = useMemo(() => {
    if (!incidentStart) {
      return "00:00";
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - incidentStart) / 1000));
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [incidentStart, clockTick, emergencyMode]);

  const selectedAlert = useMemo(
    () => sortedAlerts.find((alert) => alert.id === selectedAlertId) ?? latestAlert,
    [sortedAlerts, selectedAlertId, latestAlert],
  );

  const selectedAlertIsAcknowledged =
    selectedAlert ? acknowledgedIds.includes(selectedAlert.id) : false;
  const selectedAlertIsResolved = selectedAlert
    ? resolvedIds.includes(selectedAlert.id)
    : false;

  const filteredAlerts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return sortedAlerts.filter((alert) => {
      const timestampAge = now - alert.timestamp;
      const dayMs = 24 * 60 * 60 * 1000;
      const weekMs = 7 * dayMs;

      const matchesWindow =
        selectedHistoryFilter === "all"
          ? true
          : selectedHistoryFilter === "today"
            ? timestampAge <= dayMs
            : selectedHistoryFilter === "7d"
              ? timestampAge <= weekMs
              : selectedHistoryFilter === "30d"
                ? timestampAge <= 30 * dayMs
                : selectedHistoryFilter === "critical"
                  ? alert.level === AlertLevel.DANGER
                  : selectedHistoryFilter === "warning"
                    ? alert.level === AlertLevel.WARNING
                    : selectedHistoryFilter === "resolved"
                      ? timestampAge > 2 * 60 * 60 * 1000
                      : true;

      if (!matchesWindow) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        alert.message,
        alert.deviceId,
        getAlertLabel(alert.level),
        alert.sentSMS ? "sms sent" : "sms pending",
        formatDateTime(alert.timestamp),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [sortedAlerts, now, selectedHistoryFilter, searchTerm]);

  const filteredCriticalCount = filteredAlerts.filter((alert) => alert.level === AlertLevel.DANGER).length;
  const filteredWarningCount = filteredAlerts.filter((alert) => alert.level === AlertLevel.WARNING).length;
  const filteredResolvedCount = filteredAlerts.filter((alert) => now - alert.timestamp > 2 * 60 * 60 * 1000).length;
  const filteredInfoCount = Math.max(0, filteredAlerts.length - filteredCriticalCount - filteredWarningCount - filteredResolvedCount);

  const affectedSensors = useMemo(() => {
    const counts = new Map<string, number>();

    sortedAlerts.forEach((alert) => {
      const reading = alert.readings || {};
      const pairs: Array<[string, number | undefined]> = [
        ["pH", reading.ph],
        ["TDS", reading.tds],
        ["Turbidity", reading.turbidity],
      ];

      pairs.forEach(([sensor, value]) => {
        if (value !== undefined) {
          counts.set(sensor, (counts.get(sensor) ?? 0) + 1);
        }
      });
    });

    return Array.from(counts.entries())
      .map(([sensor, count]) => ({ sensor, count }))
      .sort((a, b) => b.count - a.count);
  }, [sortedAlerts]);

  const latestReading = latestAlert?.readings ?? {};

  const rootCause = useMemo(() => {
    if (!latestAlert) {
      return {
        cause: "No active anomaly detected",
        confidence: 0,
        impact: "Low",
        affected: ["System"],
        issue: "Stable telemetry",
        recommendation: "Continue live monitoring and baseline checks.",
      };
    }

    const tds = latestReading.tds;
    const ph = latestReading.ph;
    const turbidity = latestReading.turbidity;
    const issueList: string[] = [];

    if (typeof tds === "number" && tds > WATER_THRESHOLDS.TDS.danger) {
      issueList.push(`TDS peaked at ${tds} ppm`);
    }
    if (typeof ph === "number" && (ph < WATER_THRESHOLDS.pH.min_safe || ph > WATER_THRESHOLDS.pH.max_safe)) {
      issueList.push(`pH drifted to ${ph.toFixed(2)}`);
    }
    if (typeof turbidity === "number" && turbidity > WATER_THRESHOLDS.TURBIDITY.danger) {
      issueList.push(`Turbidity reached ${turbidity} NTU`);
    }

    if (typeof tds === "number" && tds > WATER_THRESHOLDS.TDS.danger) {
      return {
        cause: "Possible filter clogging or media breakthrough",
        confidence: Math.min(96, 78 + issueList.length * 6),
        impact: "High",
        affected: ["TDS sensor", "Filtration line"],
        issue: `High TDS detected (${tds} ppm)`,
        recommendation: "Inspect filter cartridge and verify inlet water quality.",
      };
    }

    if (typeof ph === "number" && (ph < WATER_THRESHOLDS.pH.min_safe || ph > WATER_THRESHOLDS.pH.max_safe)) {
      return {
        cause: "Chemical dosing imbalance or calibration drift",
        confidence: Math.min(95, 74 + issueList.length * 7),
        impact: "Moderate",
        affected: ["pH sensor", "Dosing system"],
        issue: `pH outside safe window (${ph.toFixed(2)})`,
        recommendation: "Run calibration cycle and validate dosing response.",
      };
    }

    if (typeof turbidity === "number" && turbidity > WATER_THRESHOLDS.TURBIDITY.warning) {
      return {
        cause: "Sediment ingress or pre-filter bypass",
        confidence: Math.min(93, 70 + issueList.length * 7),
        impact: turbidity > WATER_THRESHOLDS.TURBIDITY.danger ? "High" : "Moderate",
        affected: ["Turbidity sensor", "Pre-filter stage"],
        issue: `Elevated turbidity (${turbidity} NTU)`,
        recommendation: "Check pre-filtration and retest after flush cycle.",
      };
    }

    return {
      cause: latestAlert.message,
      confidence: 68,
      impact: emergencyMode ? "Moderate" : "Low",
      affected: ["Water line"],
      issue: "Threshold breach under review",
      recommendation: "Inspect the device and confirm the next reading trend.",
    };
  }, [latestAlert, latestReading, emergencyMode]);

  const actionPlan = useMemo(() => {
    const base = [
      { label: "Inspect filter cartridge", priority: "P1" },
      { label: "Verify inlet water quality", priority: "P1" },
      { label: "Run calibration cycle", priority: "P2" },
      { label: "Monitor next 10 readings", priority: "P2" },
      { label: "Re-test after maintenance", priority: "P3" },
    ];

    if (emergencyMode) {
      return base;
    }

    return base.map((item, index) => ({
      ...item,
      priority: index < 2 ? "P2" : item.priority,
    }));
  }, [emergencyMode]);

  const severitySeries: ChartState[] = useMemo(
    () => [
      { label: "Critical", value: filteredCriticalCount, tone: "from-rose-500 to-rose-400" },
      { label: "Warning", value: filteredWarningCount, tone: "from-amber-500 to-amber-300" },
      { label: "Info", value: filteredInfoCount, tone: "from-sky-500 to-cyan-300" },
      { label: "Resolved", value: filteredResolvedCount, tone: "from-emerald-500 to-emerald-300" },
    ],
    [filteredCriticalCount, filteredWarningCount, filteredInfoCount, filteredResolvedCount],
  );

  const donutSegments = useMemo(() => {
    const total = severitySeries.reduce((sum, item) => sum + item.value, 0) || 1;
    let cursor = 0;

    return severitySeries.map((item) => {
      const size = (item.value / total) * 100;
      const start = cursor;
      cursor += size;
      return {
        ...item,
        start,
        end: cursor,
      };
    });
  }, [severitySeries]);

  const donutGradient = donutSegments
    .map((segment) => {
      const color =
        segment.label === "Critical"
          ? "rgba(244,63,94,0.95)"
          : segment.label === "Warning"
            ? "rgba(245,158,11,0.95)"
            : segment.label === "Info"
              ? "rgba(56,189,248,0.95)"
              : "rgba(16,185,129,0.95)";
      return `${color} ${segment.start}% ${segment.end}%`;
    })
    .join(", ");

  const trendSeries = useMemo(() => {
    const intervalMinutes = getIntervalMinutes(selectedWindow);
    const bucketCount = selectedWindow === "week" ? 7 : 6;
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      label: `${index + 1}`,
      value: 0,
    }));
    const windowMs = intervalMinutes * bucketCount * 60 * 1000;

    sortedAlerts.forEach((alert) => {
      const age = now - alert.timestamp;
      if (age > windowMs) {
        return;
      }

      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor(age / (intervalMinutes * 60 * 1000)),
      );
      const targetIndex = bucketCount - 1 - bucketIndex;
      buckets[targetIndex].value += 1;
    });

    return buckets.map((bucket, index) => ({
      ...bucket,
      label:
        selectedWindow === "hour"
          ? `${(index + 1) * 10}m`
          : selectedWindow === "day"
            ? `${(index + 1) * 4}h`
            : `${index + 1}d`,
    }));
  }, [sortedAlerts, selectedWindow, now]);

  const prediction = useMemo(() => {
    const latestCritical = latestAlert?.level === AlertLevel.DANGER;
    const trendUp =
      previousAlert && latestAlert && latestAlert.timestamp > previousAlert.timestamp;
    const confidence = latestCritical ? 84 : warningAlerts.length > 0 ? 72 : 48;

    let forecast24h = "Moderate";
    let forecast48h = "Moderate";
    let predictedIssue = "Stable filtration trend";

    if (latestCritical) {
      forecast24h = "High";
      forecast48h = "Critical";
      predictedIssue = "Filter efficiency drop";
    } else if (warningAlerts.length > 0 && trendUp) {
      forecast24h = "Moderate";
      forecast48h = "High";
      predictedIssue = "Sensor drift or dosing lag";
    } else if (rootCause.cause.includes("TDS")) {
      forecast24h = "Moderate";
      forecast48h = "High";
      predictedIssue = "Particulate loading increase";
    }

    return {
      forecast24h,
      forecast48h,
      probability: confidence,
      predictedIssue,
      gauge: latestCritical ? 84 : warningAlerts.length > 2 ? 68 : 42,
    };
  }, [latestAlert, previousAlert, warningAlerts.length, rootCause.cause]);

  const smartInsights = useMemo(() => {
    const latestTds = latestReading.tds;
    const previousTds = previousAlert?.readings?.tds;
    const latestPh = latestReading.ph;
    const previousPh = previousAlert?.readings?.ph;
    const latestTurbidity = latestReading.turbidity;
    const previousTurbidity = previousAlert?.readings?.turbidity;

    return [
      {
        title:
          typeof latestTds === "number" && typeof previousTds === "number"
            ? latestTds >= previousTds
              ? `TDS increased ${Math.round(((latestTds - previousTds) / Math.max(previousTds, 1)) * 100)}% compared to previous reading`
              : `TDS eased by ${Math.abs(Math.round(((latestTds - previousTds) / Math.max(previousTds, 1)) * 100))}%`
            : "TDS telemetry remains under review",
        trend:
          typeof latestTds === "number" && typeof previousTds === "number"
            ? latestTds >= previousTds
              ? "up"
              : "down"
            : "flat",
      },
      {
        title:
          typeof latestPh === "number"
            ? latestPh < WATER_THRESHOLDS.pH.min_safe
              ? "pH approaching lower threshold"
              : latestPh > WATER_THRESHOLDS.pH.max_safe
                ? "pH above safe window"
                : "pH is inside the safe operating envelope"
            : "pH telemetry stable",
        trend:
          typeof latestPh === "number"
            ? latestPh < WATER_THRESHOLDS.pH.min_safe || latestPh > WATER_THRESHOLDS.pH.max_safe
              ? "up"
              : "down"
            : "flat",
      },
      {
        title:
          typeof latestTurbidity === "number" && typeof previousTurbidity === "number"
            ? latestTurbidity <= previousTurbidity
              ? "Turbidity improving"
              : "Turbidity trending upward"
            : "Turbidity stable",
        trend:
          typeof latestTurbidity === "number" && typeof previousTurbidity === "number"
            ? latestTurbidity <= previousTurbidity
              ? "down"
              : "up"
            : "flat",
      },
      {
        title:
          emergencyMode
            ? "Emergency response mode is active"
            : "System response remains within operating tolerance",
        trend: emergencyMode ? "up" : "down",
      },
    ];
  }, [latestReading, previousAlert, emergencyMode]);

  const buildExportCsv = () => {
    const rows = [
      ["Time", "Device", "Alert", "Severity", "Status", "Resolution"],
      ...filteredAlerts.map((alert) => {
        const status = resolvedIds.includes(alert.id)
          ? "Resolved"
          : acknowledgedIds.includes(alert.id)
            ? "Acknowledged"
            : alert.level === AlertLevel.DANGER
              ? "Active"
              : "Open";
        const resolution = resolvedIds.includes(alert.id)
          ? "Closed by operator"
          : acknowledgedIds.includes(alert.id)
            ? "In review"
            : "Pending";
        return [
          formatDateTime(alert.timestamp),
          alert.deviceId,
          alert.message,
          getAlertLabel(alert.level),
          status,
          resolution,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alert-history-${selectedHistoryFilter}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleAcknowledge = (alert: WaterAlert) => {
    setSelectedAlertId(alert.id);
    setAcknowledgedIds((current) =>
      current.includes(alert.id)
        ? current.filter((id) => id !== alert.id)
        : [...current, alert.id],
    );
    onAcknowledgeAlert?.(alert.id);
  };

  const toggleResolve = (alert: WaterAlert) => {
    setSelectedAlertId(alert.id);
    setResolvedIds((current) =>
      current.includes(alert.id)
        ? current.filter((id) => id !== alert.id)
        : [...current, alert.id],
    );
    onResolveAlert?.(alert.id);
  };

  const severityDonut = `conic-gradient(${donutGradient})`;
  const confidenceRing = `conic-gradient(rgba(34,211,238,0.98) ${rootCause.confidence}%, rgba(15,23,42,0.65) 0)`;
  const predictionRing = `conic-gradient(rgba(251,113,133,0.95) ${prediction.gauge}%, rgba(15,23,42,0.65) 0)`;
  const recoveryProgress = emergencyMode
    ? Math.min(92, (resolvedAlerts.length * 18) + (infoAlerts.length * 8) + 10)
    : 100;

  const activeAlertCount = emergencyMode ? Math.max(1, activeAlerts.length) : activeAlerts.length;
  const criticalCount = criticalAlerts.length;
  const warningCount = warningAlerts.length;
  const resolvedCount = Math.max(resolvedAlerts.length, !emergencyMode ? sortedAlerts.length : resolvedAlerts.length);

  return (
    <div className="space-y-4 text-slate-100">
      {emergencyMode && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-rose-950/35 p-4 shadow-[0_20px_70px_-28px_rgba(244,63,94,0.65)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.28),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(251,113,133,0.16),transparent_28%)]" />
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-rose-400/40 bg-rose-500/15 p-3 text-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.2)]">
                <Siren className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200/90">
                  Emergency Response Mode
                </p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">
                  Critical water quality event in progress
                </h3>
                <p className="mt-1 text-sm text-rose-100/80">
                  AI is isolating root cause, prioritizing actions, and tracking recovery progress.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/65">Incident Timer</p>
                <p className="mt-1 text-lg font-black text-white">{incidentElapsed}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/65">System</p>
                <p className="mt-1 text-sm font-semibold text-rose-200">Escalated</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/65">Recovery</p>
                <p className="mt-1 text-sm font-semibold text-white">{recoveryProgress}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/65">Priority</p>
                <p className="mt-1 text-sm font-semibold text-rose-200">Immediate</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <section className="space-y-4 rounded-3xl border border-slate-800/90 bg-slate-950/70 p-4 shadow-[0_24px_70px_-40px_rgba(2,6,23,0.95)] backdrop-blur-xl sm:p-5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_left,rgba(244,63,94,0.08),transparent_26%)]" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Alert Command Header
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  Water Monitoring Command Center
                </h2>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${emergencyMode ? "border-rose-500/40 bg-rose-500/15 text-rose-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>
                  {systemState}
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Live incident triage, AI root cause analysis, and operator response controls for industrial water quality monitoring.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[36rem]">
              {[
                { label: "Active Alerts", value: activeAlertCount, tone: "emerald" },
                { label: "Critical Alerts", value: criticalCount, tone: "rose" },
                { label: "Warning Alerts", value: warningCount, tone: "amber" },
                { label: "Resolved Alerts", value: resolvedCount, tone: "sky" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-800/80 bg-slate-900/75 px-3 py-3 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.9)]">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{metric.label}</p>
                  <p className={`mt-1 text-3xl font-black ${metric.tone === "emerald" ? "text-emerald-300" : metric.tone === "rose" ? "text-rose-300" : metric.tone === "amber" ? "text-amber-300" : "text-sky-300"}`}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Last Alert Time", value: latestAlert ? formatDateTime(latestAlert.timestamp) : "--" },
              { label: "Last Device Triggered", value: latestAlert?.deviceId ?? "--" },
              { label: "Current System State", value: systemState },
              { label: "Latest Severity", value: latestAlert ? getAlertLabel(latestAlert.level) : "None" },
              { label: "Alert Volume", value: `${sortedAlerts.length} events` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800/75 bg-white/5 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Live Incident Timeline
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Command center event log</h3>
                </div>
                <Clock className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="mt-4 space-y-3">
                {alertTimeline.map((event, index) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="flex w-20 shrink-0 flex-col items-end pt-0.5 text-right">
                      <span className="text-xs font-semibold text-slate-300">{event.time}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{event.ageMinutes ? `${event.ageMinutes}m ago` : "now"}</span>
                    </div>
                    <div className="relative flex-1 pb-3 pl-4">
                      <div className="absolute left-0 top-1.5 h-full w-px bg-slate-700/80" />
                      <div className={`absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full ${event.level === AlertLevel.DANGER ? "bg-rose-400" : event.level === AlertLevel.WARNING ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <div className={`rounded-2xl border p-3 ${event.emphasis ? "bg-white/8 border-slate-700/80" : "bg-white/4 border-slate-800/80"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{event.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{event.detail}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${event.level === AlertLevel.DANGER ? "border-rose-500/30 bg-rose-500/12 text-rose-200" : event.level === AlertLevel.WARNING ? "border-amber-500/30 bg-amber-500/12 text-amber-200" : "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"}`}>
                            {getAlertLabel(event.level)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    AI Root Cause Analysis
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Likely cause and impact</h3>
                </div>
                <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-200">
                  <Brain className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_13rem]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Cause</p>
                    <p className="mt-2 text-base font-semibold text-white">{rootCause.cause}</p>
                    <p className="mt-2 text-sm text-slate-400">{rootCause.issue}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Confidence</p>
                      <p className="mt-2 text-xl font-black text-white">{rootCause.confidence}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Impact</p>
                      <p className="mt-2 text-xl font-black text-white">{rootCause.impact}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Affected</p>
                      <p className="mt-2 text-sm font-semibold text-white">{rootCause.affected.join(", ")}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative h-44 w-44 rounded-full border border-slate-800/80 bg-slate-950/80 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
                    <div className="absolute inset-4 rounded-full" style={{ background: confidenceRing }} />
                    <div className="absolute inset-8 rounded-full border border-slate-800/80 bg-slate-950/95" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Confidence</p>
                      <p className="mt-1 text-4xl font-black text-white">{rootCause.confidence}</p>
                      <p className="text-xs text-slate-400">AI certainty</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Recommended Action Plan
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Priority response checklist</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  {emergencyMode ? "Immediate" : "Standard"}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {actionPlan.map((item, index) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${index < 2 ? "bg-rose-500/20 text-rose-200" : "bg-emerald-500/15 text-emerald-200"}`}>
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-white">{item.label}</span>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${item.priority === "P1" ? "border-rose-500/30 bg-rose-500/12 text-rose-200" : item.priority === "P2" ? "border-amber-500/30 bg-amber-500/12 text-amber-200" : "border-slate-600 bg-slate-800/60 text-slate-300"}`}>
                      {item.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Alert Feed
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Live scrolling alerts</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={buildExportCsv}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
                  >
                    <DownloadCloud className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[1.2fr_auto_auto_auto]">
                <div className="rounded-2xl border border-slate-800/80 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Filter className="h-4 w-4" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search alerts, devices, or severity"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <select
                  value={selectedHistoryFilter}
                  onChange={(event) => setSelectedHistoryFilter(event.target.value as HistoryFilter)}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="today">Today</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
                <button
                  type="button"
                  onClick={buildExportCsv}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-200"
                >
                  Export
                </button>
                <div className="flex items-center justify-end gap-2 text-xs text-slate-400 sm:justify-start">
                  <span className="rounded-full border border-slate-700/80 bg-white/5 px-2 py-1">{filteredAlerts.length} results</span>
                </div>
              </div>

              <div className="mt-4 max-h-[26rem] space-y-3 overflow-auto pr-1">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-800/60" />
                    ))}
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 text-sm text-slate-400">
                    No alerts match the current search and filter window.
                  </div>
                ) : (
                  filteredAlerts.map((alert) => {
                    const status = resolvedIds.includes(alert.id)
                      ? "Resolved"
                      : acknowledgedIds.includes(alert.id)
                        ? "Acknowledged"
                        : alert.level === AlertLevel.DANGER
                          ? "Active"
                          : "Open";

                    return (
                      <div
                        key={alert.id}
                        className={`rounded-2xl border p-4 transition ${selectedAlertId === alert.id ? "border-cyan-500/40 bg-cyan-500/8" : "border-slate-800/80 bg-white/5"}`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getSeverityTone(alert.level)}`}>
                                {getAlertLabel(alert.level)}
                              </span>
                              <span className="rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                                {status}
                              </span>
                              {alert.sentSMS && (
                                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                  SMS sent
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-white">{alert.message}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Bell className="h-3.5 w-3.5" />
                                {alert.deviceId}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDateTime(alert.timestamp)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAlertId(alert.id);
                                onViewAlert?.(alert);
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAcknowledge(alert)}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${acknowledgedIds.includes(alert.id) ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-100" : "border-slate-700/80 bg-slate-950/70 text-slate-100 hover:border-emerald-500/30 hover:bg-emerald-500/10"}`}
                            >
                              Acknowledge
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleResolve(alert)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${resolvedIds.includes(alert.id) ? "border-sky-500/30 bg-sky-500/12 text-sky-100" : "border-slate-700/80 bg-slate-950/70 text-slate-100 hover:border-sky-500/30 hover:bg-sky-500/10"}`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Resolve
                            </button>
                          </div>
                        </div>
                        {selectedAlertId === alert.id && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {[
                              { label: "TDS", value: alert.readings.tds, suffix: "ppm" },
                              { label: "pH", value: alert.readings.ph, suffix: "" },
                              { label: "Turbidity", value: alert.readings.turbidity, suffix: " NTU" },
                            ].map((metric) => (
                              <div key={metric.label} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-sm">
                                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{metric.label}</p>
                                <p className="mt-1 font-semibold text-white">
                                  {typeof metric.value === "number" ? `${metric.value}${metric.suffix}` : "--"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Alert Analytics
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Severity and volume trends</h3>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-300" />
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-300">
                  {[
                    ["Last hour", "hour"],
                    ["Last day", "day"],
                    ["Last week", "week"],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedWindow(value as TimeWindow)}
                      className={`rounded-full border px-3 py-2 transition ${selectedWindow === value ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100" : "border-slate-700/80 bg-slate-950/70 text-slate-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Alerts by severity</p>
                      <ChartLine className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {severitySeries.map((series) => {
                        const total = severitySeries.reduce((sum, item) => sum + item.value, 0) || 1;
                        const percentage = Math.round((series.value / total) * 100);
                        return (
                          <div key={series.label}>
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                              <span>{series.label}</span>
                              <span>{series.value}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${series.tone}`}
                                style={{ width: `${Math.max(6, percentage)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Alerts over time</p>
                      <RefreshCw className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-4 flex h-40 items-end gap-2 rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                      {trendSeries.map((item) => {
                        const max = Math.max(...trendSeries.map((entry) => entry.value), 1);
                        const height = Math.max(8, (item.value / max) * 100);
                        return (
                          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                            <div className="flex h-28 w-full items-end justify-center rounded-xl bg-slate-900/70 px-1">
                              <div className="w-full rounded-lg bg-gradient-to-t from-cyan-500 to-sky-300" style={{ height: `${height}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-slate-400">{getWindowLabel(selectedWindow)} trend bucketed from current alert telemetry.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Most affected sensors</p>
                    <Target className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { sensor: "pH", active: affectedSensors.find((item) => item.sensor === "pH")?.count ?? 0 },
                      { sensor: "TDS", active: affectedSensors.find((item) => item.sensor === "TDS")?.count ?? 0 },
                      { sensor: "Turbidity", active: affectedSensors.find((item) => item.sensor === "Turbidity")?.count ?? 0 },
                      {
                        sensor: "Temperature",
                        active: sortedAlerts.some((alert) => alert.message.toLowerCase().includes("temperature")) ? 1 : 0,
                      },
                    ].map((sensor) => (
                      <div key={sensor.sensor} className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{sensor.sensor}</p>
                        <p className="mt-1 text-2xl font-black text-white">{sensor.active}</p>
                        <p className="mt-1 text-xs text-slate-400">Monitored in current incident set</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Prediction Engine
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">AI risk forecast</h3>
                </div>
                <Zap className="h-5 w-5 text-amber-300" />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_11rem]">
                <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Next 24 Hours</span>
                    <strong className="text-white">{prediction.forecast24h}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Next 48 Hours</span>
                    <strong className="text-white">{prediction.forecast48h}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Probability</span>
                    <strong className="text-white">{prediction.probability}%</strong>
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Predicted Issue</p>
                    <p className="mt-1 text-sm font-semibold text-white">{prediction.predictedIssue}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative h-40 w-40 rounded-full border border-slate-800/80 bg-slate-950/80 p-4">
                    <div className="absolute inset-4 rounded-full" style={{ background: predictionRing }} />
                    <div className="absolute inset-8 rounded-full border border-slate-800/80 bg-slate-950/95" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Risk Score</p>
                      <p className="mt-1 text-4xl font-black text-white">{prediction.gauge}</p>
                      <p className="text-xs text-slate-400">24h forecast</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Smart Insights
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">AI pattern cards</h3>
                </div>
                <Bell className="h-5 w-5 text-sky-300" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {smartInsights.map((insight) => (
                  <div key={insight.title} className="rounded-2xl border border-slate-800/80 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{insight.title}</p>
                      {insight.trend === "up" ? (
                        <ArrowUpRight className="h-4 w-4 text-rose-300" />
                      ) : insight.trend === "down" ? (
                        <ArrowDownRight className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Severity Distribution
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Operational mix</h3>
                </div>
                <FileBarChart2 className="h-5 w-5 text-slate-300" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[13rem_1fr] md:items-center">
                <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-slate-800/80 bg-slate-950/80 p-4">
                  <div className="relative h-full w-full rounded-full" style={{ background: severityDonut }}>
                    <div className="absolute inset-[18%] rounded-full border border-slate-800/80 bg-slate-950/95" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Total</p>
                      <p className="mt-1 text-4xl font-black text-white">{filteredAlerts.length}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {severitySeries.map((series) => {
                    const total = severitySeries.reduce((sum, item) => sum + item.value, 0) || 1;
                    const percent = Math.round((series.value / total) * 100);
                    return (
                      <div key={series.label}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                          <span>{series.label}</span>
                          <span>{series.value} alerts</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${series.tone}`}
                            style={{ width: `${Math.max(4, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Alert History
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">Searchable resolution table</h3>
                </div>
                <button
                  type="button"
                  onClick={buildExportCsv}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
                >
                  <DownloadCloud className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                {[
                  ["Today", "today"],
                  ["7 Days", "7d"],
                  ["30 Days", "30d"],
                  ["Critical", "critical"],
                  ["Warning", "warning"],
                  ["Resolved", "resolved"],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedHistoryFilter(value as HistoryFilter)}
                    className={`rounded-full border px-3 py-2 transition ${selectedHistoryFilter === value ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100" : "border-slate-700/80 bg-slate-950/70 text-slate-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Device</th>
                      <th className="px-4 py-3">Alert</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((alert) => {
                      const status = resolvedIds.includes(alert.id)
                        ? "Resolved"
                        : acknowledgedIds.includes(alert.id)
                          ? "Acknowledged"
                          : alert.level === AlertLevel.DANGER
                            ? "Active"
                            : "Open";

                      return (
                        <tr key={`history-${alert.id}`} className="border-t border-slate-800/80 text-slate-200">
                          <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(alert.timestamp)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{alert.deviceId}</td>
                          <td className="px-4 py-3">{alert.message}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{getAlertLabel(alert.level)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{status}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {resolvedIds.includes(alert.id)
                              ? "Closed by operator"
                              : acknowledgedIds.includes(alert.id)
                                ? "Under review"
                                : "Pending"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  System Recovery
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">Recovery progress tracking</h3>
              </div>
              <Target className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${emergencyMode ? "bg-gradient-to-r from-rose-500 to-amber-400" : "bg-gradient-to-r from-emerald-500 to-cyan-400"}`}
                  style={{ width: `${recoveryProgress}%` }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Acknowledged</p>
                  <p className="mt-1 text-lg font-black text-white">{acknowledgedIds.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Resolved</p>
                  <p className="mt-1 text-lg font-black text-white">{resolvedIds.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Latest Device</p>
                  <p className="mt-1 text-lg font-black text-white">{latestAlert?.deviceId ?? "--"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Recovery progress is estimated from resolved alerts, updated telemetry, and current severity distribution.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
