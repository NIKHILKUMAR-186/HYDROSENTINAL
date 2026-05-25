import { deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";
import {
  ensureConnectionMonitoring,
  getConnectionSnapshot,
  markSyncing,
  refreshConnectionState,
  setConnectionError,
  subscribeConnectionState,
  type ConnectionSnapshot,
} from "./connectionManager";

const DEVICE_QUEUE_KEY = "hydrosentinel.pendingDeviceSync";
const SIGNUP_QUEUE_KEY = "hydrosentinel.pendingSignups";

export type DeviceRecordLike = {
  id: string;
  ownerUid: string;
  name: string;
  uniqueId: string;
  location: string;
  deviceType?: "simulator" | "real";
  latitude?: number;
  longitude?: number;
  zone?: string;
  status: "active" | "inactive";
  battery?: number;
  createdAt: string;
};

export type PendingDeviceOperation = {
  id: string;
  ownerUid: string;
  deviceId: string;
  type: "upsert" | "delete";
  payload?: DeviceRecordLike;
  queuedAt: string;
  retries?: number;
  lastError?: string;
};

export type PendingSignup = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  organizationType: string;
  organizationName?: string;
  recoveryCode: string;
  selectedRole: "user" | "admin";
  queuedAt: string;
  authUid?: string;
  syncUid?: string;
  retries?: number;
  lastError?: string;
};

export type SyncOutcome = {
  status: "synced" | "queued" | "retrying" | "failed";
  queued: boolean;
  error?: string;
};

export type SyncSnapshot = {
  connection: ConnectionSnapshot;
  queuedDeviceOperations: PendingDeviceOperation[];
  queuedSignups: PendingSignup[];
  failedRequests: number;
  retryAttempts: number;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
};

type SyncListener = (snapshot: SyncSnapshot) => void;

const listeners = new Set<SyncListener>();

let currentSnapshot: SyncSnapshot = {
  connection: getConnectionSnapshot(),
  queuedDeviceOperations: [],
  queuedSignups: [],
  failedRequests: 0,
  retryAttempts: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false,
};

const canUseBrowser = () => typeof window !== "undefined";

