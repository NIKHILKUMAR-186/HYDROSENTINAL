import React, { useEffect, useMemo, useState } from "react";
import { toIsoTimestamp } from "@/lib/deviceStore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import {
  getParallaxVariants,
  getStaggerContainerVariants,
  getFadeSlideUpVariants,
  get3DCardVariants,
} from "@/hooks/useAnimationUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBanner } from "@/components/StatusBanner";
import { SensorCard } from "@/components/SensorCard";
import { WaterGraph } from "@/components/WaterGraph";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  Users,
  LogOut,
  Cpu,
  Table2,
  Database,
  MapPin,
  Search,
  PencilLine,
  Trash2,
  UserRoundCog,
  ChevronRight,
  ShieldAlert,
  Eye,
  Wifi,
  WifiOff,
  Clock3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DeviceRecord,
  DeviceReading,
  appendLocalDeviceReading,
  getLocalDeviceHistory,
  getLocalDevicesByOwner,
  removeLocalDevice,
  readLocalDevices,
  normalizeDeviceReading,
  upsertLocalDevice,
} from "@/lib/deviceStore";

type UserRole = "user" | "admin";

type UserSummary = {
  id: string;
  email: string;
  role: UserRole;
  deviceCount?: number;
  name?: string;
  organization?: string;
  phone?: string;
  locations?: string[];
  uniqueId?: string;
  createdAt?: string;
  lastLoginAt?: string;
  provider?: string;
  resetCode?: string;
};

type UserEditForm = {
  email: string;
  name: string;
  organization: string;
  phone: string;
  uniqueId: string;
  locations: string;
  resetCode: string;
  createdAt: string;
  lastLoginAt: string;
};

type DeviceEditForm = {
  name: string;
  uniqueId: string;
  location: string;
  zone: string;
  status: DeviceRecord["status"];
  deviceType: "simulator" | "real";
  battery: string;
  latitude: string;
  longitude: string;
  createdAt: string;
};

const DEMO_USERS: UserSummary[] = [];

const LOCAL_ACCOUNTS_KEY = "hydrosentinel.localAccounts";

const DEMO_ACCOUNT_EMAILS = new Set(["user@demo.com", "admin@demo.com"]);

const formatDate = (value?: unknown) => {
  if (!value) return "-";

  const iso = toIsoTimestamp(value);
  const date = iso ? new Date(iso) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const toTimeValue = (value?: unknown) => {
  if (!value) return 0;

  const iso = toIsoTimestamp(value);
  const parsed = iso ? new Date(iso) : new Date(String(value));
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : 0;
};

const getDeviceOwnerUid = (device: Record<string, unknown>) => {
  const fallbackOwner = typeof device.ownerUid === "string" ? device.ownerUid : "";
  if (fallbackOwner) return fallbackOwner;

  const legacyOwner = device.ownerId;
  return typeof legacyOwner === "string" ? legacyOwner : "";
};

const getDeviceSyncScore = (device: DeviceRecord) => {
  const hasLocation = Number.isFinite(device.latitude) && Number.isFinite(device.longitude);
  const hasZone = Boolean(device.zone);
  const hasAddress = Boolean(device.location?.trim());
  const updatedAt = Math.max(
    toTimeValue(device.lastLocationUpdate),
    toTimeValue(device.createdAt),
  );

  return [updatedAt, hasLocation ? 1 : 0, hasZone ? 1 : 0, hasAddress ? 1 : 0] as const;
};

const compareDeviceFreshness = (left: DeviceRecord, right: DeviceRecord) => {
  const leftScore = getDeviceSyncScore(left);
  const rightScore = getDeviceSyncScore(right);

  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) {
      return rightScore[index] - leftScore[index];
    }
  }

  return 0;
};

const mergeDeviceRecords = (primary: DeviceRecord[], fallback: DeviceRecord[]) => {
  const merged = new Map<string, DeviceRecord>();

  [...fallback, ...primary].forEach((entry) => {
    const current = merged.get(entry.id);
    if (!current || compareDeviceFreshness(current, entry) > 0) {
      merged.set(entry.id, entry);
    }
  });

  return Array.from(merged.values()).sort((left, right) =>
    String(left.name ?? left.id).localeCompare(String(right.name ?? right.id))
  );
};

const hasConfiguredLocation = (device: DeviceRecord) =>
  Number.isFinite(device.latitude) && Number.isFinite(device.longitude);

const getSyncFreshnessMeta = (value?: string | null) => {
  const elapsedMs = value ? Date.now() - toTimeValue(value) : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(elapsedMs) || elapsedMs === Number.POSITIVE_INFINITY) {
    return {
      label: "No sync yet",
      description: "Waiting for Firestore snapshots",
      percent: 0,
      tone: "amber" as const,
    };
  }

  if (elapsedMs < 15000) {
    return {
      label: "Fresh",
      description: "Updated just now",
      percent: 100,
      tone: "emerald" as const,
    };
  }

  if (elapsedMs < 60000) {
    return {
      label: "Warm",
      description: `${Math.ceil(elapsedMs / 1000)}s ago`,
      percent: 70,
      tone: "cyan" as const,
    };
  }

  if (elapsedMs < 300000) {
    return {
      label: "Stale",
      description: `${Math.ceil(elapsedMs / 60000)}m ago`,
      percent: 35,
      tone: "amber" as const,
    };
  }

  return {
    label: "Degraded",
    description: `${Math.ceil(elapsedMs / 60000)}m ago`,
    percent: 12,
    tone: "rose" as const,
  };
};

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatList = (value?: string[]) => (value && value.length ? value.join(", ") : "");

const isDemoUser = (user: UserSummary) =>
  user.id.startsWith("demo-") || DEMO_ACCOUNT_EMAILS.has(user.email.toLowerCase());

