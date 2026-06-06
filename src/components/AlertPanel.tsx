import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Brain,
  CheckCircle2,
  Clock3,
  Droplet,
  Flame,
  Gauge,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wifi,
} from "lucide-react";

const THRESHOLDS = {
  tds: { safe: 300, warning: 450, danger: 600 },
  ph: { min: 6.8, max: 7.6, warning: 6.5, danger: 6.2 },
  turbidity: { safe: 3, warning: 6, danger: 10 },
  temperature: { safeMin: 18, safeMax: 28, warning: 16, danger: 33 },
};

const initialParameters = {
  tds: 342,
  ph: 7.25,
  turbidity: 4.4,
  temperature: 24.8,
};

const initialAlerts = [
  {
    id: "a1",
    title: "TDS spike detected",
    severity: "Critical",
    sensor: "TDS",
    value: 588,
    safeRange: "100-300 ppm",
    triggeredAt: new Date(Date.now() - 3 * 60 * 1000),
    confidence: 93,
    message: "Rapid conductivity rise indicates filter breakthrough.",
  },
];

const initialStream = [
  {
    id: "s1",
    summary: "Pump station 4 telemetry aligned with alert trends.",
    status: "Confirmed",
    time: new Date(Date.now() - 15000),
    tone: "cyan",
  },
  {
    id: "s2",
    summary: "AI flagged turbidity rise during last cycle.",
    status: "Watching",
    time: new Date(Date.now() - 32000),
    tone: "amber",
  },
  {
    id: "s3",
    summary: "Sensor heartbeat is stable for 78 seconds.",
    status: "Normal",
    time: new Date(Date.now() - 47000),
    tone: "emerald",
  },
];

const initialTimeline = [
  {
    id: "t1",
    title: "Threshold breach",
    detail: "TDS exceeded 600 ppm in Delta Sector.",
    time: new Date(Date.now() - 7 * 60 * 1000),
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    id: "t2",
    title: "AI root cause issued",
    detail: "Rapid TDS increase linked to filter degradation.",
    time: new Date(Date.now() - 5 * 60 * 1000),
    icon: Brain,
    tone: "cyan",
  },
  {
    id: "t3",
    title: "Operator recommendation ready",
    detail: "Inspect filtration unit and collect sample.",
    time: new Date(Date.now() - 3 * 60 * 1000),
    icon: ShieldCheck,
    tone: "emerald",
  },
  {
    id: "t4",
    title: "Live alert stream updated",
    detail: "New telemetry arrived from Sensor 12.",
    time: new Date(Date.now() - 90 * 1000),
    icon: Activity,
    tone: "blue",
  },
];

type SensorParameters = typeof initialParameters;
type AlertEntry = typeof initialAlerts[number];
type StreamEntry = typeof initialStream[number];
type TimelineEntry = typeof initialTimeline[number];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateRisk(parameters: SensorParameters) {
  let risk = 0;
  risk += clamp((parameters.tds - 200) / 4, 0, 45);
  risk += clamp(Math.abs(parameters.ph - 7) * 12, 0, 25);
  risk += clamp((parameters.turbidity - 1.5) * 6, 0, 20);
  risk += parameters.temperature < 18 || parameters.temperature > 28 ? 15 : 0;
  return clamp(Math.round(risk), 0, 100);
}

function determineStatus(risk: number) {
  if (risk >= 70) return "CRITICAL";
  if (risk >= 45) return "WARNING";
  return "SAFE";
}

function getBadgeStyle(status: string) {
  if (status === "CRITICAL") return "bg-rose-500/15 text-rose-500 border-rose-500/30";
  if (status === "WARNING") return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  return "bg-cyan-500/15 text-cyan-500 border-cyan-500/30";
}

function getForecastTrend(risk: number) {
  return {
    oneHour: clamp(risk + 8 + Math.random() * 5, 0, 100),
    sixHour: clamp(risk + 14 + Math.random() * 8, 0, 100),
    day: clamp(risk + 20 + Math.random() * 10, 0, 100),
  };
}

function deriveRootCause(parameters: SensorParameters) {
  const issues: string[] = [];
  if (parameters.tds > THRESHOLDS.tds.warning) {
    issues.push("TDS rose sharply");
  }
  if (parameters.turbidity > THRESHOLDS.turbidity.warning) {
    issues.push("Turbidity climbed quickly");
  }
  if (parameters.ph < THRESHOLDS.ph.warning || parameters.ph > THRESHOLDS.ph.warning + 0.2) {
    issues.push("pH drifted beyond neutral range");
  }
  const cause = issues.length > 0 ? issues.join(" and ") : "Telemetry remains within expected limits.";
  const confidence = clamp(72 + issues.length * 8, 60, 96);
  return {
    cause: issues.length > 0 ? "Rapid parameter shift detected" : "No active anomaly detected",
    rationale: issues.length > 0 ? `${cause} while pressure and flow held steady.` : "Systems are stable with no urgent trigger.",
    confidence,
    affected: issues.length > 0 ? ["TDS", "Turbidity", "pH"].filter((_, idx) => idx < issues.length) : ["Water network"],
    trend: issues.length > 0 ? "Escalating" : "Stable",
  };
}

