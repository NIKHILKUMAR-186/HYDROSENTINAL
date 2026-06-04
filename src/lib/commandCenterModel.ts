import { getSafetyScore } from "@/lib/geoIntelligence";

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const averageNumber = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateTrendSlope = (values: number[]) => {
  if (values.length < 2) return 0;
  return (values[values.length - 1] - values[0]) / (values.length - 1);
};

const formatRelativeAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const formatSignedValue = (value: number, suffix = "") => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${suffix}`;
};

const normalizeSeverityTone = (value: unknown) => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "danger" || normalized === "critical") {
    return "danger" as const;
  }

  if (normalized === "warning") {
    return "warning" as const;
  }

  return "info" as const;
};

export function buildCommandCenterModel({
  history,
  latestReadings,
  latest,
  devices,
  latestReadingByDevice,
  selectedDevice,
  spreadPrediction,
  waterAlerts,
  connectionStatus,
  alerts,
}: any) {
  const sensorWindow = (latestReadings.length ? latestReadings : history).slice(-24);
  const readingWindow = sensorWindow.length ? sensorWindow : history.slice(-12);
  const alertStream = waterAlerts?.recentAlerts ?? [];
  const safeReadings = readingWindow.filter((reading: any) => reading.status === "SAFE").length;
  const unsafeReadings = Math.max(0, readingWindow.length - safeReadings);
  const tdsValues = readingWindow.map((reading: any) => reading.tds);
  const phValues = readingWindow.map((reading: any) => reading.ph);
  const turbidityValues = readingWindow.map((reading: any) => reading.turbidity);
  const tempValues = readingWindow.map((reading: any) => reading.temperature ?? 0);

  const tdsSlope = calculateTrendSlope(tdsValues.slice(-8));
  const phSlope = calculateTrendSlope(phValues.slice(-8));
  const turbiditySlope = calculateTrendSlope(turbidityValues.slice(-8));
  const tempSlope = calculateTrendSlope(tempValues.slice(-8));

  const latestReading = readingWindow[readingWindow.length - 1] ?? latest;
  const latestPh = latestReading?.ph ?? 7;
  const latestTds = latestReading?.tds ?? 0;
  const latestTurbidity = latestReading?.turbidity ?? 0;
  const latestTemperature = latestReading?.temperature ?? 28;
  const batteryScore = clampNumber((selectedDevice?.battery ?? 68), 0, 100);

  const phScore = clampNumber(100 - Math.abs(latestPh - 7.4) * 24, 0, 100);
  const tdsScore = clampNumber(100 - Math.max(0, latestTds - 350) / 8, 0, 100);
  const turbidityScore = clampNumber(100 - Math.max(0, latestTurbidity - 2.5) * 8, 0, 100);
  const temperatureScore = clampNumber(100 - Math.abs(latestTemperature - 28) * 6, 0, 100);
  const trendScore = clampNumber(
    100 - Math.abs(tdsSlope) * 0.22 - Math.abs(turbiditySlope) * 5.5 - Math.abs(phSlope) * 18,
    0,
    100,
  );

  const qualityScore = clampNumber(
    Math.round(
      averageNumber([
        phScore,
        tdsScore,
        turbidityScore,
        temperatureScore,
        trendScore,
        batteryScore,
      ]),
    ),
    0,
    100,
  );

  const anomalyCount = readingWindow.filter((reading: any) => {
    return (
      reading.status !== "SAFE" ||
      reading.ph < 6.5 ||
      reading.ph > 8.5 ||
      reading.tds > 800 ||
      reading.turbidity > 10
    );
  }).length;

  const risk24h = clampNumber(
    Math.round(
      100 - qualityScore + anomalyCount * 6 + Math.max(0, tdsSlope) * 1.4 + Math.max(0, turbiditySlope) * 3.5,
    ),
    3,
    99,
  );
  const risk48h = clampNumber(
    Math.round(risk24h + Math.max(4, Math.max(0, tdsSlope) * 1.8 + Math.max(0, turbiditySlope) * 4 + Math.max(0, tempSlope) * 1.5)),
    5,
    99,
  );

  const causeSignals = [
    latestPh < 6.5 || latestPh > 8.5
      ? "pH drift suggests dosing imbalance or source contamination."
      : null,
    latestTds > 800 || tdsSlope > 12
      ? "Rising dissolved solids point to source intrusion or filter fatigue."
      : null,
    latestTurbidity > 10 || turbiditySlope > 0.4
      ? "Turbidity is increasing, which can indicate sediment or inflow disturbance."
      : null,
    batteryScore < 45 || selectedDevice?.status === "inactive"
      ? "Device health is weakening because power or connectivity is degraded."
      : null,
  ].filter(Boolean) as string[];

  if (causeSignals.length === 0) {
    causeSignals.push(alertStream[0]?.message ?? "System is stable, but monitoring continues for emerging anomalies.");
  }

  const currentStateLabel =
    qualityScore >= 85
      ? "Stable operations"
      : qualityScore >= 65
        ? "Watch mode"
        : "Critical response";

  const currentStateTone = qualityScore >= 85 ? "emerald" : qualityScore >= 65 ? "amber" : "rose";

  const sensorTrendCards = [
    {
      label: "pH stability",
      value: `${latestPh.toFixed(1)}`,
      detail: `${formatSignedValue(phSlope, " / reading")} trend`,
      tone: Math.abs(latestPh - 7.4) < 0.5 ? "emerald" : "amber",
    },
    {
      label: "TDS pressure",
      value: `${Math.round(latestTds)} ppm`,
      detail: `${formatSignedValue(tdsSlope, " ppm")} over recent window`,
      tone: latestTds > 800 ? "rose" : latestTds > 500 ? "amber" : "emerald",
    },
    {
      label: "Turbidity drift",
      value: `${latestTurbidity.toFixed(1)} NTU`,
      detail: `${formatSignedValue(turbiditySlope, " NTU")} over recent window`,
      tone: latestTurbidity > 10 ? "rose" : latestTurbidity > 5 ? "amber" : "emerald",
    },
    {
      label: "Temperature",
      value: `${latestTemperature.toFixed(1)}°C`,
      detail: `${formatSignedValue(tempSlope, "°C")} from the selected history`,
      tone: Math.abs(latestTemperature - 28) > 4 ? "amber" : "emerald",
    },
  ];

  const incidentWindows: number[] = [];
  let incidentStart: number | null = null;
  readingWindow.forEach((reading: any) => {
    const isUnsafe =
      reading.status !== "SAFE" ||
      reading.ph < 6.5 ||
      reading.ph > 8.5 ||
      reading.tds > 800 ||
      reading.turbidity > 10;

    if (isUnsafe && incidentStart === null) {
      incidentStart = reading.timestamp;
    }

    if (!isUnsafe && incidentStart !== null) {
      incidentWindows.push(reading.timestamp - incidentStart);
      incidentStart = null;
    }
  });

  if (incidentStart !== null) {
    incidentWindows.push(Date.now() - incidentStart);
  }

  const meanResolutionMinutes =
    incidentWindows.length > 0
      ? averageNumber(incidentWindows.map((windowMs) => windowMs / 60000))
      : 0;
  const fastResolutionRate =
    incidentWindows.length > 0
      ? Math.round(
          (incidentWindows.filter((windowMs) => windowMs <= 30 * 60000).length /
            incidentWindows.length) *
            100,
        )
      : 100;

  const alertSeverityCounts = alertStream.reduce(
    (counts: any, alert: any) => {
      const tone = normalizeSeverityTone(alert.level);
      if (tone === "danger") counts.critical += 1;
      else if (tone === "warning") counts.warning += 1;
      else counts.info += 1;
      return counts;
    },
    { critical: 0, warning: 0, info: 0 },
  );

  const recentTimeline = [
    {
      id: "state",
      stage: "Current State",
      title: `${currentStateLabel} · ${qualityScore}/100 health`,
      detail: `${readingWindow.length} readings analyzed, ${safeReadings} safe and ${unsafeReadings} flagged in the active window.`,
      time: latestReading ? formatRelativeAge(latestReading.timestamp) : "just now",
      tone: currentStateTone,
    },
    {
      id: "risk",
      stage: "Risk",
      title: `${risk24h}% / ${risk48h}% predicted risk`,
      detail: `Projected escalation from trend pressure and ${anomalyCount} anomaly signature${anomalyCount === 1 ? "" : "s"}.`,
      time: risk48h >= 75 ? "Requires attention" : "Monitored",
      tone: risk48h >= 75 ? "rose" : risk48h >= 45 ? "amber" : "emerald",
    },
    {
      id: "cause",
      stage: "Cause",
      title: causeSignals[0],
      detail: causeSignals.slice(1).join(" ") || "Root cause analysis is aligned with the live sensor profile.",
      time: alertStream[0] ? formatRelativeAge(alertStream[0].timestamp) : "derived now",
      tone: causeSignals.length > 1 ? "amber" : "emerald",
    },
    {
      id: "prediction",
      stage: "Prediction",
      title: `48h outlook: ${risk48h}% risk with ${Math.max(0, Math.round(tdsSlope))} ppm TDS pressure`,
      detail: `Predictive maintenance window: ${selectedDevice?.status === "active" ? "within the next 24-36h" : "reconnect device before escalation"}.`,
      time: spreadPrediction ? `${spreadPrediction.riskScore}% spread risk` : "forecast ready",
      tone: risk48h > 70 ? "rose" : "cyan",
    },
    {
      id: "action",
      stage: "Recommendation",
      title: latestReading?.status === "SAFE" ? "Keep routine surveillance and verify filters." : "Escalate treatment and source inspection now.",
      detail: `Operational recommendation: ${
        latestReading?.status === "SAFE"
          ? "Continue live monitoring and capture one more sample before closing the incident."
          : "Generate the incident report, notify the field team, and confirm corrective action within the current shift."
      }`,
      time: `${fastResolutionRate}% resolved within 30m`,
      tone: latestReading?.status === "SAFE" ? "emerald" : "rose",
    },
  ];

  const liveActivityFeed = [
    ...alertStream.slice(0, 3).map((alert: any) => ({
      id: `alert-${alert.id}`,
      label: alert.level,
      title: alert.message,
      detail: `${alert.deviceId} · ${formatRelativeAge(alert.timestamp)}`,
      tone: normalizeSeverityTone(alert.level),
    })),
    ...readingWindow.slice(-3).map((reading: any) => ({
      id: `reading-${reading.timestamp}`,
      label: reading.status === "SAFE" ? "Telemetry" : "Anomaly",
      title: reading.status === "SAFE" ? "Stable telemetry received" : "Derived anomaly detected",
      detail: `pH ${reading.ph.toFixed(1)} · TDS ${Math.round(reading.tds)} ppm · Turbidity ${reading.turbidity.toFixed(1)} NTU`,
      tone: reading.status === "SAFE" ? "emerald" : "amber",
    })),
  ].slice(0, 5);

  const severityAnalytics = [
    { label: "Critical", value: alertSeverityCounts.critical, tone: "rose" },
    { label: "Warning", value: alertSeverityCounts.warning, tone: "amber" },
    { label: "Info", value: alertSeverityCounts.info, tone: "cyan" },
  ];

  const resolutionMetrics = [
    { label: "Mean resolution", value: meanResolutionMinutes ? `${meanResolutionMinutes.toFixed(1)}m` : "Instant", detail: "Average unsafe streak duration" },
    { label: "Fast resolutions", value: `${fastResolutionRate}%`, detail: "Resolved within 30 minutes" },
    { label: "Open incidents", value: `${incidentWindows.length ? 1 : 0}`, detail: "Live incident windows in memory" },
  ];

  const predictiveMaintenance = [
    {
      label: "Battery outlook",
      value: `${batteryScore}%`,
      detail: batteryScore < 50 ? "Recharge or replace the node soon." : "Healthy enough for continued monitoring.",
    },
    {
      label: "Filter watch",
      value: latestTds > 800 ? "Urgent" : latestTds > 500 ? "Due soon" : "Nominal",
      detail: latestTds > 800 ? "Filter replacement should be prioritized." : "Continue preventive checks." ,
    },
    {
      label: "Sensor drift",
      value: Math.abs(tdsSlope) > 15 || Math.abs(turbiditySlope) > 0.7 ? "Escalated" : "Normal",
      detail: "Trend movement remains within operational tolerance or should be inspected.",
    },
  ];

  const radarMetrics = [
    { label: "pH", value: phScore },
    { label: "TDS", value: tdsScore },
    { label: "Turbidity", value: turbidityScore },
    { label: "Temp", value: temperatureScore },
    { label: "Stability", value: trendScore },
    { label: "Power", value: batteryScore },
  ];

  const deviceHealth = {
    battery: batteryScore,
    syncStatus: selectedDevice?.status === "active" ? "Live" : "Needs attention",
    lastReading: latestReading ? formatRelativeAge(latestReading.timestamp) : "No reading yet",
    connection: connectionStatus,
  };

  const zoneBuckets = devices.reduce<Record<string, { name: string; devices: number; unsafe: number; safe: number; avgScore: number }>>(
    (accumulator: any, device: any) => {
      const zone = device.zone ?? "Unzoned";
      const reading = latestReadingByDevice[device.id];
      const isSafe = reading?.status === "SAFE";
      const score = reading
        ? clampNumber(
            Math.round(getSafetyScore({
              ph: reading.ph,
              tds: reading.tds,
              turbidity: reading.turbidity,
              temperature: reading.temperature ?? 28,
            })),
            0,
            100,
          )
        : 62;

      if (!accumulator[zone]) {
        accumulator[zone] = { name: zone, devices: 0, unsafe: 0, safe: 0, avgScore: 0 };
      }

      const next = accumulator[zone];
      next.devices += 1;
      next.safe += isSafe ? 1 : 0;
      next.unsafe += isSafe ? 0 : 1;
      next.avgScore = Math.round((next.avgScore * (next.devices - 1) + score) / next.devices);
      return accumulator;
    },
    {},
  );

  const zoneCards = Object.values(zoneBuckets)
    .sort((left, right) => right.avgScore - left.avgScore)
    .slice(0, 5)
    .map((zone) => ({
      ...zone,
      tone: zone.unsafe > 0 ? "amber" : "emerald",
    }));

  const derivedHeatmap = zoneCards.length
    ? zoneCards
    : [
        {
          name: selectedDevice?.zone ?? "Central Hub",
          devices: 1,
          unsafe: latestReading && latestReading.status !== "SAFE" ? 1 : 0,
          safe: latestReading && latestReading.status === "SAFE" ? 1 : 0,
          avgScore: qualityScore,
          tone: latestReading && latestReading.status !== "SAFE" ? "amber" : "emerald",
        },
      ];

  const recommendations = [
    latestReading?.status === "SAFE"
      ? "Maintain the current treatment cadence and capture another baseline reading in 15 minutes."
      : "Dispatch the field team and verify coagulation, filtration, and source integrity immediately.",
    risk48h > 70
      ? "Enable high-priority watch mode for the selected zone and notify the municipal operations team."
      : "Keep predictive maintenance on routine watch and reassess after the next sensor sync.",
    alertStream.length === 0
      ? "Promote the derived sensor insights so operators can see risk before the first alert fires."
      : "Review the live alert stream and acknowledge unresolved incidents from the command center.",
  ];

  const environmentalImpact = {
    safeguardedLiters: Math.max(0, safeReadings * 125),
    avoidedIncidents: Math.max(0, safeReadings - unsafeReadings),
    co2Saved: Math.max(0, Math.round(safeReadings * 0.42)),
  };

  const historicalTrendExplorer = {
    recentSamples: readingWindow.slice(-12),
    tdsTrail: tdsValues.slice(-12),
    phTrail: phValues.slice(-12),
    turbidityTrail: turbidityValues.slice(-12),
  };

  const incidentReport = [
    `HydroSentinel Incident Report`,
    `Device: ${selectedDevice?.name ?? "Unknown device"}`,
    `Zone: ${selectedDevice?.zone ?? "Unzoned"}`,
    `Health Score: ${qualityScore}/100`,
    `24h Risk: ${risk24h}%`,
    `48h Risk: ${risk48h}%`,
    `Root Cause: ${causeSignals.join(" | ")}`,
    `Recommendation: ${recommendations[0]}`,
    `Activity: ${liveActivityFeed.map((entry: any) => entry.title).join("; ")}`,
  ].join("\n");

  return {
    qualityScore,
    currentStateLabel,
    currentStateTone,
    risk24h,
    risk48h,
    safeReadings,
    unsafeReadings,
    causeSignals,
    recentTimeline,
    liveActivityFeed,
    sensorTrendCards,
    predictiveMaintenance,
    severityAnalytics,
    resolutionMetrics,
    radarMetrics,
    deviceHealth,
    derivedHeatmap,
    recommendations,
    // prioritized actions for UI action center
    prioritizedActions: (recommendations || []).slice(0, 6).map((r: any, i: number) => ({
      id: `rec-${i}`,
      title: typeof r === "string" ? r.split(".")[0] : r.title ?? String(r),
      description: typeof r === "string" ? r : r.description ?? "No additional details.",
      impactPercent: Math.min(80, Math.round((1 / (i + 1)) * 50) + (anomalyCount > 0 ? 10 : 0)),
      confidence: Math.max(50, Math.min(95, Math.round(100 - risk48h / 1.5 - i * 6))),
    })),
    // simple what-if simulator outputs
    whatIf: {
      replaceFilterImpact: Math.min(60, Math.round((100 - qualityScore) / 2)),
      scoreDelta: Math.min(30, Math.round((100 - qualityScore) / 6)),
    },
    // prediction metadata
    predictedRisk: risk24h,
    predictionConfidence: Math.max(40, Math.round(70 - Math.abs(tdsSlope) * 3 - Math.abs(turbiditySlope) * 8)),
    environmentalImpact,
    anomalyCount,
    historicalTrendExplorer,
    incidentReport,
    meanResolutionMinutes,
    fastResolutionRate,
    alertCount: alertStream.length,
  };
}