const updateLocalAccountEmail = (userId: string, nextEmail: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rawAccounts = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!rawAccounts) {
      return;
    }

    const parsed = JSON.parse(rawAccounts) as Array<{
      uid: string;
      email: string;
      password: string;
      role: UserRole;
      [key: string]: unknown;
    }>;

    const nextAccounts = parsed.map((account) =>
      account.uid === userId ? { ...account, email: nextEmail } : account
    );

    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  } catch {
    // Local account sync is best-effort only.
  }
};

const deleteLocalAccount = (userId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rawAccounts = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!rawAccounts) {
      return;
    }

    const parsed = JSON.parse(rawAccounts) as Array<{ uid: string }>;
    const nextAccounts = parsed.filter((account) => account.uid !== userId);
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  } catch {
    // Best-effort only.
  }
};

const readLocalUsers = (): UserSummary[] => {
  if (typeof window === "undefined") {
    return DEMO_USERS;
  }

  try {
    const rawAccounts = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!rawAccounts) {
      return DEMO_USERS;
    }

    const parsed = JSON.parse(rawAccounts) as Array<{
      uid: string;
      email: string;
      role: UserRole;
      deviceCount?: number;
    }>;

    const localMapped: UserSummary[] = parsed.map((item) => ({
      id: item.uid,
      email: item.email,
      role: item.role,
      deviceCount: item.deviceCount,
    }));

    const unique = new Map<string, UserSummary>();
    [...DEMO_USERS, ...localMapped].forEach((entry) => unique.set(entry.id, entry));
    return Array.from(unique.values());
  } catch {
    return DEMO_USERS;
  }
};