function deriveAlerts(parameters: SensorParameters) {
  if (parameters.tds > THRESHOLDS.tds.danger) {
    return [
      {
        id: "a-critical",
        title: "Critical TDS breach",
        severity: "Critical",
        sensor: "TDS",
        value: parameters.tds,
        safeRange: "100-300 ppm",
        triggeredAt: new Date(),
        confidence: 94,
        message: "Immediate filtration review required.",
      },
    ];
  }
  if (parameters.turbidity > THRESHOLDS.turbidity.warning) {
    return [
      {
        id: "a-warning",
        title: "Turbidity threshold reached",
        severity: "Warning",
        sensor: "Turbidity",
        value: parameters.turbidity,
        safeRange: "0-3 NTU",
        triggeredAt: new Date(),
        confidence: 86,
        message: "Sediment or algae activity is increasing.",
      },
    ];
  }
  return [];
}

function deriveRecommendation(status: string, rootCause: ReturnType<typeof deriveRootCause>) {
  if (status === "CRITICAL") {
    return "Deploy emergency filtration checks, isolate the affected zone, and verify inlet water chemistry immediately.";
  }
  if (status === "WARNING") {
    return "Inspect upstream filters, collect a sample, and prepare to ramp response if conditions worsen.";
  }
  return "Maintain standard monitoring cadence and continue telemetry validation.";
}

function formatEventTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const motionCard = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function AlertPanel() {
  const [demoMode, setDemoMode] = useState(false);
  const [parameters, setParameters] = useState(initialParameters);
  const [alertStream, setAlertStream] = useState<StreamEntry[]>(initialStream);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(initialTimeline);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const riskScore = useMemo(() => calculateRisk(parameters), [parameters]);
  const waterScore = useMemo(() => 100 - riskScore, [riskScore]);
  const status = useMemo(() => determineStatus(riskScore), [riskScore]);
  const badgeStyle = useMemo(() => getBadgeStyle(status), [status]);
  const forecast = useMemo(() => getForecastTrend(riskScore), [riskScore]);
  const rootCause = useMemo(() => deriveRootCause(parameters), [parameters]);
  const activeAlerts = useMemo(() => deriveAlerts(parameters), [parameters]);
  const recommendation = useMemo(() => deriveRecommendation(status, rootCause), [status, rootCause]);
  const currentAlert = activeAlerts[0] ?? null;
  const isNormal = currentAlert === null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!demoMode) return;

      setParameters((current) => {
        const delta = () => (Math.random() - 0.5) * 0.1;
        return {
          tds: clamp(current.tds + delta() * 42, 120, 680),
          ph: clamp(current.ph + delta() * 0.12, 6.4, 8.4),
          turbidity: clamp(current.turbidity + delta() * 1.1, 0.8, 11),
          temperature: clamp(current.temperature + delta() * 1.4, 16, 33),
        };
      });

      setLastUpdated(new Date());
      setAlertStream((current) => [
        {
          id: `stream-${Date.now()}`,
          summary: `Telemetry refreshed for Sensor ${Math.ceil(Math.random() * 20)}.`,
          status: Math.random() > 0.5 ? "Confirmed" : "Watching",
          time: new Date(),
          tone: Math.random() > 0.6 ? "cyan" : "amber",
        },
        ...current.slice(0, 6),
      ]);

      setTimeline((current) => [
        {
          id: `timeline-${Date.now()}`,
          title: "Simulated alert event",
          detail: "AI updated the response priority and confidence.",
          time: new Date(),
          icon: Sparkles,
          tone: "cyan",
        },
        ...current.slice(0, 5),
      ]);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [demoMode]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, [parameters]);

  const forecastData = [
    { label: "1h", value: forecast.oneHour, highlight: false },
    { label: "6h", value: forecast.sixHour, highlight: riskScore >= 60 },
    { label: "24h", value: forecast.day, highlight: riskScore >= 50 },
  ];

  const actions = useMemo(
    () => [
      {
        id: "action-1",
        title: "Inspect filtration unit",
        priority: currentAlert?.severity === "Critical" ? "Critical" : "High",
        impact: "High",
        eta: "15 min",
        reason: "Most likely cause: particle breakthrough in filter media.",
      },
      {
        id: "action-2",
        title: "Collect manual sample",
        priority: "High",
        impact: "Medium",
        eta: "30 min",
        reason: "Verify AI alert with lab-grade analysis.",
      },
      {
        id: "action-3",
        title: "Verify source water",
        priority: "Medium",
        impact: "Medium",
        eta: "45 min",
        reason: "Confirm whether upstream intake changed quality.",
      },
    ],
    [currentAlert],
  );

  const statusGlow = status === "CRITICAL" ? "from-rose-600/30 to-rose-500/10" : status === "WARNING" ? "from-amber-500/30 to-amber-400/10" : "from-cyan-500/30 to-cyan-400/10";

  return (
    <main className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
              ALERT PANEL
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Emergency water response alert hub
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Live incident triage, root cause intelligence, and predictive action planning for high-stakes water safety operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDemoMode((current) => !current)}
            className={`inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold transition ${
              demoMode
                ? "bg-cyan-600 text-slate-950 shadow-cyan-500/30"
                : "bg-slate-950 text-white shadow-slate-900/20 dark:bg-white/10 dark:text-white"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${demoMode ? "bg-white" : "bg-cyan-400"}`} />
            {demoMode ? "Demo Mode On" : "Demo Mode Off"}
          </button>
        </div>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]"
        >
          <motion.div variants={motionCard} className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-lg shadow-cyan-500/10">
                    {status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    {currentAlert ? currentAlert.severity : "Normal"}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">LIVE INCIDENT HEADER</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-white/10">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Current device</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Sensor 12</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-white/10">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Current zone</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Delta Sector Alpha</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-white/10">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Water score</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{waterScore}/100</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-white/10">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Risk score</p>
                      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{riskScore}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.8rem] bg-gradient-to-br from-cyan-500/10 to-slate-100 p-5 text-slate-950 shadow-lg shadow-cyan-500/10 dark:from-cyan-500/15 dark:to-slate-900/40 dark:text-white">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-cyan-200/80">Connection</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-cyan-500" />
                    <div>
                      <p className="text-lg font-semibold">Connected</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Live sensor feed active</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.8rem] bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-5 text-white shadow-lg shadow-cyan-500/10 dark:bg-slate-950/90">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Last reading</p>
                  <p className="mt-3 text-lg font-semibold">{formatTime(lastUpdated)}</p>
                  <p className="mt-1 text-sm text-slate-400">Updated seconds ago</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/95 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Active alert</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{isNormal ? "System Operating Normally" : currentAlert.title}</h2>
              </div>
              <span className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] ${isNormal ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-700" : badgeStyle}`}>
                {isNormal ? "SAFE" : currentAlert.severity.toUpperCase()}
              </span>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Triggered sensor</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{isNormal ? "None" : currentAlert.sensor}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Current value</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{isNormal ? "—" : currentAlert.value}{isNormal ? "" : currentAlert.sensor === "pH" ? " pH" : currentAlert.sensor === "TDS" ? " ppm" : " NTU"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Safe range</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{isNormal ? "All sensors nominal" : currentAlert.safeRange}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Alert confidence</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{isNormal ? "—" : `${currentAlert.confidence}%`}</p>
                </div>
              </div>

              {!isNormal ? (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Triggered at</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{formatTime(currentAlert.triggeredAt)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{currentAlert.message}</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-700">System Operating Normally</p>
                  <p className="mt-2 text-sm text-emerald-600">No active high-priority alerts detected. Continue sustained monitoring.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"
        >
          <motion.div variants={motionCard} className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">AI Root Cause Analysis</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Why did it happen?</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200">
                <Brain className="h-4 w-4 text-cyan-500" />
                AI explanation
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_12rem]">
              <div className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">{rootCause.rationale}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Cause</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{rootCause.cause}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Trend</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{rootCause.trend}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Confidence</p>
                    <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">{rootCause.confidence}%</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Affected</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{rootCause.affected.join(", ")}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Why</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{rootCause.rationale.split(" ").slice(0, 6).join(" ")}...</p>
                  </div>
                </div>
              </div>

              <div className="relative rounded-[2rem] bg-slate-950/95 p-5 text-white shadow-lg shadow-cyan-500/10 dark:bg-slate-900/95">
                <div className="absolute inset-x-6 top-6 h-20 rounded-full bg-gradient-to-r from-cyan-500/20 via-transparent to-slate-950/10 blur-2xl" />
                <div className="relative flex h-52 items-center justify-center rounded-[2rem] bg-slate-900/95 ring-1 ring-white/10">
                  <div className="absolute inset-9 rounded-full bg-slate-950/90" />
                  <div className="absolute inset-11 rounded-full border border-cyan-500/20" />
                  <div className="absolute inset-16 rounded-full border border-cyan-400/20" />
                  <p className="relative text-4xl font-black text-white">{rootCause.confidence}%</p>
                  <p className="relative mt-1 text-xs uppercase tracking-[0.28em] text-slate-400">AI confidence</p>
                </div>
                <div className="mt-5 flex flex-col gap-3 rounded-3xl bg-slate-950/90 p-4 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Cause severity</span>
                    <span className="font-semibold text-white">{currentAlert ? currentAlert.severity : "Low"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prediction certainty</span>
                    <span className="font-semibold text-white">{rootCause.confidence}%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Risk Forecast</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">What happens next?</h2>
              </div>
              <div className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">
                Predicted trend
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Current risk</p>
                    <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{riskScore}%</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Gauge className="h-5 w-5 text-cyan-500" />
                    {status}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {forecastData.map((point) => (
                  <div key={point.label} className={`rounded-3xl border p-5 shadow-sm dark:border-white/10 ${point.highlight ? "border-cyan-400/40 bg-cyan-500/10" : "border-slate-200/80 bg-white dark:bg-slate-950/80"}`}>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{point.label} forecast</p>
                    <p className={`mt-3 text-3xl font-black ${point.highlight ? "text-cyan-600" : "text-slate-950 dark:text-white"}`}>{point.value}%</p>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Predicted trend</p>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{status === "CRITICAL" ? "Escalation and immediate response expected." : status === "WARNING" ? "Monitor closely and prepare corrective action." : "Stable with continued observation."}</p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]"
        >
          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">What-If Simulator</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Test alternate sensor scenarios</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Interactive</div>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-6">
                {([
                  { label: "TDS", value: parameters.tds, min: 120, max: 680, step: 10, unit: "ppm" },
                  { label: "pH", value: parameters.ph, min: 6.4, max: 8.4, step: 0.1, unit: "pH" },
                  { label: "Turbidity", value: parameters.turbidity, min: 0.8, max: 11, step: 0.1, unit: "NTU" },
                  { label: "Temperature", value: parameters.temperature, min: 16, max: 33, step: 0.1, unit: "°C" },
                ] as Array<{ label: string; value: number; min: number; max: number; step: number; unit: string }>).map((field) => (
                  <div key={field.label} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{field.label}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{field.value.toFixed(field.step === 0.1 ? 1 : 0)} {field.unit}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">Live</span>
                    </div>
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={field.value}
                      onChange={(event) => setParameters((current) => ({
                        ...current,
                        [field.label.toLowerCase()]: Number(event.target.value),
                      }))}
                      className="mt-4 h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-cyan-500 dark:bg-slate-700"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Instant outcome</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl bg-slate-100 p-4 dark:bg-slate-900">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Risk</p>
                      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{riskScore}%</p>
                    </div>
                    <div className="rounded-3xl bg-slate-100 p-4 dark:bg-slate-900">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Quality</p>
                      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{waterScore}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Safety status</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">{status}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{recommendation}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">AI Recommendation Engine</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">What should be done now?</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Action plan
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {actions.map((action, index) => (
                <motion.div
                  key={action.id}
                  whileHover={{ y: -4 }}
                  className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition dark:border-white/10 dark:bg-slate-950/80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-950 dark:text-white">{action.title}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{action.reason}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${action.priority === "Critical" ? "bg-rose-500/10 text-rose-600" : action.priority === "High" ? "bg-amber-500/10 text-amber-600" : "bg-cyan-500/10 text-cyan-600"}`}>
                      {action.priority}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      <span>{action.eta}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                      <ShieldCheck className="h-4 w-4 text-cyan-500" />
                      <span>{action.impact} impact</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"
        >
          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Incident Timeline</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">What happened?</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Live events
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {timeline.map((event) => {
                const Icon = event.icon;
                const toneStyle = event.tone === "rose" ? "bg-rose-500/10 text-rose-500" : event.tone === "cyan" ? "bg-cyan-500/10 text-cyan-500" : event.tone === "emerald" ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-100 text-slate-700";
                return (
                  <motion.div
                    key={event.id}
                    whileHover={{ y: -2 }}
                    className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-3xl border ${toneStyle}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-lg font-semibold text-slate-950 dark:text-white">{event.title}</p>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{formatTime(event.time)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div variants={motionCard} className="rounded-[2rem] border border-slate-200/70 bg-slate-50/90 p-6 shadow-[0_20px_80px_-50px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Live Alert Stream</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Latest feed</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Auto update
              </div>
            </div>
            <div className="mt-8 space-y-3">
              {alertStream.map((entry) => (
                <motion.div
                  key={entry.id}
                  whileHover={{ y: -2 }}
                  className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{entry.summary}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${entry.tone === "amber" ? "bg-amber-100 text-amber-700" : entry.tone === "cyan" ? "bg-cyan-100 text-cyan-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{formatTime(entry.time)} • real-time update</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.section>
      </div>
    </main>
  );
}
