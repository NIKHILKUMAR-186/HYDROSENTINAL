import { docSafe, getDocSafe } from "./firestoreSafe";
import { db, isFirebaseConfigured } from "@/firebase";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "FIREBASE_DISCONNECTED" | "SYNCING";

export type ConnectionSnapshot = {
  status: ConnectionStatus;
  navigatorOnline: boolean;
  internetReachable: boolean;
  firebaseConnected: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  heartbeatAt: string | null;
};

const HEARTBEAT_INTERVAL_MS = 5000;
const INTERNET_PING_URL = "https://www.gstatic.com/generate_204";
const getFirebaseHeartbeatDoc = () => {
  if (!db || !isFirebaseConfigured) return null;
  try {
    return docSafe(db, "__health", "heartbeat");
  } catch (e) {
    return null;
  }
};

const listeners = new Set<(snapshot: ConnectionSnapshot) => void>();

let monitoringStarted = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentSnapshot: ConnectionSnapshot = {
  status: "OFFLINE",
  navigatorOnline: false,
  internetReachable: false,
  firebaseConnected: false,
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

const probeFirebaseConnectivity = async () => {
  if (!canUseBrowser()) {
    return true;
  }

  try {
    const hb = getFirebaseHeartbeatDoc();
    if (!hb) return false;
    await Promise.race([getDocSafe(hb), wait(4000)]);
    return true;
  } catch {
    return false;
  }
};

const deriveStatus = (
  navigatorOnline: boolean,
  internetReachable: boolean,
  firebaseConnected: boolean,
  syncing: boolean,
): ConnectionStatus => {
  if (syncing) {
    return "SYNCING";
  }

  if (!navigatorOnline || !internetReachable) {
    return "OFFLINE";
  }

  if (!firebaseConnected) {
    return "FIREBASE_DISCONNECTED";
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
  const firebaseConnected = navigatorOnline && internetReachable ? await probeFirebaseConnectivity() : false;

  const nextSnapshot: ConnectionSnapshot = {
    status: deriveStatus(navigatorOnline, internetReachable, firebaseConnected, syncing),
    navigatorOnline,
    internetReachable,
    firebaseConnected,
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
      currentSnapshot.firebaseConnected,
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
      firebaseConnected: false,
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