export const AdminPanel = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [rootDevices, setRootDevices] = useState<DeviceRecord[]>([]);
  const [nestedDevices, setNestedDevices] = useState<DeviceRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<DeviceReading[]>([]);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataReadingsByDevice, setDataReadingsByDevice] = useState<
    Record<string, DeviceReading[]>
  >({});
  const [readingSearch, setReadingSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [isDeviceEditOpen, setIsDeviceEditOpen] = useState(false);
  const [usersSyncMode, setUsersSyncMode] = useState<"loading" | "live" | "degraded" | "fallback">("loading");
  const [devicesSyncMode, setDevicesSyncMode] = useState<"loading" | "live" | "degraded" | "fallback">("loading");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserEditForm>({
    email: "",
    name: "",
    organization: "",
    phone: "",
    uniqueId: "",
    locations: "",
    resetCode: "",
    createdAt: "",
    lastLoginAt: "",
  });
  const [deviceForm, setDeviceForm] = useState<DeviceEditForm>({
    name: "",
    uniqueId: "",
    location: "",
    zone: "",
    status: "active",
    deviceType: "simulator",
    battery: "",
    latitude: "",
    longitude: "",
    createdAt: "",
  });

  useEffect(() => {
    if (!loading && role !== "admin") {
      navigate("/");
    }
  }, [role, loading, navigate]);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (usersSnap) => {
        const remoteUsers: UserSummary[] = usersSnap.docs.map((item) => {
          const data = item.data() as {
            email?: string;
            role?: UserRole;
            deviceCount?: number;
            name?: string;
            organization?: string;
            phone?: string;
            locations?: string[];
            uniqueId?: string;
            createdAt?: string;
            lastLoginAt?: string;
            provider?: string;
            resetCode?: string;
          };

          return {
            id: item.id,
            email: data.email ?? "unknown@user",
            role: data.role ?? "user",
            deviceCount: data.deviceCount ?? 0,
            name: data.name,
            organization: data.organization,
            phone: data.phone,
            locations: data.locations,
            uniqueId: data.uniqueId,
            createdAt: data.createdAt,
            lastLoginAt: data.lastLoginAt,
            provider: data.provider,
            resetCode: data.resetCode,
          };
        });

        console.debug("[AdminPanel] remote users snapshot", {
          count: remoteUsers.length,
          userIds: remoteUsers.map((u) => u.id).slice(0, 20),
        });

        setUsers(remoteUsers);
        setUsersSyncMode("live");
        setLastSyncAt(new Date().toISOString());
        setSelectedUserId((prev) =>
          prev ?? remoteUsers.find((u) => u.role === "user")?.id ?? remoteUsers[0]?.id ?? null
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error loading admin users:", error);
        const fallbackUsers = readLocalUsers();
        setUsers(fallbackUsers);
        setUsersSyncMode((prev) => (prev === "live" ? "degraded" : "fallback"));
        setLastSyncAt(new Date().toISOString());
        setSelectedUserId((prev) =>
          prev ?? fallbackUsers.find((u) => u.role === "user")?.id ?? fallbackUsers[0]?.id ?? null
        );
        setLoading(false);
      }
    );

    const unsubscribeRootDevices = onSnapshot(
      collection(db, "devices"),
      (devicesSnap) => {
        const rootDeviceList: DeviceRecord[] = devicesSnap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<DeviceRecord, "id">),
          ownerUid: getDeviceOwnerUid(item.data() as Record<string, unknown>) || user?.uid || "",
        }));

        console.debug("[AdminPanel] root devices snapshot", {
          count: rootDeviceList.length,
          sample: rootDeviceList.slice(0, 10).map((device) => ({ id: device.id, ownerUid: device.ownerUid })),
        });

        setRootDevices(rootDeviceList);
        setDevicesSyncMode("live");
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
      },
      (error) => {
        console.error("Error loading root admin devices:", error);
        setRootDevices(readLocalDevices());
        setDevicesSyncMode((prev) => (prev === "live" ? "degraded" : "fallback"));
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
      }
    );

    const unsubscribeNestedDevices = onSnapshot(
      collectionGroup(db, "devices"),
      (devicesSnap) => {
        const nestedDeviceList: DeviceRecord[] = devicesSnap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<DeviceRecord, "id">),
          ownerUid: getDeviceOwnerUid(item.data() as Record<string, unknown>) || user?.uid || "",
        }));

        console.debug("[AdminPanel] nested devices snapshot", {
          count: nestedDeviceList.length,
          sample: nestedDeviceList.slice(0, 10).map((device) => ({ id: device.id, ownerUid: device.ownerUid })),
        });

        setNestedDevices(nestedDeviceList);
        setDevicesSyncMode("live");
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
      },
      (error) => {
        console.error("Error loading nested admin devices:", error);
        setNestedDevices([]);
        setDevicesSyncMode((prev) => (prev === "live" ? "degraded" : "fallback"));
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRootDevices();
      unsubscribeNestedDevices();
    };
  }, []);

  const selectedUser = users.find((entry) => entry.id === selectedUserId) ?? null;
  const rootDeviceCount = rootDevices.length;
  const nestedDeviceCount = nestedDevices.length;
  const dedupedDeviceCount = devices.length;
  const syncFreshnessMeta = getSyncFreshnessMeta(lastSyncAt);
  const selectedUserDetails = useMemo(() => {
    if (!selectedUser) {
      return [] as Array<{ label: string; value: string }>;
    }

    return [
      { label: "Email", value: selectedUser.email },
      { label: "Role", value: selectedUser.role },
      { label: "User ID", value: selectedUser.id },
      { label: "Unique ID", value: selectedUser.uniqueId ?? "-" },
      { label: "Phone", value: selectedUser.phone ?? "-" },
      { label: "Organization", value: selectedUser.organization ?? "-" },
      { label: "Provider", value: selectedUser.provider ?? "firebase/local" },
      { label: "Created At", value: formatDate(selectedUser.createdAt) },
      { label: "Last Login", value: formatDate(selectedUser.lastLoginAt) },
      { label: "Locations", value: selectedUser.locations?.join(", ") || "-" },
      { label: "Recovery Code", value: selectedUser.resetCode ?? "-" },
    ];
  }, [selectedUser]);
  useEffect(() => {
    setDevices(mergeDeviceRecords(rootDevices, nestedDevices));
  }, [rootDevices, nestedDevices]);

  const selectedUserDevices = useMemo(
    () => devices.filter((device) => getDeviceOwnerUid(device) === selectedUserId),
    [devices, selectedUserId]
  );

  const selectedDevice = useMemo(
    () => selectedUserDevices.find((device) => device.id === selectedDeviceId) ?? null,
    [selectedDeviceId, selectedUserDevices]
  );

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    console.debug("[AdminPanel] selected user device mapping", {
      selectedUserId,
      matchedCount: selectedUserDevices.length,
      sample: selectedUserDevices.slice(0, 10).map((device) => ({ id: device.id, ownerUid: device.ownerUid })),
    });
  }, [selectedUserDevices, selectedUserId]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    setUserForm({
      email: selectedUser.email,
      name: selectedUser.name ?? "",
      organization: selectedUser.organization ?? "",
      phone: selectedUser.phone ?? "",
      uniqueId: selectedUser.uniqueId ?? "",
      locations: formatList(selectedUser.locations),
      resetCode: selectedUser.resetCode ?? "",
      createdAt: selectedUser.createdAt ?? "",
      lastLoginAt: selectedUser.lastLoginAt ?? "",
    });
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedDevice) {
      return;
    }

    setDeviceForm({
      name: selectedDevice.name ?? "",
      uniqueId: selectedDevice.uniqueId ?? "",
      location: selectedDevice.location ?? "",
      zone: selectedDevice.zone ?? "",
      status: selectedDevice.status,
      deviceType: selectedDevice.deviceType ?? "simulator",
      battery: selectedDevice.battery?.toString() ?? "",
      latitude: selectedDevice.latitude?.toString() ?? "",
      longitude: selectedDevice.longitude?.toString() ?? "",
      createdAt: selectedDevice.createdAt ?? "",
    });
  }, [selectedDevice]);

  useEffect(() => {
    setSelectedDeviceId(selectedUserDevices[0]?.id ?? null);
  }, [selectedUserId, selectedUserDevices]);

  useEffect(() => {
    if (!selectedDevice) {
      setSelectedHistory([]);
      return;
    }

    const readingsRef = collection(db, "users", selectedDevice.ownerUid, "devices", selectedDevice.id, "readings");
    const unsubscribeReadings = onSnapshot(
      readingsRef,
      (snapshot) => {
        const readings = snapshot.docs.map((item) =>
          normalizeDeviceReading(item.data() as Record<string, unknown>),
        );
        console.debug("[AdminPanel] selected device history snapshot", {
          deviceId: selectedDevice.id,
          ownerUid: selectedDevice.ownerUid,
          count: readings.length,
        });

        if (readings.length > 0) {
          setSelectedHistory(readings);
          return;
        }

        setSelectedHistory(getLocalDeviceHistory(selectedDevice.id));
      },
      (error) => {
        console.error("Error loading selected device history:", error);
        setSelectedHistory(getLocalDeviceHistory(selectedDevice.id));
      }
    );

    return () => unsubscribeReadings();
  }, [selectedDevice]);

  const usersWithDeviceCount = useMemo(
    () =>
      users.map((entry) => ({
        ...entry,
        deviceCount: devices.filter((device) => getDeviceOwnerUid(device) === entry.id).length,
      })),
    [devices, users]
  );

  const deviceHealthByUser = useMemo(() => {
    return users.reduce<Record<string, {
      total: number;
      withLocation: number;
      safe: number;
      unsafe: number;
    }>>((acc, entry) => {
      const ownedDevices = devices.filter((device) => getDeviceOwnerUid(device) === entry.id);
      const withLocation = ownedDevices.filter(
        (device) => Number.isFinite(device.latitude) && Number.isFinite(device.longitude),
      ).length;
      const safe = ownedDevices.filter((device) => device.status === "active").length;
      const unsafe = ownedDevices.length - safe;

      acc[entry.id] = {
        total: ownedDevices.length,
        withLocation,
        safe,
        unsafe,
      };

      return acc;
    }, {});
  }, [devices, users]);

  const selectedUserDeviceHealth = selectedUserId ? deviceHealthByUser[selectedUserId] : undefined;

  const filteredReadingsByDevice = useMemo(() => {
    const query = readingSearch.trim().toLowerCase();

    if (!query) {
      return dataReadingsByDevice;
    }

    return Object.fromEntries(
      Object.entries(dataReadingsByDevice).map(([deviceId, readings]) => [
        deviceId,
        readings.filter((reading) => {
          const values = [
            reading.timestamp,
            reading.status,
            reading.ph?.toString(),
            reading.tds?.toString(),
            reading.turbidity?.toString(),
            reading.temperature?.toString(),
          ]
            .join(" ")
            .toLowerCase();

          return values.includes(query);
        }),
      ])
    );
  }, [dataReadingsByDevice, readingSearch]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const openUserDrawer = (nextUserId: string) => {
    setSelectedUserId(nextUserId);
    setIsUserDrawerOpen(true);
  };

  const openDeviceEditor = (device: DeviceRecord) => {
    setSelectedDeviceId(device.id);
    setDeviceForm({
      name: device.name ?? "",
      uniqueId: device.uniqueId ?? "",
      location: device.location ?? "",
      zone: device.zone ?? "",
      status: device.status,
      deviceType: device.deviceType ?? "simulator",
      battery: device.battery?.toString() ?? "",
      latitude: device.latitude?.toString() ?? "",
      longitude: device.longitude?.toString() ?? "",
      createdAt: device.createdAt ?? "",
    });
    setIsDeviceEditOpen(true);
  };

  const saveUserChanges = async () => {
    if (!selectedUser) {
      return;
    }

    setActionLoading(true);
    try {
      const nextEmail = userForm.email.trim();
      const payload = {
        email: nextEmail,
        name: userForm.name.trim(),
        organization: userForm.organization.trim(),
        phone: userForm.phone.trim(),
        uniqueId: userForm.uniqueId.trim(),
        locations: parseList(userForm.locations),
        resetCode: userForm.resetCode.trim(),
        createdAt: userForm.createdAt.trim() || selectedUser.createdAt || new Date().toISOString(),
        lastLoginAt: userForm.lastLoginAt.trim() || selectedUser.lastLoginAt || new Date().toISOString(),
        role: selectedUser.role,
      };

      await setDoc(doc(db, "users", selectedUser.id), payload, { merge: true });

      if (nextEmail !== selectedUser.email) {
        updateLocalAccountEmail(selectedUser.id, nextEmail);
      }

      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === selectedUser.id
            ? {
                ...entry,
                ...payload,
              }
            : entry
        )
      );

      setIsUserEditOpen(false);
      setIsUserDrawerOpen(false);
    } catch (error) {
      console.error("Failed to save user changes:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUserTree = async (targetUserId: string) => {
    const userDevicesSnapshot = await getDocs(collection(db, "users", targetUserId, "devices"));
    const rootDevicesSnapshot = await getDocs(
      query(collection(db, "devices"), where("ownerUid", "==", targetUserId))
    );

    for (const item of userDevicesSnapshot.docs) {
      const readingsSnapshot = await getDocs(collection(db, "users", targetUserId, "devices", item.id, "readings"));

      await Promise.all(readingsSnapshot.docs.map((reading) => deleteDoc(reading.ref)));

      try {
        await deleteDoc(doc(db, "devices", item.id));
      } catch {
        // Root mirror may be unavailable.
      }

      await deleteDoc(item.ref);
      removeLocalDevice(item.id);
    }

    for (const item of rootDevicesSnapshot.docs) {
      await deleteDoc(item.ref);
      removeLocalDevice(item.id);
    }

    await deleteDoc(doc(db, "users", targetUserId));
    deleteLocalAccount(targetUserId);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || isDemoUser(selectedUser)) {
      return;
    }

    if (!window.confirm(`Delete ${selectedUser.email} and all linked devices?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteUserTree(selectedUser.id);
      setUsers((prev) => prev.filter((entry) => entry.id !== selectedUser.id));
      setDevices((prev) => prev.filter((device) => device.ownerUid !== selectedUser.id));
      setSelectedUserId((prev) => (prev === selectedUser.id ? users.find((entry) => entry.id !== selectedUser.id && entry.role === "user")?.id ?? null : prev));
      setIsUserDrawerOpen(false);
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const saveDeviceChanges = async () => {
    if (!selectedDevice || !selectedUser) {
      return;
    }

    setActionLoading(true);
    try {
      const nextBattery = deviceForm.battery.trim();
      const nextLatitude = deviceForm.latitude.trim();
      const nextLongitude = deviceForm.longitude.trim();

      const payload: Omit<DeviceRecord, "id"> = {
        ownerUid: selectedDevice.ownerUid,
        name: deviceForm.name.trim(),
        uniqueId: deviceForm.uniqueId.trim(),
        location: deviceForm.location.trim(),
        zone: deviceForm.zone.trim(),
        status: deviceForm.status,
        deviceType: deviceForm.deviceType,
        battery: nextBattery ? Number(nextBattery) : undefined,
        latitude: nextLatitude ? Number(nextLatitude) : undefined,
        longitude: nextLongitude ? Number(nextLongitude) : undefined,
        createdAt: deviceForm.createdAt.trim() || selectedDevice.createdAt,
      };

      await Promise.all([
        setDoc(doc(db, "devices", selectedDevice.id), payload, { merge: true }),
        setDoc(doc(db, "users", selectedDevice.ownerUid, "devices", selectedDevice.id), payload, {
          merge: true,
        }),
      ]);

      const updated = { id: selectedDevice.id, ...payload };
      upsertLocalDevice(updated);
      setDevices((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setIsDeviceEditOpen(false);
    } catch (error) {
      console.error("Failed to save device changes:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDevice = async (device: DeviceRecord) => {
    if (!selectedUser || !window.confirm(`Delete device ${device.name}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const readingsSnapshot = await getDocs(
        collection(db, "users", device.ownerUid, "devices", device.id, "readings")
      );

      await Promise.all(readingsSnapshot.docs.map((reading) => deleteDoc(reading.ref)));
      await Promise.all([
        deleteDoc(doc(db, "users", device.ownerUid, "devices", device.id)),
        deleteDoc(doc(db, "devices", device.id)),
      ]);

      removeLocalDevice(device.id);
      setDevices((prev) => prev.filter((entry) => entry.id !== device.id));
      if (selectedDeviceId === device.id) {
        setSelectedDeviceId(null);
      }
    } catch (error) {
      console.error("Failed to delete device:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenData = () => {
    if (!selectedUser) {
      return;
    }

    console.debug("[AdminPanel] opening data panel for user", {
      selectedUserId,
      selectedUserEmail: selectedUser.email,
      selectedDeviceCount: selectedUserDevices.length,
    });

    setDataReadingsByDevice({});
    setShowDataPanel(true);
    setDataLoading(true);
  };

  useEffect(() => {
    if (!showDataPanel || !selectedUser || selectedUserDevices.length === 0) {
      return;
    }

    setDataReadingsByDevice({});
    const unsubscribes = selectedUserDevices.map((device) => {
      const readingsRef = collection(db, "users", device.ownerUid, "devices", device.id, "readings");
      return onSnapshot(
        readingsRef,
        (snapshot) => {
          const readings = snapshot.docs.map((item) =>
            normalizeDeviceReading(item.data() as Record<string, unknown>),
          );
          console.debug("[AdminPanel] realtime data panel reading update", {
            deviceId: device.id,
            ownerUid: device.ownerUid,
            count: readings.length,
          });

          setDataReadingsByDevice((prev) => ({
            ...prev,
            [device.id]: readings.length > 0 ? readings : getLocalDeviceHistory(device.id).slice(-10),
          }));
          setDataLoading(false);
        },
        (error) => {
          console.error("Error loading data panel readings:", error, {
            deviceId: device.id,
            ownerUid: device.ownerUid,
          });
          setDataReadingsByDevice((prev) => ({
            ...prev,
            [device.id]: getLocalDeviceHistory(device.id).slice(-10),
          }));
          setDataLoading(false);
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [showDataPanel, selectedUser, selectedUserDevices]);

  const latestReading = selectedHistory.length ? selectedHistory[selectedHistory.length - 1] : null;
  const tdsData = selectedHistory.map((item, index) => ({
    time: index + 1,
    tds: item.tds,
  }));
  const phTurbidityData = selectedHistory.map((item, index) => ({
    time: index + 1,
    ph: item.ph,
    turbidity: item.turbidity,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-slate-950 dark:text-white">
      <div className="bg-white/95 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-50 shadow-sm backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">Admin User Monitoring</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Track users and registered devices</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
              usersSyncMode === "live" && devicesSyncMode === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : usersSyncMode === "fallback" || devicesSyncMode === "fallback"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            }`}>
              {usersSyncMode === "live" && devicesSyncMode === "live" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {usersSyncMode === "live" && devicesSyncMode === "live"
                ? "Live Firestore Sync"
                : usersSyncMode === "fallback" || devicesSyncMode === "fallback"
                  ? "Fallback Data Active"
                  : "Syncing..."}
              <span className="font-normal opacity-80">Users {users.length}</span>
              <span className="font-normal opacity-80">Root {rootDeviceCount}</span>
              <span className="font-normal opacity-80">Nested {nestedDeviceCount}</span>
              <span className="font-normal opacity-80">Unique {dedupedDeviceCount}</span>
              {lastSyncAt ? <span className="font-normal opacity-80">{new Date(lastSyncAt).toLocaleTimeString()}</span> : null}
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-sm">{user?.email}</span>
            <ThemeToggle />
            <Button onClick={handleLogout} className="premium-button  inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm shadow-slate-900/10 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800/80">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="premium-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-600 mb-3">Users</p>
            <h3 className="text-3xl font-black text-slate-950 dark:text-white">{usersWithDeviceCount.length}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Total accounts monitored</p>
          </div>
          <div className="premium-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-600 mb-3">Connected Devices</p>
            <h3 className="text-3xl font-black text-slate-950 dark:text-white">{devices.length}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Active devices across all users</p>
          </div>
          <div className="premium-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-600 mb-3">Selected User</p>
            <h3 className="text-3xl font-black text-slate-950 dark:text-white">{selectedUser?.email ?? "None"}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Inspect device history and performance</p>
          </div>
          <div className="premium-card p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-600 mb-3">Device View</p>
            <h3 className="text-3xl font-black text-slate-950 dark:text-white">{selectedUserDevices.length}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Devices owned by selected user</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="page-panel p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Users</h2>
            </div>

            <div className="space-y-3">
              {usersWithDeviceCount.length === 0 ? (
                <p className="text-gray-400 text-sm">No users found.</p>
              ) : (
                usersWithDeviceCount.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-3xl border p-3 transition duration-200 ${
                      selectedUserId === entry.id
                        ? "border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/10"
                        : "border-slate-200/80 bg-white/95 hover:border-cyan-500/20 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-cyan-500/20 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(entry.id)}
                      className="w-full text-left"
                    >
                      <p className="text-slate-950 text-sm font-semibold dark:text-white">{entry.email}</p>
                      <p className="text-cyan-700 text-xs mt-1 dark:text-cyan-300">Devices: {entry.deviceCount}</p>
                      <p className="text-slate-500 text-[11px] mt-1 dark:text-slate-400">User ID: {entry.id}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-medium">
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-700 dark:text-emerald-200">
                          {deviceHealthByUser[entry.id]?.withLocation ?? 0} loc-ready
                        </span>
                        <span className="rounded-full bg-slate-500/15 px-2 py-1 text-slate-700 dark:text-slate-200">
                          {deviceHealthByUser[entry.id]?.safe ?? 0} active
                        </span>
                        <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-700 dark:text-red-200">
                          {deviceHealthByUser[entry.id]?.unsafe ?? 0} inactive
                        </span>
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => openUserDrawer(entry.id)}
                        className="h-8 rounded-full bg-slate-900 px-3 text-xs text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Details
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(entry.id);
                          setIsUserEditOpen(true);
                        }}
                        disabled={isDemoUser(entry)}
                        className="h-8 rounded-full bg-cyan-500 px-3 text-xs text-white hover:bg-cyan-600 disabled:opacity-50"
                      >
                        <PencilLine className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(entry.id);
                          void handleDeleteUser();
                        }}
                        disabled={isDemoUser(entry)}
                        className="h-8 rounded-full bg-red-500 px-3 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="page-panel p-6"
          >
            {selectedUser ? (
              <>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedUser.email}</h2>
                    <p className="text-sm text-gray-400">User ID: {selectedUser.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                      onClick={() => setIsUserDrawerOpen(true)}
                      className="border border-slate-600 bg-transparent text-white hover:bg-slate-800 flex items-center gap-2"
                    >
                      <UserRoundCog className="w-4 h-4" />
                      View Details
                    </Button>
                    <Button
                      onClick={() => setIsUserEditOpen(true)}
                      disabled={isDemoUser(selectedUser)}
                      className="border border-cyan-500 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 flex items-center gap-2 disabled:opacity-50"
                    >
                      <PencilLine className="w-4 h-4" />
                      Edit User
                    </Button>
                    <Button
                      onClick={() => void handleDeleteUser()}
                      disabled={isDemoUser(selectedUser)}
                      className="border border-red-500 bg-red-500/15 text-red-100 hover:bg-red-500/25 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete User
                    </Button>
                    <Button onClick={() => void handleOpenData()} className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white flex items-center gap-2 shadow-lg shadow-cyan-500/15">
                      <Table2 className="w-4 h-4" />
                      {dataLoading ? "Loading..." : "Data"}
                    </Button>
                    <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                      Total Devices: <span className="text-cyan-700 font-semibold dark:text-cyan-300">{selectedUserDevices.length}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-5 grid gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Sync Source</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {usersSyncMode === "live" && devicesSyncMode === "live"
                        ? "Firestore live"
                        : usersSyncMode === "fallback" || devicesSyncMode === "fallback"
                          ? "Fallback mode"
                          : "Syncing..."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Selected Devices</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{selectedUserDeviceHealth?.total ?? selectedUserDevices.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Location Coverage</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {selectedUserDeviceHealth?.withLocation ?? selectedUserDevices.filter((device) => Number.isFinite(device.latitude) && Number.isFinite(device.longitude)).length}
                      /{selectedUserDevices.length || 1}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Status Mix</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {selectedUserDeviceHealth?.safe ?? 0} active / {selectedUserDeviceHealth?.unsafe ?? 0} inactive
                    </p>
                  </div>
                </div>

                <div className="mb-5 rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Sync Freshness
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">
                          {syncFreshnessMeta.label}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {syncFreshnessMeta.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        syncFreshnessMeta.tone === "emerald"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                          : syncFreshnessMeta.tone === "cyan"
                            ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200"
                            : syncFreshnessMeta.tone === "amber"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                      }`}
                    >
                      {syncFreshnessMeta.percent}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        syncFreshnessMeta.tone === "emerald"
                          ? "bg-emerald-500"
                          : syncFreshnessMeta.tone === "cyan"
                            ? "bg-cyan-500"
                            : syncFreshnessMeta.tone === "amber"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                      }`}
                      style={{ width: `${syncFreshnessMeta.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedUserDetails.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                    <Database className="h-4 w-4 text-cyan-500" />
                    Firestore linked
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                    <MapPin className="h-4 w-4 text-cyan-500" />
                    Device registry synced
                  </span>
                </div>

                {selectedUserDevices.length === 0 ? (
                  <p className="text-gray-400">This user has not registered any device yet.</p>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      {selectedUserDevices.map((device) => (
                        <div
                          key={device.id}
                          className={`rounded-3xl border p-4 text-left transition-all duration-200 ${
                            selectedDeviceId === device.id
                              ? "border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/10"
                              : "border-slate-200/80 bg-white/95 hover:border-cyan-500/20 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-cyan-500/20 dark:hover:bg-slate-900/60"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDeviceId(device.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-slate-950 font-semibold dark:text-white">{device.name}</p>
                              <span className={`text-xs px-2 py-1 rounded-full ${device.status === "active" ? "bg-green-500/20 text-green-600 dark:text-green-300" : "bg-red-500/20 text-red-600 dark:text-red-300"}`}>
                                {device.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-cyan-300 font-mono">Device ID: {device.uniqueId}</p>
                            <p className="mt-2 text-sm text-gray-300">Location: {device.location}</p>
                            <p className="mt-1 text-xs text-gray-500">Record ID: {device.id}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium">
                              <span className={`rounded-full px-2 py-1 ${hasConfiguredLocation(device) ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "bg-amber-500/15 text-amber-700 dark:text-amber-200"}`}>
                                {hasConfiguredLocation(device) ? "GPS Ready" : "Location Missing"}
                              </span>
                              <span className="rounded-full bg-slate-500/15 px-2 py-1 text-slate-700 dark:text-slate-200">
                                {device.deviceType === "real" ? "Real Hardware" : "Simulator"}
                              </span>
                              <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-700 dark:text-cyan-200">
                                {device.zone ?? "Zone Pending"}
                              </span>
                            </div>
                          </button>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                            <div>Owner: {device.ownerUid}</div>
                            <div>Type: {device.deviceType ?? "unknown"}</div>
                            <div>Zone: {device.zone ?? "-"}</div>
                            <div>Battery: {device.battery ?? "-"}%</div>
                            <div>Lat: {device.latitude ?? "-"}</div>
                            <div>Lng: {device.longitude ?? "-"}</div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium">
                            <span className={`rounded-full px-2 py-1 ${hasConfiguredLocation(device) ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "bg-amber-500/15 text-amber-700 dark:text-amber-200"}`}>
                              {hasConfiguredLocation(device) ? "Location synced" : "Awaiting location"}
                            </span>
                            <span className="rounded-full bg-slate-500/15 px-2 py-1 text-slate-700 dark:text-slate-200">
                              {device.status === "active" ? "Online" : "Offline"}
                            </span>
                            <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-700 dark:text-cyan-200">
                              {device.deviceType === "real" ? "Hardware" : "Simulator"}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() => openDeviceEditor(device)}
                              className="h-8 rounded-full bg-cyan-500 px-3 text-xs text-white hover:bg-cyan-600"
                            >
                              <PencilLine className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void handleDeleteDevice(device)}
                              className="h-8 rounded-full bg-red-500 px-3 text-xs text-white hover:bg-red-600"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {showDataPanel && (
                      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-white">Data</h3>
                          <Button
                            onClick={() => setShowDataPanel(false)}
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                          >
                            Close
                          </Button>
                        </div>

                        <div className="mb-4">
                          <label className="mb-2 block text-sm font-medium text-slate-200">
                            Search readings
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              value={readingSearch}
                              onChange={(e) => setReadingSearch(e.target.value)}
                              placeholder="Search by timestamp, status, pH, TDS, turbidity, temperature"
                              className="h-11 border-slate-700 bg-slate-950/40 pl-10 text-white placeholder:text-slate-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-5">
                          {selectedUserDevices.map((device) => {
                            const readings = filteredReadingsByDevice[device.id] ?? [];

                            return (
                              <div key={device.id} className="overflow-hidden rounded-lg border border-slate-700">
                                <div className="bg-slate-800 px-4 py-3">
                                  <p className="font-semibold text-white">{device.name}</p>
                                  <p className="mt-1 text-xs text-cyan-300">Device ID: {device.uniqueId}</p>
                                  <p className="mt-1 text-xs text-slate-400">Owner: {device.ownerUid} | Zone: {device.zone ?? "-"} | Battery: {device.battery ?? "-"}%</p>
                                </div>

                                {readings.length === 0 ? (
                                  <p className="p-4 text-sm text-gray-400">No readings found.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                      <thead className="bg-slate-800/80 text-xs uppercase text-gray-400">
                                        <tr>
                                          <th className="px-4 py-3">No.</th>
                                          <th className="px-4 py-3">Timestamp</th>
                                          <th className="px-4 py-3">pH</th>
                                          <th className="px-4 py-3">TDS</th>
                                          <th className="px-4 py-3">Turbidity</th>
                                          <th className="px-4 py-3">Temperature</th>
                                          <th className="px-4 py-3">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-700 text-gray-200">
                                        {readings.map((reading, index) => (
                                          <tr key={`${device.id}-${reading.timestamp}-${index}`}>
                                            <td className="px-4 py-3">{index + 1}</td>
                                            <td className="px-4 py-3">{(() => {
                                                const iso = toIsoTimestamp(reading.timestamp);
                                                return iso ? new Date(iso).toLocaleString() : String(reading.timestamp);
                                              })()}</td>
                                            <td className="px-4 py-3">{reading.ph}</td>
                                            <td className="px-4 py-3">{reading.tds}</td>
                                            <td className="px-4 py-3">{reading.turbidity}</td>
                                            <td className="px-4 py-3">{reading.temperature}</td>
                                            <td className="px-4 py-3">
                                              <span className={`rounded-full px-2 py-1 text-xs ${
                                                reading.status === "SAFE"
                                                  ? "bg-green-500/20 text-green-300"
                                                  : "bg-red-500/20 text-red-300"
                                              }`}>
                                                {reading.status}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedDevice && (
                      <div className="mt-6 space-y-4">
                        <StatusBanner
                          status={latestReading?.status}
                          updatedAt={latestReading?.timestamp}
                          simulatorRunning={false}
                        />

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <SensorCard
                            label="pH"
                            value={latestReading?.ph}
                            unit=""
                            icon="ph"
                            safeRange="6.5 - 8.5"
                            alert={(latestReading?.ph ?? 7) < 6.5 || (latestReading?.ph ?? 7) > 8.5}
                          />
                          <SensorCard
                            label="TDS"
                            value={latestReading?.tds}
                            unit="ppm"
                            icon="tds"
                            safeRange="200 - 1000"
                            alert={(latestReading?.tds ?? 0) > 1000}
                          />
                          <SensorCard
                            label="Turbidity"
                            value={latestReading?.turbidity}
                            unit="NTU"
                            icon="turbidity"
                            safeRange="0 - 25"
                            alert={(latestReading?.turbidity ?? 0) > 25}
                          />
                          <SensorCard
                            label="Temperature"
                            value={latestReading?.temperature}
                            unit="deg C"
                            icon="temperature"
                            safeRange="20 - 35"
                          />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <WaterGraph data={tdsData} type="tds" />
                          <WaterGraph data={phTurbidityData} type="ph" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="h-full min-h-[260px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Cpu className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                  Select a user to see registered devices.
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </div>

      <Sheet open={isUserDrawerOpen} onOpenChange={setIsUserDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-slate-950 text-white border-slate-800">
          <SheetHeader className="text-left">
            <SheetTitle className="text-white text-2xl font-black">User Details</SheetTitle>
            <SheetDescription className="text-slate-400">
              Full account profile, device registry, and Firestore-linked metadata.
            </SheetDescription>
          </SheetHeader>

          {selectedUser ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{selectedUser.email}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedUser.uniqueId ?? selectedUser.id}</p>
                  </div>
                  <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                    {selectedUser.role}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedUserDetails.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsUserEditOpen(true)}
                    disabled={isDemoUser(selectedUser)}
                    className="bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50"
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit User
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDeleteUser()}
                    disabled={isDemoUser(selectedUser)}
                    className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete User
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">Linked Devices</p>
                    <p className="text-sm text-slate-400">{selectedUserDevices.length} devices found</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                    <Database className="h-4 w-4" />
                    Firestore
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedUserDevices.length === 0 ? (
                    <p className="text-sm text-slate-400">No devices linked to this user.</p>
                  ) : (
                    selectedUserDevices.map((device) => (
                      <div key={device.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{device.name}</p>
                            <p className="text-xs text-slate-400">{device.uniqueId}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${device.status === "active" ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>
                            {device.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>Location: {device.location}</div>
                          <div>Zone: {device.zone ?? "-"}</div>
                          <div>Battery: {device.battery ?? "-"}%</div>
                          <div>Type: {device.deviceType ?? "-"}</div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => openDeviceEditor(device)}
                            className="h-8 rounded-full bg-cyan-500 px-3 text-xs text-white hover:bg-cyan-600"
                          >
                            <PencilLine className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleDeleteDevice(device)}
                            className="h-8 rounded-full bg-red-500 px-3 text-xs text-white hover:bg-red-600"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setSelectedDeviceId(device.id)}
                            className="h-8 rounded-full border border-slate-700 bg-transparent px-3 text-xs text-slate-200 hover:bg-slate-800"
                          >
                            <ChevronRight className="mr-1 h-3.5 w-3.5" />
                            Inspect
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={isUserEditOpen} onOpenChange={setIsUserEditOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update account metadata directly in Firestore.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <Input value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Name</label>
              <Input value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phone</label>
              <Input value={userForm.phone} onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Organization</label>
              <Input value={userForm.organization} onChange={(e) => setUserForm((prev) => ({ ...prev, organization: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Unique ID</label>
              <Input value={userForm.uniqueId} onChange={(e) => setUserForm((prev) => ({ ...prev, uniqueId: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Locations</label>
              <Input value={userForm.locations} onChange={(e) => setUserForm((prev) => ({ ...prev, locations: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" placeholder="Comma-separated locations" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Recovery Code</label>
              <Input value={userForm.resetCode} onChange={(e) => setUserForm((prev) => ({ ...prev, resetCode: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Provider</label>
              <Input value={selectedUser?.provider ?? "firebase/local"} disabled className="border-slate-700 bg-slate-900 text-slate-400" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-900" onClick={() => setIsUserEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveUserChanges()} disabled={actionLoading} className="bg-cyan-500 text-white hover:bg-cyan-600">
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeviceEditOpen} onOpenChange={setIsDeviceEditOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Device</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update device metadata in Firestore and the local cache.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Name</label>
              <Input value={deviceForm.name} onChange={(e) => setDeviceForm((prev) => ({ ...prev, name: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Unique ID</label>
              <Input value={deviceForm.uniqueId} onChange={(e) => setDeviceForm((prev) => ({ ...prev, uniqueId: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Status</label>
              <select value={deviceForm.status} onChange={(e) => setDeviceForm((prev) => ({ ...prev, status: e.target.value as DeviceRecord["status"] }))} className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-white">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Device Type</label>
              <select value={deviceForm.deviceType} onChange={(e) => setDeviceForm((prev) => ({ ...prev, deviceType: e.target.value as DeviceEditForm["deviceType"] }))} className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-white">
                <option value="simulator">simulator</option>
                <option value="real">real</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Location</label>
              <Input value={deviceForm.location} onChange={(e) => setDeviceForm((prev) => ({ ...prev, location: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Zone</label>
              <Input value={deviceForm.zone} onChange={(e) => setDeviceForm((prev) => ({ ...prev, zone: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Battery</label>
              <Input value={deviceForm.battery} onChange={(e) => setDeviceForm((prev) => ({ ...prev, battery: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Latitude</label>
              <Input value={deviceForm.latitude} onChange={(e) => setDeviceForm((prev) => ({ ...prev, latitude: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Longitude</label>
              <Input value={deviceForm.longitude} onChange={(e) => setDeviceForm((prev) => ({ ...prev, longitude: e.target.value }))} className="border-slate-700 bg-slate-900 text-white" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-900" onClick={() => setIsDeviceEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveDeviceChanges()} disabled={actionLoading} className="bg-cyan-500 text-white hover:bg-cyan-600">
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminPanel;