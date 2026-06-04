import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Cloud,
  CloudCog,
  Database,
  HardDriveDownload,
  Layers3,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FloatingSyncWidget from "@/components/FloatingSyncWidget";
import { db, firebaseSetupInfo, isFirebaseConfigured } from "@/firebase";
import {
  getConnectionSnapshot,
  refreshConnectionState,
  subscribeConnectionState,
} from "@/lib/connectionManager";
import {
  flushPendingDeviceOperations,
  flushPendingSignups,
  getSyncSnapshot,
  subscribeSyncSnapshot,
} from "@/lib/syncEngine";

const formatBytes = (value: number | null | undefined) => {
  if (!value || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** index;
  return `${scaled.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function CloudPage() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [syncing, setSyncing] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [connection, setConnection] = useState(getConnectionSnapshot());
  const [syncSnapshot, setSyncSnapshot] = useState(getSyncSnapshot());
  const [storageEstimate, setStorageEstimate] = useState<{ usage?: number; quota?: number } | null>(null);

  useEffect(() => subscribeConnectionState(setConnection), []);

  useEffect(() => subscribeSyncSnapshot(setSyncSnapshot), []);

  useEffect(() => {
    if (!db) return;

    const unsub = onSnapshot(
      collection(db, "devices"),
      (snap) => {
        setDocCount(snap.size);
        setLastSync(new Date().toISOString());
        setOnline(true);
      },
      (error) => {
        console.warn("Cloud probe error:", error);
        setOnline(false);
      },
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;

    navigator.storage
      .estimate()
      .then((estimate) => setStorageEstimate(estimate))
      .catch((error) => console.warn("Storage estimate unavailable:", error));
  }, []);

  const triggerSync = async () => {
    setSyncing(true);

    try {
      await Promise.all([
        refreshConnectionState(true),
        flushPendingDeviceOperations(),
        flushPendingSignups(),
      ]);
      setLastSync(new Date().toISOString());
      await refreshConnectionState(false);
    } catch (error) {
      console.warn("Cloud sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const effectiveLastSync = syncSnapshot.lastSyncAt ?? lastSync;
  const queuedOperations =
    syncSnapshot.queuedDeviceOperations.length + syncSnapshot.queuedSignups.length;
  const storageUsage =
    storageEstimate?.usage !== undefined && storageEstimate?.quota
      ? Math.round((storageEstimate.usage / storageEstimate.quota) * 100)
      : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80 sm:p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/96 via-sky-50/92 to-cyan-50/84 dark:hidden" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_36%)] opacity-80 dark:opacity-0" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">
                    Cloud monitoring center
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                    Realtime health
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${connection.status === "ONLINE" ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"}`}>
                    {connection.status}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600/90 dark:text-slate-300/80">
                    Cloud
                  </p>
                  <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
                    Dedicated cloud monitoring center
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                    Firestore connectivity, sync queue health, storage footprint,
                    and realtime connection checks all live here so the dashboard
                    can stay focused on reading workflows.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void triggerSync()}
                  disabled={syncing}
                  className="rounded-2xl bg-cyan-500 px-4 py-3 text-white shadow-sm shadow-cyan-500/25 hover:bg-cyan-600"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing" : "Sync now"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void refreshConnectionState();
                    setLastSync(new Date().toISOString());
                  }}
                  className="rounded-2xl bg-slate-800/85 px-4 py-3 text-white shadow-sm hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Refresh status
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      JSON.stringify(firebaseSetupInfo, null, 2),
                    );
                  }}
                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-600"
                >
                  <HardDriveDownload className="mr-2 h-4 w-4" />
                  Copy config
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-sky-50/90 to-cyan-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(14,165,233,0.16)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Cloud Connection Status</p>
                <div className="mt-3 flex items-center gap-3">
                  {online ? <Cloud className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> : <CloudCog className="h-5 w-5 text-rose-600 dark:text-rose-300" />}
                  <div>
                    <p className={`text-lg font-black ${online ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>
                      {online ? "Online" : "Degraded"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Firebase configured: {isFirebaseConfigured ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-slate-50/90 to-cyan-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Firestore Status</p>
                <div className="mt-3 flex items-center gap-3">
                  <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {isFirebaseConfigured ? "Configured" : "Missing config"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Documents monitored: {docCount ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-amber-50/90 to-orange-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(245,158,11,0.14)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Sync Status</p>
                <div className="mt-3 flex items-center gap-3">
                  <Server className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {syncSnapshot.syncing || syncing ? "Syncing" : "Ready"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {queuedOperations} queued items, {syncSnapshot.retryAttempts} retries
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-emerald-50/90 to-cyan-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(16,185,129,0.14)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Last Sync Time</p>
                <div className="mt-3 flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {effectiveLastSync ? new Date(effectiveLastSync).toLocaleString() : "—"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Local probe and sync engine timestamps
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-slate-50/90 to-cyan-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Database Health</p>
                <div className="mt-3 flex items-center gap-3">
                  {connection.firebaseConnected ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  )}
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {connection.firebaseConnected ? "Healthy" : "Needs attention"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {syncSnapshot.lastError ?? "Firestore heartbeat responding"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-slate-50/90 to-emerald-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Storage Usage</p>
                <div className="mt-3 flex items-center gap-3">
                  <Layers3 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {storageUsage !== null ? `${storageUsage}%` : "Unavailable"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {formatBytes(storageEstimate?.usage)} used of {formatBytes(storageEstimate?.quota)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Storage bucket: {firebaseSetupInfo.optionalKeys.includes("VITE_FIREBASE_STORAGE_BUCKET") ? "Configured" : "Not configured"}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-gradient-to-br from-white/96 via-sky-50/90 to-slate-50/84 p-4 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/60">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Realtime Connection Health</p>
                <div className="mt-3 flex items-center gap-3">
                  {connection.navigatorOnline && connection.internetReachable ? (
                    <Wifi className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                  )}
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      {connection.status}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Navigator {connection.navigatorOnline ? "online" : "offline"} · Internet {connection.internetReachable ? "reachable" : "blocked"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                  Realtime status
                </p>
                <h4 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                  Connection timeline
                </h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-white/5 dark:text-slate-200">
                Heartbeat {connection.heartbeatAt ? new Date(connection.heartbeatAt).toLocaleTimeString() : "—"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Cloud status",
                  icon: Cloud,
                  text: online ? "Connected" : "Degraded",
                  detail: connection.lastCheckedAt ? new Date(connection.lastCheckedAt).toLocaleString() : "Pending probe",
                },
                {
                  title: "Sync queue",
                  icon: Server,
                  text: `${queuedOperations} items queued`,
                  detail: `${syncSnapshot.failedRequests} failed requests`,
                },
                {
                  title: "Firestore",
                  icon: Database,
                  text: isFirebaseConfigured ? "Ready for reads/writes" : "Missing config",
                  detail: `${docCount ?? 0} device docs observed`,
                },
                {
                  title: "Last sync",
                  icon: Clock3,
                  text: effectiveLastSync ? new Date(effectiveLastSync).toLocaleTimeString() : "—",
                  detail: "Local probe and sync flush",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{item.title}</p>
                  </div>
                  <p className="mt-2 text-base font-bold text-slate-950 dark:text-white">{item.text}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>

            {syncSnapshot.lastError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-500/10 p-4 text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Latest sync error
                </div>
                <p className="mt-2 text-sm leading-6">{syncSnapshot.lastError}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                  Firestore setup
                </p>
                <h4 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                  Configuration snapshot
                </h4>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">
                {firebaseSetupInfo.missingRequiredKeys.length} missing
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Required keys
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {firebaseSetupInfo.requiredKeys.join(", ")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Optional keys
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {firebaseSetupInfo.optionalKeys.join(", ")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Project health
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {connection.firebaseConnected
                    ? "Realtime channel and database heartbeat are active."
                    : "Realtime channel is paused or awaiting Firestore availability."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <FloatingSyncWidget syncing={syncing} onSync={triggerSync} />
    </div>
  );
}
