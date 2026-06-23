import { isSupabaseConfigured, SUPABASE_URL } from "@/integrations/supabase/client";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "REMOTE_DISCONNECTED" | "SYNCING";

export type ConnectionSnapshot = {
  status: ConnectionStatus;
  navigatorOnline: boolean;
  internetReachable: boolean;
  remoteBackendConnected: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  heartbeatAt: string | null;
};

const HEARTBEAT_INTERVAL_MS = 5000;
const INTERNET_PING_URL = "https://www.gstatic.com/generate_204";
const getRemoteHeartbeatUrl = () => {
  if (!isSupabaseConfigured || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/auth/v1/health`;
};

const listeners = new Set<(snapshot: ConnectionSnapshot) => void>();

let monitoringStarted = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentSnapshot: ConnectionSnapshot = {
  status: "OFFLINE",
  navigatorOnline: false,
  internetReachable: false,
  remoteBackendConnected: false,
  lastCheckedAt: null,
  lastError: null,
  heartbeatAt: null,
};

const canUseBrowser = () => typeof window !== "undefined";

const publishSnapshot = (nextSnapshot: ConnectionSnapshot) => {
  currentSnapshot = nextSnapshot;
  listeners.forEach((listener) => listener(nextSnapshot));
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const probeInternetReachability = async () => {
  if (!canUseBrowser()) {
    return true;
  }

  try {
    await Promise.race([
      fetch(INTERNET_PING_URL, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      }),
      wait(4000),
    ]);

    return true;
  } catch {
    return false;
  }
};

const probeRemoteBackendConnectivity = async () => {
  if (!canUseBrowser()) {
    return true;
  }

  try {
    const heartbeatUrl = getRemoteHeartbeatUrl();
    if (!heartbeatUrl) return false;

    const response = await Promise.race([
      fetch(heartbeatUrl, {
        method: "GET",
        cache: "no-store",
      }),
      wait(4000),
    ]);

    return response instanceof Response ? response.ok : false;
  } catch {
    return false;
  }
};

const deriveStatus = (
  navigatorOnline: boolean,
  internetReachable: boolean,
  remoteBackendConnected: boolean,
  syncing: boolean,
): ConnectionStatus => {
  if (syncing) {
    return "SYNCING";
  }

  if (!navigatorOnline || !internetReachable) {
    return "OFFLINE";
  }

  if (!remoteBackendConnected) {
    return "REMOTE_DISCONNECTED";
  }

  return "ONLINE";
};

export const getConnectionSnapshot = () => currentSnapshot;

export const subscribeConnectionState = (listener: (snapshot: ConnectionSnapshot) => void) => {
  listeners.add(listener);
  listener(currentSnapshot);

  return () => {
    listeners.delete(listener);
  };
};

export const refreshConnectionState = async (syncing = false) => {
  if (!canUseBrowser()) {
    return currentSnapshot;
  }

  const navigatorOnline = window.navigator.onLine;
  const internetReachable = navigatorOnline ? await probeInternetReachability() : false;
  const remoteBackendConnected = navigatorOnline && internetReachable ? await probeRemoteBackendConnectivity() : false;

  const nextSnapshot: ConnectionSnapshot = {
    status: deriveStatus(navigatorOnline, internetReachable, remoteBackendConnected, syncing),
    navigatorOnline,
    internetReachable,
    remoteBackendConnected,
    lastCheckedAt: new Date().toISOString(),
    lastError: currentSnapshot.lastError,
    heartbeatAt: new Date().toISOString(),
  };

  publishSnapshot(nextSnapshot);
  return nextSnapshot;
};

const scheduleHeartbeat = () => {
  if (!canUseBrowser()) {
    return;
  }

  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
  }

  heartbeatTimer = window.setInterval(() => {
    void refreshConnectionState();
  }, HEARTBEAT_INTERVAL_MS);
};

export const setConnectionError = (message: string | null) => {
  publishSnapshot({
    ...currentSnapshot,
    lastError: message,
    lastCheckedAt: new Date().toISOString(),
  });
};

export const markSyncing = (syncing: boolean) => {
  publishSnapshot({
    ...currentSnapshot,
    status: deriveStatus(
      currentSnapshot.navigatorOnline,
      currentSnapshot.internetReachable,
      currentSnapshot.remoteBackendConnected,
      syncing,
    ),
    lastCheckedAt: new Date().toISOString(),
  });
};

export const ensureConnectionMonitoring = () => {
  if (!canUseBrowser() || monitoringStarted) {
    return;
  }

  monitoringStarted = true;

  const handleOnline = () => {
    void refreshConnectionState();
  };

  const handleOffline = () => {
    publishSnapshot({
      ...currentSnapshot,
      status: "OFFLINE",
      navigatorOnline: false,
      internetReachable: false,
      remoteBackendConnected: false,
      lastCheckedAt: new Date().toISOString(),
    });
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  scheduleHeartbeat();
  void refreshConnectionState();
};

if (canUseBrowser()) {
  ensureConnectionMonitoring();
}