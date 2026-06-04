import React, { useMemo, useState } from "react";

type Model = any;

export default function CommandCenter({
  model,
  devicesCount,
  onExecuteAction,
  onSimulate,
}: {
  model: Model;
  devicesCount: number;
  onExecuteAction?: (actionId: string) => void;
  onSimulate?: (scenario: string) => void;
}) {
  const [demoMode, setDemoMode] = useState(false);

  const activeModel = useMemo(() => {
    if (!demoMode) return model ?? {};
    // safe demo overrides so UI can show meaningful examples without changing source model
    return {
      ...model,
      qualityScore: Math.max(65, model?.qualityScore ?? 72),
      predictedRisk: model?.predictedRisk ?? model?.risk24h ?? 22,
      predictionConfidence: model?.predictionConfidence ?? 78,
      liveActivityFeed: model?.liveActivityFeed?.length ? model.liveActivityFeed : [
        { id: "demo-1", title: "Turbidity spike at Intake #3", detail: "Simulated event", time: "2m ago", tone: "amber" },
        { id: "demo-2", title: "pH drift detected", detail: "Simulated event", time: "5m ago", tone: "amber" },
      ],
      whatIf: model?.whatIf ?? { replaceFilterImpact: 40, scoreDelta: 12 },
      prioritizedActions: model?.prioritizedActions ?? [
        { id: "demo-a1", title: "Dispatch field team", description: "Send crew to inspect intake.", impactPercent: 60, confidence: 82 },
        { id: "demo-a2", title: "Replace pre-filter", description: "Change pre-filtration cartridges.", impactPercent: 42, confidence: 74 },
      ],
    };
  }, [demoMode, model]);

  const score = activeModel.qualityScore ?? 0;
  const stateTone = activeModel.currentStateTone ?? "emerald";
  const risk = activeModel.risk24h ?? activeModel.predictedRisk ?? 0;
  const incidents = activeModel.alertCount ?? 0;

  const statusLabel = stateTone === "rose" ? "CRITICAL" : stateTone === "amber" ? "WARNING" : "SAFE";

  const cardBase = "rounded-2xl border p-4 h-full flex flex-col";
  const lightCard = "border-slate-200/80 bg-white/90 text-slate-700 shadow-xl";
  const darkCard = "dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Water Operations Center</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Predictive monitoring, anomaly detection, and response guidance</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDemoMode((s) => !s)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${demoMode ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-white"}`}>
            {demoMode ? "Demo: ON" : "Demo Mode"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="col-span-3 md:col-span-1">
          <div className={`${cardBase} ${lightCard} ${darkCard}`}>
            <div>
              <div className="text-sm font-semibold text-slate-500">Water Quality</div>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-cyan-50 to-emerald-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-600">Score</div>
                    <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{score}/100</div>
                    <div className="text-xs uppercase text-slate-500 mt-1">{statusLabel}</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-lg p-3 bg-transparent">
                      <div className="text-xs text-slate-500">Current Risk</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{risk}%</div>
                    </div>
                    <div className="rounded-lg p-3 bg-transparent">
                      <div className="text-xs text-slate-500">Active Incidents</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{incidents}</div>
                    </div>
                    <div className="rounded-lg p-3 bg-transparent">
                      <div className="text-xs text-slate-500">Connected Devices</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">{devicesCount}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 md:col-span-2 grid gap-4">
          <div className={`${cardBase} ${lightCard} ${darkCard}`}>
            <h3 className="text-sm font-semibold text-slate-600">AI Prediction Engine</h3>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">{activeModel.predictedRisk ?? risk}%</div>
                <div className="text-xs text-slate-500">Confidence {activeModel.predictionConfidence ?? "--"}%</div>
                <div className="mt-2 text-sm text-slate-600">Expected Issue: <span className="font-semibold text-slate-800 dark:text-white">{activeModel.predictedIssue ?? "Turbidity Spike"}</span></div>
                <div className="mt-1 text-sm text-slate-600">Time to incident: <span className="font-semibold text-slate-800 dark:text-white">{activeModel.timeToIncident ?? "--"}</span></div>
              </div>
              <div className="w-48">
                <svg viewBox="0 0 200 40" className="w-full h-10">
                  <rect x="0" y="14" width="200" height="12" rx="6" fill="#f1f5f9" />
                  <rect x="0" y="14" width={`${Math.min(100, activeModel.predictedRisk ?? risk) * 2}`} height="12" rx="6" fill="#06b6d4" />
                </svg>
                <div className="text-xs text-slate-500 mt-2">Risk trend: {activeModel.riskTrend ?? "Increasing"}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={`${cardBase} ${lightCard} ${darkCard} md:col-span-1`}> 
              <h4 className="text-xs font-semibold text-slate-600">Root Cause Analysis</h4>
              <div className="mt-3 text-sm text-slate-700 flex-1">
                <div className="font-semibold text-slate-900 dark:text-white">{activeModel.mostLikelyCause ?? activeModel.causeSignals?.[0] ?? "Turbidity increase due to sediment disturbance."}</div>
                <div className="mt-2 text-xs text-slate-500">Signals: {activeModel.supportingSignals?.join(" · ") ?? activeModel.causeSignals?.slice(0,3).join(" · ")}</div>
                <div className="mt-2 text-xs text-slate-500">Confidence: {activeModel.causeConfidence ?? "--"}%</div>
              </div>
            </div>

            <div className={`${cardBase} ${lightCard} ${darkCard} md:col-span-1`}>
              <h4 className="text-xs font-semibold text-slate-600">AI Recommendation Engine</h4>
              <div className="mt-3 space-y-3 flex-1">
                {(activeModel.prioritizedActions ?? []).slice(0,3).map((act: any, i: number) => (
                  <div key={act.id ?? i} className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{act.title}</div>
                      <div className="text-xs text-slate-500">{act.description}</div>
                      <div className="text-xs text-slate-400 mt-1">Impact: {act.impactPercent ?? Math.round((1/(i+1))*25)}% · Confidence: {act.confidence ?? act.confidence ?? "--"}%</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => onExecuteAction && onExecuteAction(act.id)} className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-white">Execute</button>
                      <button onClick={() => onExecuteAction && onExecuteAction(`${act.id}:complete`)} className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs">Mark Done</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${cardBase} ${lightCard} ${darkCard} md:col-span-1`}>
              <h4 className="text-xs font-semibold text-slate-600">What If Simulator</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700 flex-1">
                <div>Current Risk: <span className="font-bold text-slate-900 dark:text-white">{risk}%</span></div>
                <div>After Replace Filter: <span className="font-bold text-slate-900 dark:text-white">{Math.max(0, Math.round((activeModel.predictedRisk ?? risk) - (activeModel.whatIf?.replaceFilterImpact ?? 40)))}%</span></div>
                <div>Score Improvement: <span className="font-bold text-slate-900 dark:text-white">+{activeModel.whatIf?.scoreDelta ?? 13}</span></div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onSimulate && onSimulate("replace-filter")} className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">Simulate</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className={`${cardBase} ${lightCard} ${darkCard} md:col-span-2`}>
          <h4 className="text-xs font-semibold text-slate-600">Live Incident Timeline</h4>
          <div className="mt-3 space-y-2">
            {activeModel.liveActivityFeed?.slice(0,8).map((evt: any) => (
              <div key={evt.id} className="flex items-start gap-3">
                <div className={`mt-1 h-3 w-3 rounded-full ${evt.tone === "rose" ? "bg-rose-400" : evt.tone === "amber" ? "bg-amber-400" : evt.tone === "cyan" ? "bg-cyan-400" : "bg-emerald-400"}`} />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{evt.title}</div>
                  <div className="text-xs text-slate-500">{evt.detail} · {evt.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardBase} ${lightCard} ${darkCard}`}>
          <h4 className="text-xs font-semibold text-slate-600">Zone Intelligence</h4>
          <div className="mt-3 space-y-2">
            {activeModel.derivedHeatmap?.slice(0,5).map((z: any) => (
              <div key={z.name} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{z.name}</div>
                  <div className="text-xs text-slate-500">Devices {z.devices} · {z.safe}/{z.unsafe}</div>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{z.avgScore}/100</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
