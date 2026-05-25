import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cloud,
  ShieldAlert,
  Activity,
  RotateCcw,
  Zap,
} from "lucide-react";
import { readPendingDeviceOperations, flushPendingDeviceOperations, toIsoTimestamp } from "@/lib/deviceStore";
import { flushPendingSignups, getSyncSnapshot, subscribeSyncSnapshot } from "@/lib/syncEngine";
import { useToast } from "@/hooks/use-toast";

interface SyncQueueItem {
  id: string;
  type: "device_upsert" | "device_delete" | "signup";
  description: string;
  timestamp: string;
  retries?: number;
}

export const SyncMonitor: React.FC<{ userId?: string }> = ({ userId }) => {
  const { toast } = useToast();
  const [syncSnapshot, setSyncSnapshot] = useState(getSyncSnapshot());
  const [queuedItems, setQueuedItems] = useState<SyncQueueItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getSyncSnapshot().lastSyncAt);
  const prevQueuedTotal = useRef(0);
  const prevError = useRef<string | null>(null);

  const connection = syncSnapshot.connection;
  const isOnline = connection.status === "ONLINE";
  const isSyncing = syncSnapshot.syncing;

  // Monitor connection status
  useEffect(() => subscribeSyncSnapshot(setSyncSnapshot), []);

  useEffect(() => {
    if (syncSnapshot.lastSyncAt) {
      const iso = toIsoTimestamp(syncSnapshot.lastSyncAt);
      setLastSyncTime(iso ? new Date(iso).toLocaleTimeString() : String(syncSnapshot.lastSyncAt));
    }
  }, [syncSnapshot.lastSyncAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const deviceOps = readPendingDeviceOperations();

        const items: SyncQueueItem[] = [
          ...deviceOps
            .filter((op) => !userId || op.ownerUid === userId)
              .map((op) => ({
              id: `${op.type}-${op.deviceId || "unknown"}`,
              type: (op.type === "delete" ? "device_delete" : "device_upsert") as SyncQueueItem["type"],
              description: `Device ${op.type === "delete" ? "delete" : "upsert"}: ${op.deviceId}`,
              timestamp: (() => {
                const iso = toIsoTimestamp(op.queuedAt);
                try {
                  return iso ? new Date(iso).toLocaleTimeString() : String(op.queuedAt);
                } catch {
                  return String(op.queuedAt);
                }
              })(),
              retries: op.retries || 0,
            })),
        ];

        setQueuedItems(items);
      } catch (error) {
        console.error("[SyncMonitor] Error reading queue:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [userId]);

  const totalQueued = queuedItems.length + syncSnapshot.queuedSignups.length;
  const deviceOpsQueued = queuedItems.filter((item) => item.type.includes("device")).length;
  const signupOpsQueued = syncSnapshot.queuedSignups.length;

  const statusCopy = useMemo(() => {
    switch (connection.status) {
      case "ONLINE":
        return {
          label: "Cloud Connected",
          description: "Live syncing to Firestore",
          tone: "text-emerald-300",
          border: "border-emerald-400/30",
          badge: "bg-emerald-500/10 text-emerald-300",
          icon: <Cloud className="h-4 w-4" />,
        };
      case "SYNCING":
        return {
          label: "Syncing",
          description: "Syncing with Firebase...",
          tone: "text-cyan-300",
          border: "border-cyan-400/30",
          badge: "bg-cyan-500/10 text-cyan-300",
          icon: <RotateCcw className="h-4 w-4 animate-spin" />,
        };
      case "FIREBASE_DISCONNECTED":
        return {
          label: "Firebase disconnected",
          description: "Queueing changes until Firestore is reachable",
          tone: "text-amber-300",
          border: "border-amber-400/30",
          badge: "bg-amber-500/10 text-amber-300",
          icon: <ShieldAlert className="h-4 w-4" />,
        };
      default:
        return {
          label: "Offline mode",
          description: "Queued changes will sync automatically",
          tone: "text-rose-300",
          border: "border-rose-400/30",
          badge: "bg-rose-500/10 text-rose-300",
          icon: <WifiOff className="h-4 w-4" />,
        };
    }
  }, [connection.status]);

  useEffect(() => {
    if (totalQueued === 0 && prevQueuedTotal.current > 0 && syncSnapshot.lastSyncAt) {
      toast({
        title: "Synced successfully",
        description: "Pending changes were pushed to Firestore.",
      });
    }

    if (syncSnapshot.lastError && syncSnapshot.lastError !== prevError.current) {
      toast({
        title: "Sync failed",
        description: syncSnapshot.lastError,
        variant: "destructive",
      });
    }

    prevQueuedTotal.current = totalQueued;
    prevError.current = syncSnapshot.lastError;
  }, [syncSnapshot.lastError, syncSnapshot.lastSyncAt, toast, totalQueued]);

  const handleManualSync = async () => {
    if (isSyncing || totalQueued === 0) return;

    try {
      await Promise.all([flushPendingDeviceOperations(userId), flushPendingSignups()]);
      setLastSyncTime(new Date().toLocaleTimeString());
      toast({
        title: "Retry started",
        description: "Sync queue is being flushed now.",
      });
    } catch (error) {
      console.error("[SyncMonitor] Manual sync failed:", error);
      toast({
        title: "Sync failed",
        description: "Unable to complete the retry.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`rounded-2xl border p-3 shadow-xl cursor-pointer transition-all backdrop-blur-xl ${
          isOnline
            ? "bg-emerald-500/10 border-emerald-400/30"
            : "bg-slate-950/90 border-slate-800"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-400" />
          )}
          <div className="text-sm font-medium text-slate-100">
            {statusCopy.label}
            {totalQueued > 0 && <span className="ml-2 font-semibold text-cyan-300">{totalQueued} queued</span>}
          </div>
        </div>
        <div className={`text-xs mt-1 ${statusCopy.tone}`}>{statusCopy.description}</div>
        {lastSyncTime && <div className="text-xs text-slate-400 mt-1">Last sync: {lastSyncTime}</div>}
      </div>

      {isExpanded && (
        <div className="absolute bottom-16 right-0 w-96 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl p-4 max-h-[36rem] overflow-y-auto text-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Sync Control
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full border ${statusCopy.border} ${statusCopy.badge}`}>
              {connection.status}
            </span>
          </div>

          <div className={`mb-3 rounded-xl border ${statusCopy.border} bg-slate-900/80 p-3`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {statusCopy.icon}
              {statusCopy.label}
            </div>
            <div className="text-xs text-slate-400 mt-1">{statusCopy.description}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-800/80 p-2">
                <div className="text-slate-400">Internet</div>
                <div className="font-semibold">{connection.navigatorOnline && connection.internetReachable ? "Reachable" : "Unavailable"}</div>
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                <div className="text-slate-400">Firebase</div>
                <div className="font-semibold">{connection.firebaseConnected ? "Connected" : "Disconnected"}</div>
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                <div className="text-slate-400">Retries</div>
                <div className="font-semibold">{syncSnapshot.retryAttempts}</div>
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                <div className="text-slate-400">Failures</div>
                <div className="font-semibold">{syncSnapshot.failedRequests}</div>
              </div>
            </div>
          </div>

          {syncSnapshot.lastError && (
            <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <div className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Latest error
              </div>
              <div className="mt-1">{syncSnapshot.lastError}</div>
            </div>
          )}

          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-cyan-500/10 border border-cyan-400/20 p-2 rounded-xl">
              <div className="font-semibold text-cyan-200">
                {deviceOpsQueued}
              </div>
              <div className="text-cyan-300/80">Device ops</div>
            </div>
            <div className="bg-violet-500/10 border border-violet-400/20 p-2 rounded-xl">
              <div className="font-semibold text-violet-200">
                {signupOpsQueued}
              </div>
              <div className="text-violet-300/80">Signups</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 p-2 rounded-xl">
              <div className="font-semibold text-slate-100">
                {totalQueued}
              </div>
              <div className="text-slate-400">Total</div>
            </div>
          </div>

          {totalQueued === 0 ? (
            <div className="text-center py-4 text-sm text-slate-400">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
              Synced
            </div>
          ) : (
            <div className="space-y-2">
              {queuedItems.map((item) => (
                <div key={item.id} className="text-xs bg-slate-900 border border-slate-800 p-2 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-slate-100">{item.description}</div>
                      <div className="text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.timestamp}
                        {item.retries && item.retries > 0 && (
                          <span className="ml-1 text-amber-300">Retry {item.retries}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {totalQueued > 0 && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isOnline ? (isSyncing ? "Syncing..." : "Retry Sync Now") : "Waiting for connection"}
              </button>
            )}
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              {isOnline ? "Cloud Connected" : "Offline Mode Enabled"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