const readJson = <T,>(key: string, fallback: T) => {
  if (!canUseBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveJson = <T,>(key: string, value: T) => {
  if (!canUseBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeUsername = (username: string) =>
  username.toLowerCase().trim().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "");

const generateSystemId = (organization: string, username: string) => {
  const orgPart = organization
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("")
    .slice(0, 10);
  const userPart = normalizeUsername(username).slice(0, 10);
  return `${orgPart}_${userPart}`.slice(0, 20);
};

const buildSignupSyncUid = (email: string) => {
  const normalized = normalizeEmail(email);
  return `signup_${normalized.replace(/[^a-z0-9]/g, "-").slice(0, 24)}`;
};

const readDeviceQueue = () => readJson<PendingDeviceOperation[]>(DEVICE_QUEUE_KEY, []);
const readSignupQueue = () => readJson<PendingSignup[]>(SIGNUP_QUEUE_KEY, []);

const saveDeviceQueue = (queue: PendingDeviceOperation[]) => saveJson(DEVICE_QUEUE_KEY, queue);
const saveSignupQueue = (queue: PendingSignup[]) => saveJson(SIGNUP_QUEUE_KEY, queue);

const emitSnapshot = () => {
  const nextSnapshot: SyncSnapshot = {
    connection: getConnectionSnapshot(),
    queuedDeviceOperations: readDeviceQueue(),
    queuedSignups: readSignupQueue(),
    failedRequests: currentSnapshot.failedRequests,
    retryAttempts: currentSnapshot.retryAttempts,
    lastSyncAt: currentSnapshot.lastSyncAt,
    lastError: currentSnapshot.lastError,
    syncing: currentSnapshot.syncing,
  };

  currentSnapshot = nextSnapshot;
  listeners.forEach((listener) => listener(nextSnapshot));
};

const setSyncing = (syncing: boolean) => {
  currentSnapshot = {
    ...currentSnapshot,
    syncing,
    connection: getConnectionSnapshot(),
  };
  markSyncing(syncing);
  emitSnapshot();
};

const markSuccess = () => {
  currentSnapshot = {
    ...currentSnapshot,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    connection: getConnectionSnapshot(),
  };
  setConnectionError(null);
  emitSnapshot();
};

const markFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Sync failed";
  currentSnapshot = {
    ...currentSnapshot,
    failedRequests: currentSnapshot.failedRequests + 1,
    lastError: message,
    connection: getConnectionSnapshot(),
  };
  setConnectionError(message);
  emitSnapshot();
};

const shouldSyncNow = () => {
  const connection = getConnectionSnapshot();
  return connection.status === "ONLINE" || connection.status === "SYNCING";
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const withRetry = async <T,>(operation: () => Promise<T>, attempts = 3) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (attempt > 1) {
        currentSnapshot = {
          ...currentSnapshot,
          retryAttempts: currentSnapshot.retryAttempts + 1,
        };
        emitSnapshot();
      }

      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(300 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
};

const queueDeviceOperation = (operation: PendingDeviceOperation) => {
  const existing = readDeviceQueue().filter(
    (item) => item.id !== operation.id && item.deviceId !== operation.deviceId,
  );

  const nextQueue = [...existing, operation];
  saveDeviceQueue(nextQueue);
  emitSnapshot();
};

const queueSignupOperation = (signup: PendingSignup) => {
  const existing = readSignupQueue().filter(
    (item) => normalizeEmail(item.email) !== normalizeEmail(signup.email),
  );

  const nextQueue = [...existing, signup];
  saveSignupQueue(nextQueue);
  emitSnapshot();
};

const removeQueuedDeviceOperation = (deviceId: string) => {
  const nextQueue = readDeviceQueue().filter((item) => item.deviceId !== deviceId);
  saveDeviceQueue(nextQueue);
  emitSnapshot();
};

const removeQueuedSignupOperation = (email: string) => {
  const nextQueue = readSignupQueue().filter(
    (item) => normalizeEmail(item.email) !== normalizeEmail(email),
  );
  saveSignupQueue(nextQueue);
  emitSnapshot();
};

export const subscribeSyncSnapshot = (listener: SyncListener) => {
  listeners.add(listener);
  listener(currentSnapshot);

  return () => {
    listeners.delete(listener);
  };
};

export const getSyncSnapshot = () => currentSnapshot;

export const readPendingDeviceOperations = () => readDeviceQueue();
export const readPendingSignups = () => readSignupQueue();

const syncDeviceUpsertRemote = async (device: DeviceRecordLike) => {
  await Promise.all([
    setDoc(doc(db, "devices", device.id), device, { merge: true }),
    setDoc(doc(db, "users", device.ownerUid, "devices", device.id), device, { merge: true }),
  ]);
};

const syncDeviceDeleteRemote = async (ownerUid: string, deviceId: string) => {
  await Promise.all([
    deleteDoc(doc(db, "devices", deviceId)),
    deleteDoc(doc(db, "users", ownerUid, "devices", deviceId)),
  ]);
};

const processDeviceOperation = async (operation: PendingDeviceOperation) => {
  if (operation.type === "delete") {
    await withRetry(() => syncDeviceDeleteRemote(operation.ownerUid, operation.deviceId));
  } else if (operation.payload) {
    await withRetry(() => syncDeviceUpsertRemote(operation.payload as DeviceRecordLike));
  }

  removeQueuedDeviceOperation(operation.deviceId);
  markSuccess();
};

const processSignupOperation = async (signup: PendingSignup) => {
  const targetUid = signup.authUid ?? signup.syncUid ?? buildSignupSyncUid(signup.email);

  const orgForSystem =
    signup.organizationName && signup.organizationName.trim().length > 0
      ? signup.organizationName
      : signup.organizationType;
  const systemId = generateSystemId(orgForSystem || "ORG", signup.username);

  await withRetry(() =>
    setDoc(
      doc(db, "users", targetUid),
      {
        email: normalizeEmail(signup.email),
        role: signup.selectedRole,
        resetCode: signup.recoveryCode.trim(),
        fullName: signup.fullName,
        username: normalizeUsername(signup.username),
        organizationType: signup.organizationType,
        organizationName: signup.organizationName ?? null,
        organization: signup.organizationName ?? signup.organizationType,
        systemId,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        locations: signup.selectedRole === "user" ? ["default"] : [],
        uniqueId: `USER_${targetUid.slice(0, 8).toUpperCase()}`,
      },
      { merge: true },
    ),
  );

  removeQueuedSignupOperation(signup.email);
  markSuccess();
  return { uid: targetUid, systemId };
};

export const queuePendingDeviceUpsert = async (device: DeviceRecordLike): Promise<SyncOutcome> => {
  const operation: PendingDeviceOperation = {
    id: `${device.id}-upsert`,
    ownerUid: device.ownerUid,
    deviceId: device.id,
    type: "upsert",
    payload: device,
    queuedAt: new Date().toISOString(),
    retries: 0,
  };

  if (!shouldSyncNow()) {
    queueDeviceOperation(operation);
    return { status: "queued", queued: true };
  }

  setSyncing(true);
  try {
    await processDeviceOperation(operation);
    return { status: "synced", queued: false };
  } catch (error) {
    operation.retries = (operation.retries ?? 0) + 1;
    operation.lastError = error instanceof Error ? error.message : "Device sync failed";
    queueDeviceOperation(operation);
    markFailure(error);
    return { status: "queued", queued: true, error: operation.lastError };
  } finally {
    setSyncing(false);
    void refreshConnectionState();
  }
};

export const queuePendingDeviceDelete = async (
  ownerUid: string,
  deviceId: string,
): Promise<SyncOutcome> => {
  const operation: PendingDeviceOperation = {
    id: `${deviceId}-delete`,
    ownerUid,
    deviceId,
    type: "delete",
    queuedAt: new Date().toISOString(),
    retries: 0,
  };

  if (!shouldSyncNow()) {
    queueDeviceOperation(operation);
    return { status: "queued", queued: true };
  }

  setSyncing(true);
  try {
    await processDeviceOperation(operation);
    return { status: "synced", queued: false };
  } catch (error) {
    operation.retries = (operation.retries ?? 0) + 1;
    operation.lastError = error instanceof Error ? error.message : "Device delete sync failed";
    queueDeviceOperation(operation);
    markFailure(error);
    return { status: "queued", queued: true, error: operation.lastError };
  } finally {
    setSyncing(false);
    void refreshConnectionState();
  }
};

export const flushPendingDeviceOperations = async (ownerUid?: string) => {
  if (!shouldSyncNow()) {
    return { synced: 0, remaining: readDeviceQueue().length };
  }

  const queue = readDeviceQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  setSyncing(true);
  let synced = 0;
  const remaining: PendingDeviceOperation[] = [];

  try {
    for (const operation of queue) {
      if (ownerUid && operation.ownerUid !== ownerUid) {
        remaining.push(operation);
        continue;
      }

      try {
        await processDeviceOperation(operation);
        synced += 1;
      } catch (error) {
        operation.retries = (operation.retries ?? 0) + 1;
        operation.lastError = error instanceof Error ? error.message : "Device sync failed";
        remaining.push(operation);
        markFailure(error);
      }
    }
  } finally {
    saveDeviceQueue(remaining);
    emitSnapshot();
    setSyncing(false);
    void refreshConnectionState();
  }

  return { synced, remaining: remaining.length };
};

export const queuePendingSignup = async (signup: PendingSignup): Promise<SyncOutcome> => {
  if (!shouldSyncNow()) {
    queueSignupOperation(signup);
    return { status: "queued", queued: true };
  }

  setSyncing(true);
  try {
    await processSignupOperation(signup);
    return { status: "synced", queued: false };
  } catch (error) {
    signup.retries = (signup.retries ?? 0) + 1;
    signup.lastError = error instanceof Error ? error.message : "Signup sync failed";
    queueSignupOperation(signup);
    markFailure(error);
    return { status: "queued", queued: true, error: signup.lastError };
  } finally {
    setSyncing(false);
    void refreshConnectionState();
  }
};

export const removePendingSignup = (email: string) => {
  removeQueuedSignupOperation(email);
};

export const flushPendingSignups = async () => {
  if (!shouldSyncNow()) {
    return { synced: 0, remaining: readSignupQueue().length };
  }

  const queue = readSignupQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  setSyncing(true);
  let synced = 0;
  const remaining: PendingSignup[] = [];

  try {
    for (const signup of queue) {
      try {
        await processSignupOperation(signup);
        synced += 1;
      } catch (error) {
        signup.retries = (signup.retries ?? 0) + 1;
        signup.lastError = error instanceof Error ? error.message : "Signup sync failed";
        remaining.push(signup);
        markFailure(error);
      }
    }
  } finally {
    saveSignupQueue(remaining);
    emitSnapshot();
    setSyncing(false);
    void refreshConnectionState();
  }

  return { synced, remaining: remaining.length };
};

ensureConnectionMonitoring();

subscribeConnectionState((connection) => {
  currentSnapshot = {
    ...currentSnapshot,
    connection,
  };
  emitSnapshot();
});