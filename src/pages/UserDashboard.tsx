import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  getParallaxVariants,
  getStaggerContainerVariants,
  getFadeSlideUpVariants,
  get3DCardVariants,
  getHeroCardVariants,
  usePrefersReducedMotion,
} from "@/hooks/useAnimationUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBanner } from "@/components/StatusBanner";
import { usePerformanceMode } from "@/lib/performanceMode";
import { SensorCard } from "@/components/SensorCard";
import { WaterGraph } from "@/components/WaterGraph";
import { ChatPanel } from "@/components/ChatPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertPanel } from "@/components/AlertPanel";
import MobileHeader from "@/components/MobileHeader";
import MobileSidebar, { MobileSidebarTab } from "@/components/MobileSidebar";
import FloatingSyncWidget from "@/components/FloatingSyncWidget";
import SyncMonitor from "@/components/SyncMonitor";
import DashboardCard from "@/components/DashboardCard";
import BottomDock from "@/components/BottomDock";
import ActionBar from "@/components/ActionBar";
import StatusBar from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaterAlerts } from "@/hooks/useWaterAlerts";
import { useGeoSimulation } from "@/hooks/useGeoSimulation";
import { useDevices } from "@/hooks/useDevices";
import { buildCommandCenterModel } from "@/lib/commandCenterModel";
import { DeviceLocationPicker } from "@/components/geo/DeviceLocationPicker";
import { GeoIntelligenceMap } from "@/components/geo/GeoIntelligenceMap";
import { ZoneIntelligencePanel } from "@/components/geo/ZoneIntelligencePanel";
import { GeoAlertFeed } from "@/components/geo/GeoAlertFeed";
import { LiveDeviceMap } from "@/components/geo/LiveDeviceMap";
import { DeviceDetailPopup } from "@/components/geo/DeviceDetailPopup";
import AddDeviceModal from "../components/AddDeviceModal";
import HelpSupportSection from "@/components/HelpSupportSection";

// Local lightweight timestamp normalizer to avoid raw Firestore Timestamp leaks

import {
  buildZoneInsights,
  getRadiusInsights,
  getSafetyScore,
  getUnsafeSpreadPrediction,
  makeGeoDevicePoints,
} from "@/lib/geoIntelligence";
import {
  LogOut,
  Plus,
  Table2,
  Play,
  Pause,
  UploadCloud,
  DownloadCloud,
  Wifi,
  LayoutDashboard,
  ChartLine,
  Waves,
  Cpu,
  Brain,
  Cloud,
  FileBarChart2,
  UserRound,
  Settings,
  HelpCircle,
  Bell,
  AlertTriangle,
  BatteryCharging,
  X,
  Trash2,
  Flame,
  Globe,
  LocateFixed,
  Siren,
} from "lucide-react";
import { toast } from "sonner";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  DeviceRecord,
  appendLocalDeviceReading,
  generateRandomReading,
  getLocalDeviceHistory,
  getLocalDevicesByOwner,
  normalizeDeviceReading,
  removeLocalDevice,
  flushPendingDeviceOperations,
  queuePendingDeviceDelete,
  queuePendingDeviceUpsert,
  upsertLocalDevice,
} from "@/lib/deviceStore";
import { getZone } from "@/lib/utils";
import { getDevicesByZone } from "@/lib/deviceStore";
import { calculateAreaStatus } from "@/lib/utils";
import { postReadingToSupabase } from "@/services/readingsService";
const LOCATIONS = [
  "North Zone",
  "South Zone",
  "East Zone",
  "West Zone",
  "Central Hub",
];

const toIsoLocal = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value).toISOString();
  if (value && typeof (value as any).toDate === "function") {
    const d = (value as any).toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
  }
  const seconds = Number((value && (value as any).seconds) ?? NaN);
  const nanoseconds = Number((value && (value as any).nanoseconds) ?? 0);
  if (Number.isFinite(seconds))
    return new Date(
      seconds * 1000 + Math.floor(nanoseconds / 1_000_000),
    ).toISOString();
  return "";
};

const resolveDeviceZone = (device: {
  zone?: string;
  latitude?: number;
  longitude?: number;
}) => {
  if (device.zone) {
    return device.zone;
  }

  if (Number.isFinite(device.latitude) && Number.isFinite(device.longitude)) {
    return getZone(device.latitude, device.longitude);
  }

  return null;  
};

const toFirestoreIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildDeviceDocumentId = (
  uid: string,
  email: string | null,
  deviceName: string,
) => {
  const username = toFirestoreIdPart(email?.split("@")[0] ?? uid) || "user";
  const device = toFirestoreIdPart(deviceName) || "device";

  return `${username}-${device}`;
};

const mergeDeviceLists = (...deviceGroups: DeviceRecord[][]) => {
  const merged = new Map<string, DeviceRecord>();

  deviceGroups.flat().forEach((device) => {
    if (device?.id) {
      merged.set(device.id, device);
    }
  });

  return Array.from(merged.values());
};

// Command-center helpers moved to `src/lib/commandCenterModel.ts` to reduce bundle size.

type DashboardTab =
  | "Overview"
  | "Command Center"
  | "Charts"
  | "Water Distribution"
  | "Hardware"
  | "AI"
  | "Cloud"
  | "Reports"
  | "Profile"
  | "Settings"
  | "Help";

type DeviceLocationState = {
  lat: number;
  lng: number;
  label: string;
  address: string;
  zone: string;
};

export const UserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { devices: userDevices, addDevice, removeDevice } = useDevices();
  const prefersReducedMotion = usePrefersReducedMotion();
  const performanceMode = usePerformanceMode();
  const dashboardCardVariants =
    prefersReducedMotion || performanceMode
      ? get3DCardVariants("none")
      : getHeroCardVariants();

  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [simulatorOnly, setSimulatorOnly] = useState(false);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedDetailDevice, setSelectedDetailDevice] =
    useState<DeviceRecord | null>(null);
  const [history, setHistory] = useState<
    ReturnType<typeof getLocalDeviceHistory>
  >([]);
  const [areaStatus, setAreaStatus] = useState("Loading...");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("Overview");
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [selectedInfoPanel, setSelectedInfoPanel] = useState<
    "Profile" | "Alerts" | "Announcements" | null
  >(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [addDeviceLoading, setAddDeviceLoading] = useState(false);
  const [addReadingLoading, setAddReadingLoading] = useState(false);

  //   const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState<{
    name: string;
    type: "simulator" | "real";
    manualLocation: string;
    latitude: number | null;
    longitude: number | null;
  }>({
    name: "",
    type: "simulator",
    manualLocation: "",
    latitude: null, // Force location selection
    longitude: null,
  });
  const [newDeviceConnected, setNewDeviceConnected] = useState(false);
  const [newDeviceMapLocation, setNewDeviceMapLocation] = useState<{
    lat: number | null;
    lng: number | null;
    label: string;
    address: string;
    zone: string;
  }>({
    lat: null, // Force location selection
    lng: null,
    label: "",
    address: "",
    zone: "",
  });
  const [syncingDevices, setSyncingDevices] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      deviceId: string;
      reason: string;
      severity: string;
      timestamp: string;
    }>
  >([]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  // Monitor water alerts for selected device
  const waterAlerts = useWaterAlerts(
    selectedDeviceId ?? "",
    user?.uid ?? "",
    user?.email ?? undefined,
  );

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const localDevices = getLocalDevicesByOwner(user.uid);
    setDevices(localDevices);
    setSelectedDeviceId((prev) => prev ?? localDevices[0]?.id ?? null);
    setLoading(false);
    setDeviceLoadError(null);
    setDevicesLoading(true);
    void flushPendingDeviceOperations(user.uid);

    if (simulatorOnly) {
      setDevicesLoading(false);
      return;
    }

    const deviceQuery = collection(db, "users", user.uid, "devices");

    const unsubscribe = onSnapshot(
      deviceQuery,
      (snapshot) => {
        try {
          const remoteDevices = snapshot.docs
            .map((item) => ({
              id: item.id,
              ...(item.data() as Omit<DeviceRecord, "id">),
            }))
            .filter((device) => Boolean(device.id) && Boolean(device.name));

          const nextDevices = mergeDeviceLists(localDevices, remoteDevices);

          console.log("[Dashboard] Device snapshot received", {
            remoteCount: remoteDevices.length,
            mergedCount: nextDevices.length,
            selectedDeviceId,
          });

          nextDevices.forEach((device) => upsertLocalDevice(device));
          setDevices(nextDevices);
          setSelectedDeviceId((prev) => prev ?? nextDevices[0]?.id ?? null);
          setDeviceLoadError(null);
        } catch (error) {
          console.error(
            "[Dashboard] Failed to process device snapshot:",
            error,
          );
          setDeviceLoadError("Unable to load devices. Please try again.");
          setDevices(localDevices);
        } finally {
          setDevicesLoading(false);
        }
      },
      (error) => {
        console.error("[Dashboard] Device listener error:", error);
        setDeviceLoadError("Unable to load devices. Please try again.");
        setDevices(localDevices);
        setDevicesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [navigate, user, simulatorOnly, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDevice) {
      setHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        if (!simulatorOnly) {
          const readingSnapshot = await getDocs(
            collection(
              db,
              "users",
              user!.uid,
              "devices",
              selectedDevice.id,
              "readings",
            ),
          );

          if (readingSnapshot.size > 0) {
            const remoteHistory = readingSnapshot.docs.map((item) =>
              normalizeDeviceReading(item.data() as Record<string, unknown>),
            );

            // Merge remote and local histories — prefer local entries (unsynced)
            try {
              const localHistory = getLocalDeviceHistory(selectedDevice.id);
              const map = new Map<string, (typeof remoteHistory)[number]>();
              // remote first, then local overwrites duplicates
              remoteHistory.forEach((r) => map.set(r.timestamp, r));
              localHistory.forEach((r) => map.set(r.timestamp, r));
              const merged = Array.from(map.values()).sort((a, b) =>
                (a.timestamp || "").localeCompare(b.timestamp || ""),
              );
              setHistory(merged.slice(-30));
            } catch (err) {
              // Fallback to remote if merge fails
              console.warn("Failed to merge histories, using remote only", err);
              setHistory(remoteHistory.slice(-30));
            }

            return;
          }
        }
      } catch {
        // Use local fallback below.
      }

      setHistory(getLocalDeviceHistory(selectedDevice.id));
    };

    void loadHistory();
  }, [selectedDevice, user, simulatorOnly]);

  useEffect(() => {
    if (!selectedDevice) {
      setAreaStatus("Loading...");
      return;
    }

    const fetchAreaData = async () => {
      try {
        const zone = resolveDeviceZone(selectedDevice);
        console.log(`[Area Status Fetch] Using zone: ${zone}`, {
          deviceZone: selectedDevice?.zone,
          deviceLocation: selectedDevice?.location,
        });

        if (!zone) {
          setAreaStatus("No Data");
          return;
        }

        const zoneDevices = await getDevicesByZone(zone);
        const status = calculateAreaStatus(zoneDevices);
        setAreaStatus(status);
      } catch (error) {
        console.error("Failed to calculate area status:", error);
        setAreaStatus("Unable to load area status");
      }
    };

    void fetchAreaData();
  }, [selectedDevice]);

  useEffect(() => {
    setNewDevice((prev) => ({
      ...prev,
      latitude: newDeviceMapLocation.lat,
      longitude: newDeviceMapLocation.lng,
      manualLocation:
        newDeviceMapLocation.address ||
        newDeviceMapLocation.label ||
        prev.manualLocation,
    }));
  }, [newDeviceMapLocation]);

  const refreshDeviceStatus = async (deviceId: string) => {
    const latest = getLocalDeviceHistory(deviceId).slice(-1)[0];
    if (!latest) {
      return;
    }

    const nextStatus = latest.status === "SAFE" ? "active" : "inactive";

    const updated = devices.find((device) => device.id === deviceId);

    setDevices((prev) =>
      prev.map((device) =>
        device.id === deviceId ? { ...device, status: nextStatus } : device,
      ),
    );

    if (updated) {
      queuePendingDeviceUpsert({ ...updated, status: nextStatus });
      upsertLocalDevice({ ...updated, status: nextStatus });
    }

    try {
      await updateDoc(doc(db, "users", user!.uid, "devices", deviceId), {
        status: nextStatus,
      });
    } catch {
      // Local fallback already updated.
    }

    try {
      await updateDoc(doc(db, "devices", deviceId), { status: nextStatus });
    } catch {
      // Root devices mirror may be unavailable depending on Firestore rules.
    }
  };

  const handleAddDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSyncError(null);
    if (!user || !newDevice.name.trim()) {
      console.warn("[Dashboard] Invalid device input");
      return;
    }

    if (!newDevice.manualLocation.trim()) {
      alert("Please enter where you want to locate this device.");
      return;
    }

    if (newDevice.type === "real" && !newDeviceConnected) {
      alert("Please connect the real device before registering it.");
      return;
    }

    setAddDeviceLoading(true);
    try {
      const deviceId = buildDeviceDocumentId(
        user.uid,
        user.email,
        newDevice.name,
      );

      // Validate coordinates
      if (
        !Number.isFinite(newDevice.latitude) ||
        !Number.isFinite(newDevice.longitude)
      ) {
        console.error("[Dashboard] Invalid latitude/longitude");
        alert("Please enter valid latitude and longitude values");
        return;
      }

      // Compute zone from latitude and longitude
      const deviceZone = getZone(newDevice.latitude, newDevice.longitude);
      console.log(`[Dashboard] Creating device with zone: ${deviceZone}`);

      const payload: Omit<DeviceRecord, "id"> = {
        ownerUid: user.uid,
        name: newDevice.name.trim(),
        uniqueId: deviceId,
        location: newDevice.manualLocation.trim(),
        latitude: newDevice.latitude,
        longitude: newDevice.longitude,
        zone: deviceZone,
        status:
          newDevice.type === "real"
            ? newDeviceConnected
              ? "active"
              : "inactive"
            : "active",
        battery: 85,
        deviceType: newDevice.type,
        createdAt: new Date().toISOString(),
      };

      const created: DeviceRecord = { id: deviceId, ...payload };

      void queuePendingDeviceUpsert(created);
      upsertLocalDevice(created);
      setDevices((prev) => [created, ...prev]);
      setSelectedDeviceId(created.id);
      setNewDevice({
        name: "",
        type: "simulator",
        manualLocation: "",
        latitude: null, // Force location selection
        longitude: null,
      });
      setNewDeviceMapLocation({
        lat: null, // Force location selection
        lng: null,
        label: "",
        address: "",
        zone: "",
      });
      setNewDeviceConnected(false);
      setShowAddForm(false);
      console.log("[Dashboard] Device created successfully:", created.id);
    } catch (error) {
      console.error("[Dashboard] Unexpected error in handleAddDevice:", error);
      alert("Failed to create device. Check the console for details.");
    } finally {
      setAddDeviceLoading(false);
    }
  };

  const handleAddDeviceModal = async (device: {
    name: string;
    lat: number;
    lng: number;
    zone: string;
    location: string;
  }): Promise<boolean> => {
    if (!user || !device.name.trim()) {
      console.warn("[Dashboard] Invalid device input from modal");
      return false;
    }

    if (!device.location.trim()) {
      alert("Please enter a location or select it from the map.");
      return false;
    }

    setSyncError(null);
    setAddDeviceLoading(true);

    try {
      const deviceId = buildDeviceDocumentId(user.uid, user.email, device.name);
      const payload: Omit<DeviceRecord, "id"> = {
        ownerUid: user.uid,
        name: device.name.trim(),
        uniqueId: deviceId,
        location: device.location.trim(),
        latitude: device.lat,
        longitude: device.lng,
        zone: device.zone || getZone(device.lat, device.lng),
        status: "active",
        battery: 85,
        deviceType: "real",
        createdAt: new Date().toISOString(),
      };

      const created: DeviceRecord = { id: deviceId, ...payload };

      void queuePendingDeviceUpsert(created);
      upsertLocalDevice(created);
      setDevices((prev) => [created, ...prev]);
      setSelectedDeviceId(created.id);
      setActiveTab("Hardware");
      console.log("[Dashboard] Device created via modal:", created.id);
      return true;
    } catch (error) {
      console.error(
        "[Dashboard] Unexpected error in handleAddDeviceModal:",
        error,
      );
      alert("Failed to create device. Check the console for details.");
      return false;
    } finally {
      setAddDeviceLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm("Delete this device from your account?")) {
      return;
    }

    void queuePendingDeviceDelete(user!.uid, deviceId);
    removeLocalDevice(deviceId);
    const nextDevices = devices.filter((device) => device.id !== deviceId);
    setDevices(nextDevices);

    if (selectedDeviceId === deviceId) {
      setSelectedDeviceId(nextDevices[0]?.id ?? null);
    }
  };

  const syncDeviceRegistry = async () => {
    if (!user) return;

    setSyncingDevices(true);
    setSyncError(null);
    try {
      const rootDeviceQuery = query(
        collection(db, "devices"),
        where("ownerUid", "==", user.uid),
      );
      const rootSnapshot = await getDocs(rootDeviceQuery);
      const rootDevices = rootSnapshot.docs
        .map((item) => ({
          id: item.id,
          ...(item.data() as Omit<DeviceRecord, "id">),
        }))
        .filter((device) => device.id && device.name); // Basic validation

      console.log("[Dashboard] Sync fetched root devices", {
        count: rootDevices.length,
        ownerUid: user.uid,
      });

      if (rootDevices.length === 0) {
        console.warn("Sync found no remote devices. Keeping local registry.");
        setSyncError("No remote devices found. Local devices are preserved.");
        setDevices(getLocalDevicesByOwner(user.uid));
        return;
      }

      const localDevices = getLocalDevicesByOwner(user.uid);
      const existingSnapshot = await getDocs(
        collection(db, "users", user.uid, "devices"),
      );
      const existingIds = new Set(existingSnapshot.docs.map((item) => item.id));

      await Promise.all(
        rootDevices.map(async (device) => {
          if (!existingIds.has(device.id)) {
            await setDoc(
              doc(db, "users", user.uid, "devices", device.id),
              device,
            );
          }
          upsertLocalDevice(device);
        }),
      );

      const mergedDevices = mergeDeviceLists(localDevices, rootDevices);
      setDevices(mergedDevices);
      setSelectedDeviceId((prev) => prev ?? mergedDevices[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to sync device registry:", error);
      setSyncError("Failed to sync devices. Please try again.");
      setDevices(getLocalDevicesByOwner(user.uid));
    } finally {
      setSyncingDevices(false);
    }
  };

  useEffect(() => {
    const handleOnlineStatus = () => {
      setConnectionStatus(navigator.onLine ? "connected" : "disconnected");
      void flushPendingDeviceOperations(user?.uid);
    };

    handleOnlineStatus();
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);

    return () => {
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[Dashboard] render state", {
        loading,
        devicesLoading,
        deviceCount: devices.length,
        selectedDeviceId,
        deviceLoadError,
        syncingDevices,
        addDeviceLoading,
      });
    }
  }, [
    addDeviceLoading,
    deviceLoadError,
    devices.length,
    devicesLoading,
    loading,
    selectedDeviceId,
    syncingDevices,
  ]);

  useEffect(() => {
    const loadAlerts = async () => {
      if (!user) {
        setAlerts([]);
        return;
      }

      try {
        const alertsQuery = query(
          collection(db, "alerts"),
          where("userId", "==", user.uid),
        );
        const snapshot = await getDocs(alertsQuery);
        const alertList = snapshot.docs
          .map((item) => {
            const data = item.data();
            const createdAt =
              data.createdAt && typeof data.createdAt.toDate === "function"
                ? data.createdAt.toDate().toISOString()
                : data.timestamp || "";

            return {
              id: item.id,
              deviceId: data.deviceId || "unknown",
              reason: data.reason || "Anomaly detected",
              severity: data.severity || "warning",
              timestamp: createdAt,
            };
          })
          .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

        setAlerts(alertList);
      } catch (error) {
        console.error("Failed to load alerts:", error);
        setAlerts([]);
      }
    };

    void loadAlerts();
  }, [user]);

  const addNewReading = async () => {
    const targetDevice = selectedDevice ?? devices[0] ?? null;
    if (!targetDevice) {
      toast.error("Please add a device first.");
      return;
    }

    const reading = generateRandomReading();

    if (
      !Number.isFinite(reading.ph) ||
      !Number.isFinite(reading.tds) ||
      !Number.isFinite(reading.turbidity) ||
      !Number.isFinite(reading.temperature)
    ) {
      toast.error("Invalid reading values. Please try again.");
      return;
    }

    setAddReadingLoading(true);

    try {
      const insertedReading = await postReadingToSupabase(reading);
      const normalizedReading = normalizeDeviceReading({
        ph: insertedReading.ph,
        tds: insertedReading.tds,
        turbidity: insertedReading.turbidity,
        temperature: insertedReading.temperature,
        status:
          insertedReading.status.toUpperCase() === "SAFE"
            ? "SAFE"
            : "NOT SAFE",
        timestamp: insertedReading.created_at,
      });

      const nextHistory = appendLocalDeviceReading(targetDevice.id, normalizedReading);
      setHistory(nextHistory);
      setSelectedDeviceId((prev) => prev ?? targetDevice.id);
      await refreshDeviceStatus(targetDevice.id);

      toast.success(`Reading saved to Supabase as ${insertedReading.status.toLowerCase()}.`);
    } catch (error) {
      console.error("Failed to add reading:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add reading.");
    } finally {
      setAddReadingLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleMapDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      setSelectedDetailDevice(device);
    }
  };

  const tabMetadata: Record<
    DashboardTab,
    {
      eyebrow: string;
      title: string;
      subtitle: string;
      accent: string;
      chip: string;
    }
  > = {
    Overview: {
      eyebrow: "Insights",
      title: "Overview",
      subtitle: "Water quality, device status, and quick actions.",
      accent: "from-cyan-500 to-slate-500",
      chip: "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200",
    },
    "Command Center": {
      eyebrow: "Alert Command Center",
      title: "Command Center",
      subtitle: "Live incident triage, AI root cause analysis, and response guidance.",
      accent: "from-amber-500 to-slate-700",
      chip: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
    },
    Charts: {
      eyebrow: "Charts",
      title: "Charts",
      subtitle: "Visualize trends for your selected device.",
      accent: "from-slate-500 to-slate-700",
      chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
    },
    "Water Distribution": {
      eyebrow: "Water",
      title: "Water Distribution",
      subtitle: "Monitor distribution and coverage across zones.",
      accent: "from-sky-500 to-blue-700",
      chip: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-200",
    },
    Hardware: {
      eyebrow: "Hardware",
      title: "Hardware",
      subtitle: "Sync devices and register new hardware here.",
      accent: "from-cyan-500 to-cyan-700",
      chip: "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200",
    },
    AI: {
      eyebrow: "AI",
      title: "AI",
      subtitle: "Intelligence and predictive alerts for your devices.",
      accent: "from-emerald-500 to-slate-700",
      chip: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
    },
    Cloud: {
      eyebrow: "Cloud",
      title: "Cloud",
      subtitle: "Manage remote sync and storage for your fleet.",
      accent: "from-blue-500 to-slate-700",
      chip: "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-200",
    },
    Reports: {
      eyebrow: "Reports",
      title: "Reports",
      subtitle: "Export logs and review historic readings.",
      accent: "from-violet-500 to-slate-700",
      chip: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-200",
    },
    Profile: {
      eyebrow: "Profile",
      title: "Profile",
      subtitle: "Your account and user settings.",
      accent: "from-slate-500 to-slate-700",
      chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
    },
    Settings: {
      eyebrow: "Settings",
      title: "Settings",
      subtitle: "Configure dashboard behavior and notifications.",
      accent: "from-slate-500 to-slate-700",
      chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
    },
    Help: {
      eyebrow: "Help",
      title: "Help",
      subtitle: "Support and troubleshooting guidance.",
      accent: "from-slate-500 to-slate-700",
      chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
    },
  };

  const activeTabMeta = tabMetadata[activeTab];
  const activePageTitle = activeTabMeta.title;

  // Monitoring control states
  const [monitorRunning, setMonitorRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [geoHeatmapEnabled, setGeoHeatmapEnabled] = useState(true);
  const [geoSimulationEnabled, setGeoSimulationEnabled] = useState(false);
  const [geoSoundEnabled, setGeoSoundEnabled] = useState(false);
  const [geoSelectedId, setGeoSelectedId] = useState<string | null>(null);
  const [hydroAiOpen, setHydroAiOpen] = useState(false);
  const [incidentReportCopied, setIncidentReportCopied] = useState(false);
  const [commandCenterDemoMode, setCommandCenterDemoMode] = useState(false);
  const [whatIfScenario, setWhatIfScenario] = useState<"filter" | "flush" | "inspect">("filter");

  const downloadCSV = () => {
    if (!selectedDevice) return;
    const rows = [
      ["timestamp", "ph", "tds", "turbidity", "temperature", "status"],
      ...history.map((h) => [
        h.timestamp,
        h.ph,
        h.tds,
        h.turbidity,
        h.temperature,
        h.status,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDevice.uniqueId}-readings.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const startMonitoring = () => {
    if (!selectedDevice) return;
    if (monitorRunning) return;
    setMonitorRunning(true);
    setConnectionStatus("connected");
    setTimerSeconds(0);

    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);

    // push a new reading every 5 seconds
    readingRef.current = setInterval(() => {
      void addNewReading();
    }, 5000);
  };

  const stopMonitoring = () => {
    setMonitorRunning(false);
    setConnectionStatus("disconnected");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (readingRef.current) {
      clearInterval(readingRef.current);
      readingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (readingRef.current) clearInterval(readingRef.current);
    };
  }, []);

  const handleSaveData = () => {
    if (!selectedDevice) return;
    const filename = `${selectedDevice.uniqueId}-readings.json`;
    const content = JSON.stringify(history, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleLoadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedDevice) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result ?? "[]"));
        if (Array.isArray(parsed)) {
          // append to local store and update UI
          parsed.forEach((r) => appendLocalDeviceReading(selectedDevice.id, r));
          setHistory(getLocalDeviceHistory(selectedDevice.id));
        } else {
          alert("Invalid file format: expected an array of readings");
        }
      } catch (err) {
        console.error("Failed to load readings:", err);
        alert("Failed to parse file. See console for details.");
      }
    };
    reader.readAsText(file);
    // clear the input so same file can be loaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const latest = history.length ? history[history.length - 1] : null;
  const latestReadings = useMemo(() => history.slice(-10), [history]);
  const tdsData = useMemo(
    () =>
      history.map((item, index) => ({
        time: index + 1,
        tds: item.tds,
      })),
    [history],
  );
  const phTurbidityData = useMemo(
    () =>
      history.map((item, index) => ({
        time: index + 1,
        ph: item.ph,
        turbidity: item.turbidity,
      })),
    [history],
  );
  const dashboardInsights = useMemo(() => {
    const count = latestReadings.length;
    if (!count) {
      return {
        safetyScore: 0,
        riskLevel: "No data",
        recommendation: "Start monitoring to generate reliability insights.",
        trendDelta: "No trend yet",
      };
    }

    const safeReadings = latestReadings.filter(
      (reading) => reading.status === "SAFE",
    ).length;
    const safetyScore = Math.round((safeReadings / count) * 100);
    const recentTds = latestReadings.slice(-5).map((reading) => reading.tds);
    const tdsDrift =
      recentTds.length > 1 ? recentTds[recentTds.length - 1] - recentTds[0] : 0;
    const riskLevel =
      safetyScore >= 85
        ? "Low risk"
        : safetyScore >= 60
          ? "Moderate risk"
          : "High risk";

    const recommendation =
      latest && latest.status !== "SAFE"
        ? "Immediate filtration and source check recommended."
        : tdsDrift > 100
          ? "TDS is trending up. Schedule preventive maintenance."
          : "Water quality is stable. Keep periodic monitoring cadence.";

    const trendDelta =
      tdsDrift === 0
        ? "Stable trend"
        : `${tdsDrift > 0 ? "+" : ""}${Math.round(tdsDrift)} ppm in last 5 readings`;

    return { safetyScore, riskLevel, recommendation, trendDelta };
  }, [latest, latestReadings]);
  const latestReadingByDevice = useMemo(
    () =>
      devices.reduce<
        Record<
          string,
          ReturnType<typeof getLocalDeviceHistory>[number] | undefined
        >
      >((acc, device) => {
        const historyForDevice = getLocalDeviceHistory(device.id);
        acc[device.id] = historyForDevice[historyForDevice.length - 1];
        return acc;
      }, {}),
    [devices, history.length],
  );
  const realGeoPoints = useMemo(
    () => makeGeoDevicePoints(devices, latestReadingByDevice),
    [devices, latestReadingByDevice],
  );
  const selectedRealPoint = useMemo(
    () => realGeoPoints.find((point) => point.id === selectedDeviceId) ?? null,
    [realGeoPoints, selectedDeviceId],
  );
  const { simulatedDevices, alertFeed } = useGeoSimulation(
    {
      lat: selectedRealPoint?.lat ?? 25.61,
      lng: selectedRealPoint?.lng ?? 85.14,
    },
    geoSimulationEnabled,
    70,
  );
  const allGeoPoints = useMemo(
    () =>
      geoSimulationEnabled
        ? [...realGeoPoints, ...simulatedDevices]
        : realGeoPoints,
    [geoSimulationEnabled, realGeoPoints, simulatedDevices],
  );
  const liveGeoAlerts = useMemo(
    () =>
      realGeoPoints
        .filter((point) => point.status === "unsafe")
        .slice(0, 20)
        .map((point) => ({
          id: `live-${point.id}`,
          deviceId: point.id,
          message: `${point.name} crossed safe water limits`,
          status: point.status,
          timestamp: new Date().toISOString(),
        })),
    [realGeoPoints],
  );
  const displayedGeoAlerts = geoSimulationEnabled ? alertFeed : liveGeoAlerts;
  const selectedGeoPoint = useMemo(
    () =>
      allGeoPoints.find(
        (point) => point.id === (geoSelectedId ?? selectedDeviceId),
      ) ?? null,
    [allGeoPoints, geoSelectedId, selectedDeviceId],
  );
  const radiusInsights = useMemo(() => {
    if (!selectedGeoPoint) return [];
    return getRadiusInsights(
      { lat: selectedGeoPoint.lat, lng: selectedGeoPoint.lng },
      allGeoPoints,
      [2, 5],
    );
  }, [allGeoPoints, selectedGeoPoint]);
  const zoneInsights = useMemo(
    () => buildZoneInsights(allGeoPoints),
    [allGeoPoints],
  );
  const spreadPrediction = useMemo(
    () => getUnsafeSpreadPrediction(selectedGeoPoint, allGeoPoints),
    [allGeoPoints, selectedGeoPoint],
  );
  const selectedSafetyScore = useMemo(
    () =>
      selectedGeoPoint
        ? getSafetyScore({
            ph: selectedGeoPoint.ph,
            tds: selectedGeoPoint.tds,
            turbidity: selectedGeoPoint.turbidity,
            temperature: selectedGeoPoint.temperature,
          })
        : 0,
    [selectedGeoPoint],
  );

  useEffect(() => {
    const shouldPlay =
      geoSoundEnabled &&
      displayedGeoAlerts.some((item) => item.status === "unsafe");
    if (!shouldPlay) return;
    try {
      const audio = new Audio("/sound.mp3");
      audio.volume = 0.25;
      void audio.play();
    } catch {
      // best effort
    }
  }, [displayedGeoAlerts, geoSoundEnabled]);

  const commandCenterModel = useMemo(
    () =>
      buildCommandCenterModel({
        history,
        latestReadings,
        latest,
        devices,
        latestReadingByDevice,
        selectedDevice,
        spreadPrediction,
        waterAlerts: {
          recentAlerts: waterAlerts.recentAlerts,
          currentLevel: waterAlerts.currentLevel,
        },
        connectionStatus,
        alerts,
      }),
    [
      alerts,
      connectionStatus,
      devices,
      history,
      latest,
      latestReadings,
      latestReadingByDevice,
      selectedDevice,
      spreadPrediction,
      waterAlerts.currentLevel,
      waterAlerts.recentAlerts,
    ],
  );

  const handleGenerateIncidentReport = async () => {
    try {
      await navigator.clipboard.writeText(commandCenterModel.incidentReport);
      setIncidentReportCopied(true);
      toast.success("Incident report copied to clipboard.");

      window.setTimeout(() => setIncidentReportCopied(false), 1800);
      return;
    } catch (error) {
      console.warn("Clipboard copy failed, falling back to download.", error);
    }

    const blob = new Blob([commandCenterModel.incidentReport], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedDevice?.uniqueId ?? "hydrosentinal"}-incident-report.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Incident report downloaded.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-full max-w-4xl space-y-4 px-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  const noDevices = !devicesLoading && devices.length === 0;
  const mobileNavigationActive =
    selectedInfoPanel === "Alerts" ? "Alerts" : activeTab;
  const commandCenterScenarioMap = {
    filter: {
      label: "Replace filter cartridges",
      detail: "Best for sediment fatigue and persistent turbidity drift.",
      riskDrop: commandCenterModel.whatIf.replaceFilterImpact,
      scoreDelta: commandCenterModel.whatIf.scoreDelta,
    },
    flush: {
      label: "Flush and recalibrate",
      detail: "Good for short-term source disturbance or a noisy intake.",
      riskDrop: Math.max(6, Math.round(commandCenterModel.whatIf.replaceFilterImpact * 0.7)),
      scoreDelta: Math.max(3, Math.round(commandCenterModel.whatIf.scoreDelta * 0.75)),
    },
    inspect: {
      label: "Dispatch field inspection",
      detail: "Fastest path for a manual site check and sensor validation.",
      riskDrop: Math.max(4, Math.round(commandCenterModel.whatIf.replaceFilterImpact * 0.55)),
      scoreDelta: Math.max(2, Math.round(commandCenterModel.whatIf.scoreDelta * 0.6)),
    },
  } as const;
  const activeScenario = commandCenterScenarioMap[whatIfScenario];
  const commandCenterQualityScore = commandCenterDemoMode
    ? Math.min(99, commandCenterModel.qualityScore + 7)
    : commandCenterModel.qualityScore;
  const commandCenterRisk24h = commandCenterDemoMode
    ? Math.max(5, commandCenterModel.risk24h - 11)
    : commandCenterModel.risk24h;
  const commandCenterRisk48h = commandCenterDemoMode
    ? Math.max(commandCenterRisk24h + 4, commandCenterModel.risk48h - 9)
    : commandCenterModel.risk48h;
  const commandCenterCauseSignals = commandCenterDemoMode
    ? [
        "Demo mode predicts a recoverable sediment pulse and filter fatigue.",
        ...commandCenterModel.causeSignals.slice(0, 2),
      ]
    : commandCenterModel.causeSignals;
  const commandCenterRecommendations = commandCenterDemoMode
    ? [
        "Demo mode is active. Use it to present the recovery path and simulation controls.",
        ...commandCenterModel.recommendations.slice(0, 2),
      ]
    : commandCenterModel.recommendations;

  return (
    <main className="min-h-screen bg-transparent text-slate-950 dark:text-white pb-28 md:pb-16">
      <SyncMonitor userId={user?.uid} />
      <MobileSidebar
        open={mobileSidebarOpen}
        userEmail={user?.email}
        activeTab={activeTab}
        onClose={() => setMobileSidebarOpen(false)}
        onTabChange={(tab) => {
          setSelectedInfoPanel(null);
          setActiveTab(tab as DashboardTab);
        }}
        onLogout={handleLogout}
      />
      <MobileHeader
        userEmail={user?.email}
        onMenuClick={() => setMobileSidebarOpen(true)}
        onProfileClick={() => setSelectedInfoPanel("Profile")}
      />
      {syncingDevices && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center rounded-3xl border border-slate-200/80 bg-white/95 px-6 py-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900/90">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <div className="text-slate-950 dark:text-white text-xl font-semibold">
              Syncing Devices...
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">
              Please wait while we update your device registry.
            </div>
          </div>
        </div>
      )}
      {syncError && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {syncError}
          <button
            onClick={() => setSyncError(null)}
            className="ml-2 text-white hover:text-red-200"
          >
            X
          </button>
        </div>
      )}

      <AddDeviceModal
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        onAddDevice={handleAddDeviceModal}
      />

      <div className="hidden md:block bg-white/90 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-50 shadow-sm backdrop-blur-sm sm:backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              // className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-yellow/90 p-2 text-slate-700 shadow-sm   shadow-slate-900/10 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Back to landing page"
            >
              {/* <ArrowLeft className="h-4 w-4 text-cyan-500" /> */}
              <h1 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
                HydroSentinel Dashboard
              </h1>
            </button>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {user?.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ThemeToggle />
            <Button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-yellow/90 p-2 text-slate-700 shadow-sm   shadow-slate-900/10 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`max-w-[96rem] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 transition-[padding] duration-300 ${
          leftSidebarOpen ? "xl:pl-[15.5rem]" : "xl:pl-6"
        } xl:pr-[5.25rem]`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {devicesLoading && devices.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-500" />
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  Loading devices...
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Fetching your registry and latest data.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {deviceLoadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50/90 p-4 text-red-800 shadow-sm dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Unable to load devices. Please try again.
                </p>
                <p className="mt-1 text-sm opacity-90">{deviceLoadError}</p>
              </div>
              <Button
                type="button"
                onClick={() => void syncDeviceRegistry()}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Retry sync
              </Button>
            </div>
          </div>
        ) : null}

        {noDevices ? (
          <section className="rounded-3xl border border-slate-200/80 bg-slate-50/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Siren className="h-12 w-12 text-cyan-400" />
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                No devices connected yet
              </h2>
              <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
                Add your first HydroSentinal device to unlock live water
                monitoring, alerts, and predictive insights.
              </p>
              <Button
                onClick={() => setShowAddDeviceModal(true)}
                className="rounded-full bg-cyan-500 px-5 py-3 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-600"
              >
                Add a device
              </Button>
            </div>
          </section>
        ) : null}

        {activeTab === "Overview" ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:grid-cols-3">
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
              >
                <DashboardCard
                  title="Devices"
                  value={devices.length}
                  description="Connected simulators and real devices"
                  icon={Cpu}
                  accentClass="bg-cyan-100 text-cyan-600 border-cyan-200 dark:bg-cyan-500/40 dark:text-cyan-200"
                />
              </motion.div>
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
              >
                <DashboardCard
                  title="Alerts"
                  value={waterAlerts.recentAlerts.length}
                  description="Current warnings and stability status"
                  icon={AlertTriangle}
                  accentClass="bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/40 dark:text-amber-200"
                />
              </motion.div>
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
              >
                <DashboardCard
                  title="Selected Zone"
                  value={selectedDevice?.zone ?? "Not selected"}
                  description="Water monitoring region analysis"
                  icon={Globe}
                  accentClass="bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/40 dark:text-blue-200"
                />
              </motion.div>
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
              >
                <DashboardCard
                  title="Mode"
                  value={simulatorOnly ? "Simulator" : "Hybrid"}
                  description="Real-time status and sync controls"
                  icon={Wifi}
                  accentClass="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/40 dark:text-slate-200"
                />
              </motion.div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
                className="premium-card dashboard-summary-card group relative overflow-hidden rounded-[1.75rem] border border-cyan-200/55 bg-gradient-to-br from-white/96 via-sky-50/92 to-cyan-50/84 p-5 min-h-[12rem] shadow-[0_20px_40px_-18px_rgba(14,165,233,0.18)] backdrop-blur-[14px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-22px_rgba(14,165,233,0.22)] dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_40px_-12px_rgba(2,6,23,0.6)] dark:hover:shadow-[0_30px_60px_-20px_rgba(2,6,23,0.7)]"
              >
                <p className="text-sm text-slate-500 dark:text-slate-300 uppercase tracking-[0.22em] mb-2">
                  Safety Score
                </p>
                <h3 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
                  {dashboardInsights.safetyScore}%
                </h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Based on last {latestReadings.length || 0} live readings.
                </p>
              </motion.div>
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
                className="premium-card dashboard-summary-card group relative overflow-hidden rounded-[1.75rem] border border-cyan-200/55 bg-gradient-to-br from-white/96 via-sky-50/92 to-cyan-50/84 p-5 min-h-[12rem] shadow-[0_20px_40px_-18px_rgba(14,165,233,0.18)] backdrop-blur-[14px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-22px_rgba(14,165,233,0.22)] dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_40px_-12px_rgba(2,6,23,0.6)] dark:hover:shadow-[0_30px_60px_-20px_rgba(2,6,23,0.7)]"
              >
                <p className="text-sm font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.22em] mb-2">
                  Predictive Risk
                </p>
                <h3 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
                  {dashboardInsights.riskLevel}
                </h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  {dashboardInsights.trendDelta}
                </p>
              </motion.div>
              <motion.div
                whileHover="hover"
                initial="initial"
                variants={dashboardCardVariants}
                className="premium-card dashboard-summary-card group relative overflow-hidden rounded-[1.75rem] border border-cyan-200/55 bg-gradient-to-br from-white/96 via-sky-50/92 to-cyan-50/84 p-5 min-h-[12rem] shadow-[0_20px_40px_-18px_rgba(14,165,233,0.18)] backdrop-blur-[14px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-22px_rgba(14,165,233,0.22)] dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_40px_-12px_rgba(2,6,23,0.6)] dark:hover:shadow-[0_30px_60px_-20px_rgba(2,6,23,0.7)]"
              >
                <p className="text-sm text-slate-500 dark:text-slate-300 uppercase tracking-[0.22em] mb-2">
                  AI Recommendation
                </p>
                <p className="text-base font-semibold text-slate-950 dark:text-white">
                  {dashboardInsights.recommendation}
                </p>
              </motion.div>
            </div>

          </motion.div>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/88 p-4 sm:p-5 shadow-sm sm:shadow-xl backdrop-blur-sm sm:backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${activeTabMeta.accent} opacity-90`}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.32),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.12),transparent_32%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600/90 dark:text-slate-300/80">
                {activeTabMeta.eyebrow}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
                  {activePageTitle}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ${activeTabMeta.chip}`}
                >
                  {activeTab}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                {activeTabMeta.subtitle}
              </p>
              {devices.length > 0 ? (
                <div className="mt-4 flex max-w-md items-center gap-3 rounded-2xl border border-white/40 bg-white/65 px-3 py-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Switch device
                  </span>
                  <select
                    value={selectedDeviceId ?? devices[0]?.id ?? ""}
                    onChange={(event) =>
                      setSelectedDeviceId(event.target.value)
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none dark:text-white"
                    aria-label="Select active device"
                  >
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ┬╖ {device.status ?? "unknown"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {activeTab === "Overview" ? (
              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void syncDeviceRegistry()}
                    className="rounded-2xl bg-slate-800/85 px-4 py-3 text-white shadow-sm shadow-slate-950/10 hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/15"
                    disabled={syncingDevices}
                  >
                    {syncingDevices ? "Syncing..." : "Sync Data"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setActiveTab("Hardware");
                      setShowAddDeviceModal(true);
                    }}
                    className="rounded-2xl bg-cyan-500 px-4 py-3 text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-600"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Device
                  </Button>
                  {/* <button
                    onClick={() => setShowAddDevice(true)}
                    className="rounded-2xl bg-cyan-500 px-4 py-3 text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-600"
                  >
                    + Add Device
                  </button>
                   */}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-slate-900 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Live mode
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {simulatorOnly ? "Simulator-first" : "Hybrid live sync"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-slate-900 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Selected device
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedDevice?.name ?? "None selected"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-slate-900 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Zone
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedDevice?.zone ?? "Unknown"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>

        <AnimatePresence initial={false}>
          {leftSidebarOpen ? (
            <motion.aside
              key="left-sidebar-open"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="hidden xl:flex fixed left-4 top-20 bottom-4 z-40 w-56 flex-col sidebar-premium p-4"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-1000">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-blue">
                      HydroSentinal
                    </p>
                    <p className="text-xs text-slate-400">User Panel</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLeftSidebarOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                  aria-label="Collapse left navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
                {[
                  {
                    label: "Dashboard",
                    icon: LayoutDashboard,
                    tab: "Overview",
                  },
                  {
                    label: "Command Center",
                    icon: AlertTriangle,
                    tab: "Command Center",
                  },
                  { label: "Charts", icon: ChartLine, tab: "Charts" },
                  {
                    label: "Water Distribution",
                    icon: Waves,
                    tab: "Water Distribution",
                  },
                  { label: "Hardware", icon: Cpu, tab: "Hardware" },
                  { label: "Artificial Intelligence", icon: Brain, tab: "AI" },
                  { label: "Cloud", icon: Cloud, tab: "Cloud" },
                  { label: "Reports", icon: FileBarChart2, tab: "Reports" },
                  { label: "Profile", icon: UserRound, tab: "Profile" },
                  { label: "Settings", icon: Settings, tab: "Settings" },
                  { label: "Help", icon: HelpCircle, tab: "Help" },
                ].map(({ label, icon: Icon, tab }) => {
                  const active =
                    activeTab === tab ||
                    (tab === "Overview" && activeTab === "Overview");

                  return (
                    <button
                      key={label}
                      onClick={() => setActiveTab(tab as DashboardTab)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200 ${active ? "sidebar-item-active" : "text-slate-700 hover:bg-slate-200 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-white"}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          ) : (
            <motion.button
              key="left-sidebar-toggle"
              type="button"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onClick={() => setLeftSidebarOpen(true)}
              className="hidden xl:flex fixed left-4 top-24 z-40 h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-2xl shadow-slate-950/10 backdrop-blur-xl transition hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
              aria-label="Open left navigation"
            >
              <LayoutDashboard className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <aside className="fixed right-3 top-24 z-40 hidden w-14 flex-col items-center gap-3 rounded-full border border-slate-200/80 bg-slate-950/85 py-3 text-slate-300 shadow-2xl shadow-slate-950/20 backdrop-blur-xl xl:flex">
          {[
            { label: "Profile", icon: UserRound },
            { label: "Alerts", icon: AlertTriangle },
            { label: "Announcements", icon: Bell },
            // { label: "Battery", icon: BatteryCharging },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSelectedInfoPanel(
                  label as "Profile" | "Alerts" | "Announcements",
                )
              }
              className={`group relative flex h-11 w-11 items-center justify-center rounded-full shadow-sm shadow-slate-950/20 transition ${selectedInfoPanel === label ? "bg-cyan-500/20 text-cyan-200 ring-2 ring-cyan-400/30" : "bg-slate-900/80 text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-200"}`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-12 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                {label}
              </span>
            </button>
          ))}
        </aside>

        <button
          onClick={() =>
            setSelectedInfoPanel((current) => (current ? null : "Profile"))
          }
          className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-950/40 xl:hidden"
          aria-label={selectedInfoPanel ? "Hide info panel" : "Show info panel"}
        >
          {selectedInfoPanel ? (
            <X className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </button>

        <AnimatePresence>
          {selectedInfoPanel && (
            <>
              <motion.button
                type="button"
                className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedInfoPanel(null)}
                aria-label="Close info panel"
              />
              <motion.aside
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="fixed top-24 right-4 z-50 w-full max-w-sm rounded-[2rem] border border-slate-700/80 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/45 backdrop-blur-xl xl:right-20"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">
                      Info Panel
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {selectedInfoPanel === "Profile"
                        ? "Updates & Status"
                        : selectedInfoPanel}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedInfoPanel(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-600"
                    aria-label="Close info panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 rounded-3xl border border-slate-800/80 bg-slate-900/90 p-3 text-slate-300 shadow-inner shadow-slate-950/10">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-3xl bg-slate-950/90 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Connection
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Live
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-950/90 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Mode
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Hybrid
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-950/90 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Devices
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {devices.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
                  {["Profile", "Alerts", "Announcements"].map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() =>
                        setSelectedInfoPanel(
                          panel as "Profile" | "Alerts" | "Announcements",
                        )
                      }
                      className={`min-w-[7rem] rounded-full border px-3 py-2 text-sm transition ${selectedInfoPanel === panel ? "border-cyan-400 bg-cyan-500/10 text-white" : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-cyan-400 hover:text-white"}`}
                    >
                      {panel}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {selectedInfoPanel === "Profile" ? (
                    <div className="space-y-4">
                      <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/40 text-slate-100">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 text-2xl font-semibold shadow-inner shadow-cyan-500/10">
                          {user?.email?.charAt(0)?.toUpperCase() ?? "U"}
                        </div>
                        <div className="mt-4 text-center">
                          <p className="text-sm font-semibold tracking-wide text-white break-words">
                            {user?.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 break-all">
                            User ID: {user?.uid}
                          </p>
                        </div>
                        <div className="mt-5 grid gap-3">
                          <div className="rounded-3xl bg-slate-900/80 p-3 text-left text-sm text-slate-300">
                            <p className="font-semibold text-white">
                              Cloud sync status
                            </p>
                            <p className="mt-1 text-xs text-cyan-300">
                              Live sync active
                            </p>
                          </div>
                          <Button
                            onClick={handleLogout}
                            className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-emerald-400"
                          >
                            Logout
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-inner shadow-slate-950/10">
                        <h4 className="text-sm font-semibold text-white">
                          Quick Actions
                        </h4>
                        <div className="mt-3 grid gap-2">
                          <button className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white">
                            Sync device data now
                          </button>
                          <button className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-400 hover:text-white">
                            View full profile
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : selectedInfoPanel === "Alerts" ? (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-amber-400/10 bg-amber-500/5 p-4 shadow-inner shadow-amber-500/5">
                        <div className="flex items-center gap-2 text-amber-300">
                          <AlertTriangle className="h-4 w-4" />
                          <h4 className="text-sm font-semibold text-white">
                            Alerts
                          </h4>
                        </div>
                        <div className="mt-3 rounded-3xl bg-slate-950/90 p-4 text-sm text-slate-300">
                          No alerts at the moment.
                        </div>
                      </div>
                      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-inner shadow-slate-950/10">
                        <h4 className="text-sm font-semibold text-white">
                          Health Summary
                        </h4>
                        <p className="mt-3 text-sm text-slate-400">
                          Your system currently reports stable readings and no
                          threshold breaches in the last 24 hours.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["pH stable", "TDS normal", "Turbidity clear"].map(
                            (item) => (
                              <span
                                key={item}
                                className="rounded-full bg-slate-950/80 px-3 py-1 text-xs text-slate-300"
                              >
                                {item}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-inner shadow-slate-950/10">
                        <div className="flex items-center gap-2 text-cyan-300">
                          <Bell className="h-4 w-4" />
                          <h4 className="text-sm font-semibold text-white">
                            Announcements
                          </h4>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-slate-300">
                          {[
                            "Try real-time water quality monitoring system.",
                            "New export options for device data.",
                            "Enhanced security features for device management.",
                            "Improved sync for real devices.",
                            "AI assistant available in Charts.",
                          ].map((item) => (
                            <li
                              key={item}
                              className="rounded-2xl bg-slate-950/80 px-3 py-3 transition hover:bg-slate-800"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-inner shadow-slate-950/10">
                        <p className="text-sm font-semibold text-white">Tips</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Use the panel to access quick user actions without
                          leaving the dashboard.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        {/* Map View Section - Temporarily disabled due to react-leaflet compatibility */}
        {/* TODO: Fix react-leaflet integration with React 18.3.1 */}

        {selectedDevice ? (
          <>
            {activeTab === "Overview" ? (
              <div className="space-y-3 md:rounded-2xl md:border md:border-slate-700 md:bg-slate-800/50 md:p-4">
                <ActionBar
                  monitorRunning={monitorRunning}
                  onStart={startMonitoring}
                  onStop={stopMonitoring}
                  onLoad={() => fileInputRef.current?.click()}
                  onSave={handleSaveData}
                />
                <input
                  ref={fileInputRef}
                  onChange={handleLoadFile}
                  type="file"
                  accept="application/json"
                  className="hidden"
                />
                <StatusBar
                  monitorRunning={monitorRunning}
                  timerSeconds={timerSeconds}
                  connectionStatus={connectionStatus}
                />
              </div>
            ) : null}

            {/* <StatusBanner
              status={latest?.status}
              updatedAt={latest?.timestamp}
              simulatorRunning={true}
            /> */}

            {/* <div className="mt-4 mb-4 rounded-2xl border border-slate-700/60 bg-slate-900/30 p-4"> */}
            {/* <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">Current Page</p> */}
            {/* <h2 className="mt-1 text-2xl font-semibold text-white">{activePageTitle}</h2> */}
            {/* <p className="mt-1 text-sm text-slate-300">
                Use the left navigation to switch pages. The left and right panels stay fixed while the center section swaps like a page.
              </p> */}
            {/* </div> */}

            <AnimatePresence mode="wait">
              {activeTab === "Overview" && (
                <motion.div
                  key="overview-page"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <section className="space-y-5">
                    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-200">
                              Reading-first dashboard
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                              Live device
                            </span>
                          </div>

                          <div>
                            <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">
                              {selectedDevice.name}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              Device ID: {selectedDevice.uniqueId} | Installed
                              at: {selectedDevice.location}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                              Owner:{" "}
                              {selectedDevice.ownerUid === user?.uid
                                ? (user?.email ?? selectedDevice.ownerUid)
                                : selectedDevice.ownerUid}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                Battery
                              </p>
                              <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                {selectedDevice.battery ?? 0}%
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                Zone
                              </p>
                              <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                {selectedDevice.zone ?? "Unknown"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                Mode
                              </p>
                              <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                {simulatorOnly ? "Simulator" : "Hybrid"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <Button
                            onClick={() => setShowDataPanel((prev) => !prev)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2"
                          >
                            <Table2 className="w-4 h-4" />
                            {showDataPanel ? "Hide table" : "Data table"}
                          </Button>
                          <Button
                            onClick={() => void addNewReading()}
                            disabled={addReadingLoading}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            Add Reading
                          </Button>
                        </div>
                      </div>
                    </div>

                    {showDataPanel && (
                      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                              Live Readings
                            </h3>
                            <p className="mt-1 text-xs text-cyan-600 dark:text-cyan-300">
                              Device ID: {selectedDevice.uniqueId}
                            </p>
                          </div>
                          <Button
                            onClick={() => setShowDataPanel(false)}
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                          >
                            Close
                          </Button>
                        </div>

                        {latestReadings.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No readings found.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-full text-left text-sm sm:min-w-[720px]">
                              <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800/80 dark:text-gray-400">
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
                              <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-700 dark:text-gray-200">
                                {latestReadings.map((reading, index) => (
                                  <tr
                                    key={`${selectedDevice.id}-${reading.timestamp}-${index}`}
                                  >
                                    <td className="px-4 py-3">{index + 1}</td>
                                    <td className="px-4 py-3">
                                      {new Date(
                                        reading.timestamp,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">{reading.ph}</td>
                                    <td className="px-4 py-3">{reading.tds}</td>
                                    <td className="px-4 py-3">
                                      {reading.turbidity}
                                    </td>
                                    <td className="px-4 py-3">
                                      {reading.temperature}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`rounded-full px-2 py-1 text-xs ${
                                          reading.status === "SAFE"
                                            ? "bg-green-500/20 text-green-700 dark:text-green-300"
                                            : "bg-red-500/20 text-red-700 dark:text-red-300"
                                        }`}
                                      >
                                        {reading.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}

                    <div className="mt-5">
                      <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/70">
                        <StatusBanner
                          status={latest?.status}
                          updatedAt={latest?.timestamp}
                          simulatorRunning={true}
                        />

                          <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4 items-stretch">
                            <SensorCard
                              label="pH"
                              value={latest?.ph}
                              unit=""
                              icon="ph"
                              safeRange="6.5 - 8.5"
                              alert={
                                (latest?.ph ?? 7) < 6.5 || (latest?.ph ?? 7) > 8.5
                              }
                              sparkline={history.map((h) => h.ph)}
                            />
                            <SensorCard
                              label="TDS"
                              value={latest?.tds}
                              unit="ppm"
                              icon="tds"
                              safeRange="200 - 1000"
                              alert={(latest?.tds ?? 0) > 1000}
                              sparkline={history.map((h) => h.tds)}
                            />
                            <SensorCard
                              label="Turbidity"
                              value={latest?.turbidity}
                              unit="NTU"
                              icon="turbidity"
                              safeRange="0 - 25"
                              alert={(latest?.turbidity ?? 0) > 25}
                              sparkline={history.map((h) => h.turbidity)}
                            />
                            <SensorCard
                              label="Temperature"
                              value={latest?.temperature}
                              unit="deg C"
                              icon="temperature"
                              safeRange="20 - 35"
                              sparkline={history.map((h) => h.temperature)}
                            />
                          </section>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === "Command Center" && (
                <motion.section
                  key="command-center-page"
                  className="relative overflow-hidden rounded-[2.25rem] border border-cyan-400/15 bg-slate-950/95 p-5 shadow-[0_40px_100px_-35px_rgba(8,145,178,0.45)] ring-1 ring-white/5 sm:p-6"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]" />
                  <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
                  <div className="relative space-y-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div className="max-w-4xl space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200">
                            AI Operations Center
                          </span>
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                            Live telemetry
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-200">
                            Mission control
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-300/80">
                            Command Center
                          </p>
                          <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                            AI-Powered Water Operations Center
                          </h3>
                          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">
                            Current State → Risk → Cause → Prediction → Recommendation → Action.
                            This workspace turns live water telemetry into a mission-control view with predictive intelligence, incident response, and operator guidance.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={handleGenerateIncidentReport}
                          className="rounded-2xl border border-cyan-400/25 bg-cyan-500/15 px-4 py-3 text-cyan-100 shadow-lg shadow-cyan-950/20 hover:bg-cyan-500/25"
                        >
                          <FileBarChart2 className="mr-2 h-4 w-4" />
                          {incidentReportCopied ? "Report Copied" : "Incident Report"}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setHydroAiOpen((value) => !value)}
                          className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 text-emerald-100 shadow-lg shadow-emerald-950/20 hover:bg-emerald-500/25"
                        >
                          <Brain className="mr-2 h-4 w-4" />
                          HydroAI Assistant
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      {commandCenterModel.recentTimeline.map((item, index) => (
                        <div
                          key={item.id}
                          className={`rounded-3xl border p-4 backdrop-blur-xl ${index === 0 ? "border-cyan-400/20 bg-cyan-500/10" : index === 1 ? "border-rose-400/20 bg-rose-500/10" : index === 2 ? "border-amber-400/20 bg-amber-500/10" : index === 3 ? "border-blue-400/20 bg-blue-500/10" : "border-emerald-400/20 bg-emerald-500/10"}`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-300">
                            {item.stage}
                          </p>
                          <h4 className="mt-2 text-sm font-semibold text-white">
                            {item.title}
                          </h4>
                          <p className="mt-2 text-xs leading-5 text-slate-300">
                            {item.detail}
                          </p>
                          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            {item.time}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.14fr_0.86fr]">
                      <div className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                          <div className="rounded-[2rem] border border-cyan-400/15 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                                  Water Quality Health Score
                                </p>
                                <h4 className="mt-2 text-2xl font-black text-white">
                                  {commandCenterModel.qualityScore}/100
                                </h4>
                                <p className="mt-2 text-sm text-slate-300">
                                  Real-time composite score derived from sensor stability, alert pressure, and device health.
                                </p>
                              </div>
                              <div className="relative h-32 w-32 shrink-0">
                                <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                                  <circle cx="60" cy="60" r="52" className="fill-none stroke-white/10" strokeWidth="12" />
                                  <circle
                                    cx="60"
                                    cy="60"
                                    r="52"
                                    className="fill-none stroke-cyan-400"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                                    strokeDashoffset={2 * Math.PI * 52 - (commandCenterModel.qualityScore / 100) * (2 * Math.PI * 52)}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-center">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                      Health
                                    </p>
                                    <p className="text-xl font-black text-white">
                                      {commandCenterModel.currentStateTone === "rose"
                                        ? "Alert"
                                        : commandCenterModel.currentStateTone === "amber"
                                          ? "Watch"
                                          : "Clear"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              {[
                                { label: "Safe readings", value: `${commandCenterModel.safeReadings}` },
                                { label: "Alert count", value: `${commandCenterModel.alertCount}` },
                                { label: "Anomalies", value: `${commandCenterModel.anomalyCount}` },
                              ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                                  <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-[2rem] border border-rose-400/15 bg-rose-500/10 p-5 shadow-2xl shadow-rose-950/20 backdrop-blur-xl">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-200/80">
                                AI Risk Prediction
                              </p>
                              <div className="mt-4 flex items-end gap-4">
                                <div>
                                  <p className="text-3xl font-black text-white">{commandCenterModel.risk24h}%</p>
                                  <p className="text-xs uppercase tracking-[0.22em] text-rose-200/80">24h</p>
                                </div>
                                <div>
                                  <p className="text-3xl font-black text-white">{commandCenterModel.risk48h}%</p>
                                  <p className="text-xs uppercase tracking-[0.22em] text-rose-200/80">48h</p>
                                </div>
                              </div>
                              <div className="mt-4 space-y-2">
                                {[commandCenterModel.risk24h, commandCenterModel.risk48h].map((value, index) => (
                                  <div key={`${value}-${index}`} className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={`h-full rounded-full ${index === 0 ? "bg-cyan-400" : "bg-rose-400"}`}
                                      style={{ width: `${value}%` }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                                Live Monitoring Status Banner
                              </p>
                              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
                                <p className="text-lg font-semibold text-white">
                                  {commandCenterModel.currentStateLabel}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                  {waterAlerts.isLoading
                                    ? "Listening to live alert telemetry..."
                                    : commandCenterModel.alertCount > 0
                                      ? "Active alerts are being triaged in real time."
                                      : "No active alerts. Derived intelligence is monitoring sensor history for early warning signs."}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">Connection {connectionStatus}</span>
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">Zone {selectedDevice?.zone ?? "Unknown"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 sm:col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                                AI Root Cause Analysis
                              </p>
                              <div className="mt-3 space-y-3">
                                {commandCenterModel.causeSignals.map((signal) => (
                                  <div key={signal} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                                    {signal}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                              Sensor Trend Intelligence
                            </p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {commandCenterModel.sensorTrendCards.map((card) => (
                                <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                                  <p className="mt-2 text-lg font-bold text-white">{card.value}</p>
                                  <p className="mt-1 text-xs text-slate-300">{card.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[2rem] border border-cyan-400/15 bg-cyan-500/10 p-5 shadow-2xl shadow-cyan-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">
                              Water Quality Radar Chart
                            </p>
                            <div className="mt-4 flex justify-center">
                              <svg viewBox="0 0 240 240" className="h-64 w-full max-w-xs">
                                <circle cx="120" cy="120" r="88" className="fill-none stroke-white/10" strokeWidth="1" />
                                <circle cx="120" cy="120" r="64" className="fill-none stroke-white/10" strokeWidth="1" />
                                <circle cx="120" cy="120" r="40" className="fill-none stroke-white/10" strokeWidth="1" />
                                {commandCenterModel.radarMetrics.map((metric, index) => {
                                  const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / commandCenterModel.radarMetrics.length;
                                  const outerX = 120 + Math.cos(angle) * 88;
                                  const outerY = 120 + Math.sin(angle) * 88;
                                  const valueX = 120 + Math.cos(angle) * (metric.value / 100) * 88;
                                  const valueY = 120 + Math.sin(angle) * (metric.value / 100) * 88;
                                  const labelX = 120 + Math.cos(angle) * 108;
                                  const labelY = 120 + Math.sin(angle) * 108;

                                  return (
                                    <g key={metric.label}>
                                      <line x1="120" y1="120" x2={outerX} y2={outerY} className="stroke-white/15" strokeWidth="1" />
                                      <circle cx={valueX} cy={valueY} r="3.5" className="fill-cyan-300" />
                                      <text x={labelX} y={labelY} fill="rgba(226,232,240,0.9)" fontSize="10" textAnchor="middle" dominantBaseline="middle">
                                        {metric.label}
                                      </text>
                                    </g>
                                  );
                                })}
                                <polygon
                                  points={commandCenterModel.radarMetrics
                                    .map((metric, index) => {
                                      const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / commandCenterModel.radarMetrics.length;
                                      const x = 120 + Math.cos(angle) * (metric.value / 100) * 88;
                                      const y = 120 + Math.sin(angle) * (metric.value / 100) * 88;
                                      return `${x},${y}`;
                                    })
                                    .join(" ")}
                                  className="fill-cyan-400/25 stroke-cyan-300"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">
                              Historical Trend Explorer
                            </p>
                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <WaterGraph
                                  data={commandCenterModel.historicalTrendExplorer.tdsTrail.map((value, index) => ({
                                    time: index + 1,
                                    tds: value,
                                  }))}
                                  type="tds"
                                  title="TDS trend"
                                  color="#22d3ee"
                                />
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <WaterGraph
                                  data={commandCenterModel.historicalTrendExplorer.recentSamples.map((sample, index) => ({
                                    time: index + 1,
                                    ph: sample.ph,
                                    turbidity: sample.turbidity,
                                  }))}
                                  type="ph"
                                  title="pH and turbidity trend"
                                  color="#34d399"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                              Smart Incident Timeline
                            </p>
                            <div className="mt-4 space-y-4">
                              {commandCenterModel.liveActivityFeed.map((entry) => (
                                <div key={entry.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${entry.tone === "rose" ? "bg-rose-400" : entry.tone === "amber" ? "bg-amber-400" : entry.tone === "cyan" ? "bg-cyan-400" : "bg-emerald-400"}`} />
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{entry.label}</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{entry.title}</p>
                                    <p className="mt-1 text-xs text-slate-300">{entry.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                              Predictive Maintenance
                            </p>
                            <div className="mt-4 space-y-3">
                              {commandCenterModel.predictiveMaintenance.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-white">{item.label}</p>
                                    <span className="text-sm font-bold text-cyan-200">{item.value}</span>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-300">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-200/80">
                              AI Recommendations Engine
                            </p>
                            <div className="mt-4 space-y-3">
                              {commandCenterModel.recommendations.map((item, index) => (
                                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <div className="mt-1 h-6 w-6 rounded-full bg-cyan-500/15 text-center text-xs font-bold leading-6 text-cyan-200">
                                    {index + 1}
                                  </div>
                                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                              Alert Heatmap
                            </p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {commandCenterModel.derivedHeatmap.map((zone) => (
                                <div key={zone.name} className={`rounded-2xl border p-4 ${zone.tone === "amber" ? "border-amber-400/20 bg-amber-500/10" : "border-emerald-400/20 bg-emerald-500/10"}`}>
                                  <p className="text-sm font-semibold text-white">{zone.name}</p>
                                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-300">{zone.devices} devices</p>
                                  <p className="mt-1 text-sm text-slate-200">{zone.safe} safe / {zone.unsafe} unsafe</p>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${zone.avgScore}%` }} />
                                  </div>
                                  <p className="mt-2 text-xs text-slate-300">Avg zone score {zone.avgScore}/100</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Geo Zone Status Card</p>
                                <p className="mt-2 text-lg font-bold text-white">{selectedDevice?.zone ?? "Unknown zone"}</p>
                                <p className="mt-1 text-sm text-slate-300">Tracked against live device positions and latest readings.</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Environmental Impact Insights</p>
                                <p className="mt-2 text-lg font-bold text-white">{commandCenterModel.environmentalImpact.safeguardedLiters.toLocaleString()} L protected</p>
                                <p className="mt-1 text-sm text-slate-300">{commandCenterModel.environmentalImpact.avoidedIncidents} incidents avoided, {commandCenterModel.environmentalImpact.co2Saved} kg CO2 saved.</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                                Severity Analytics
                              </p>
                              <div className="mt-4 space-y-3">
                                {commandCenterModel.severityAnalytics.map((item) => (
                                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold text-white">{item.label}</p>
                                      <p className="text-sm font-black text-cyan-200">{item.value}</p>
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                      <div className={`h-full rounded-full ${item.tone === "rose" ? "bg-rose-400" : item.tone === "amber" ? "bg-amber-400" : "bg-cyan-400"}`} style={{ width: `${Math.max(item.value * 20, 10)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                                Resolution Performance Metrics
                              </p>
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {commandCenterModel.resolutionMetrics.map((item) => (
                                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                                    <p className="mt-2 text-lg font-bold text-white">{item.value}</p>
                                    <p className="mt-1 text-xs text-slate-300">{item.detail}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">
                              AI Root Cause + Action Plan
                            </p>
                            <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4 text-slate-200">
                              <p className="text-sm font-semibold text-white">Immediate focus</p>
                              <p className="mt-2 text-sm leading-6">{commandCenterModel.recommendations[0]}</p>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Root cause drivers</p>
                                <p className="mt-2 text-sm text-slate-200">{commandCenterModel.causeSignals.join(" ")}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Action</p>
                                <p className="mt-2 text-sm text-slate-200">One click report, live triage, and predictive maintenance are ready for the operator workflow.</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                              Live Alert Stream
                            </p>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                              <AlertPanel
                                alerts={waterAlerts.recentAlerts}
                                currentLevel={waterAlerts.currentLevel}
                                isLoading={waterAlerts.isLoading}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                            One Click Incident Report Generator
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            Generate an operator-ready incident summary with the current state, root cause, prediction, and next action.
                          </p>
                          <Button
                            type="button"
                            onClick={handleGenerateIncidentReport}
                            className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-white shadow-lg shadow-cyan-950/20 hover:bg-cyan-400"
                          >
                            <DownloadCloud className="mr-2 h-4 w-4" />
                            {incidentReportCopied ? "Copied to Clipboard" : "Copy Incident Report"}
                          </Button>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                            Device Health Monitoring
                          </p>
                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Battery</p>
                              <p className="mt-2 text-2xl font-black text-white">{commandCenterModel.deviceHealth.battery}%</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Sync</p>
                              <p className="mt-2 text-sm font-semibold text-white">{commandCenterModel.deviceHealth.syncStatus}</p>
                              <p className="mt-1 text-xs text-slate-300">Connection {commandCenterModel.deviceHealth.connection}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Last reading</p>
                              <p className="mt-2 text-sm font-semibold text-white">{commandCenterModel.deviceHealth.lastReading}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-200/80">
                            Anomaly Detection Engine
                          </p>
                          <div className="mt-4 space-y-3">
                            {commandCenterModel.causeSignals.slice(0, 3).map((signal) => (
                              <div key={signal} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                                {signal}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {hydroAiOpen ? (
                    <div className="fixed bottom-24 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] border border-cyan-400/20 bg-slate-950/95 p-4 shadow-[0_30px_80px_-30px_rgba(34,211,238,0.55)] backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
                            Floating HydroAI Assistant
                          </p>
                          <h4 className="mt-1 text-lg font-bold text-white">Mission copiloting</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHydroAiOpen(false)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          aria-label="Close HydroAI assistant"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {commandCenterModel.recommendations.map((item) => (
                          <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200">
                            {item}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          "Explain current risk",
                          "Generate report",
                          "Focus on root cause",
                        ].map((prompt) => (
                          <span key={prompt} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                            {prompt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </motion.section>
              )}

              {activeTab === "Charts" && (
                <motion.section
                  key="charts-page"
                  className="space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                      Charts
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Trend-only workspace for water analytics.
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <WaterGraph data={tdsData} type="tds" />
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <WaterGraph data={phTurbidityData} type="ph" />
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === "Water Distribution" && (
                <motion.section
                  key="geo-page"
                  className="space-y-5 rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                        Geo Intelligence Center
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Satellite-first view with clustering, heatmap, zone
                        intelligence and unsafe spread prediction.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => setGeoHeatmapEnabled((prev) => !prev)}
                        className={`${geoHeatmapEnabled ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-700 hover:bg-slate-600"} text-white`}
                      >
                        <Flame className="mr-2 h-4 w-4" />
                        Heatmap {geoHeatmapEnabled ? "On" : "Off"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setGeoSimulationEnabled((prev) => !prev)}
                        className={`${geoSimulationEnabled ? "bg-cyan-500 hover:bg-cyan-600" : "bg-slate-700 hover:bg-slate-600"} text-white`}
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        Sim 70 Devices {geoSimulationEnabled ? "On" : "Off"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setGeoSoundEnabled((prev) => !prev)}
                        className={`${geoSoundEnabled ? "bg-red-500 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600"} text-white`}
                      >
                        <Siren className="mr-2 h-4 w-4" />
                        Alert Sound {geoSoundEnabled ? "On" : "Off"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
                    <div className="min-h-[8rem] sm:min-h-[10rem] lg:h-[20rem] overflow-hidden rounded-[1.5rem]">
                      <LiveDeviceMap
                        userId={user?.uid}
                        devices={devices}
                        latestReadings={latestReadingByDevice}
                        onDeviceSelect={handleMapDeviceSelect}
                        selectedDeviceId={selectedDeviceId ?? undefined}
                        height="h-full"
                        showHeatmap={geoHeatmapEnabled}
                        showClustering={true}
                        showGeofences={true}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                        {selectedDevice ? (
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2">
                              Device Status
                            </p>
                            <p className="text-lg font-black text-slate-950 dark:text-white">
                              {selectedDevice.name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                              {selectedDevice.location ||
                                "📍 Location not configured"}
                            </p>
                            {!selectedDevice.latitude ||
                            !selectedDevice.longitude ? (
                              <div className="mt-2 p-2 rounded bg-amber-500/20 border border-amber-500/30">
                                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                                  ⚠ Location not configured
                                </p>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                ✓ Real location configured
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                              Selected device
                            </p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              Click a marker on the map to view device details
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          Radius intelligence
                        </p>
                        <div className="mt-3 space-y-2">
                          {radiusInsights.map((insight) => (
                            <div
                              key={insight.radiusKm}
                              className="rounded-xl bg-slate-100/80 p-3 text-xs text-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                            >
                              <p className="font-semibold">
                                {insight.radiusKm} km
                              </p>
                              <p>
                                {insight.totalDevices} devices,{" "}
                                {insight.unsafeDevices} unsafe
                              </p>
                              <p>
                                Avg score {insight.avgSafetyScore}, pH{" "}
                                {insight.avgPh}, Turbidity{" "}
                                {insight.avgTurbidity}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {spreadPrediction ? (
                    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-red-700 dark:text-red-200">
                      <p className="font-semibold">
                        Unsafe Spread Prediction - {spreadPrediction.riskScore}%
                        risk
                      </p>
                      <p className="mt-1 text-sm">{spreadPrediction.message}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ZoneIntelligencePanel zones={zoneInsights} />
                    <GeoAlertFeed alerts={displayedGeoAlerts} />
                  </div>
                </motion.section>
              )}

              {activeTab === "AI" && (
                <motion.section
                  key="ai-page"
                  className="grid gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)]"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                        Reading panel
                      </p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                        AI context
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Latest reading and expert chat live together.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Selected device
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                        {selectedDevice?.name ?? "No device selected"}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        {latest
                          ? `Latest pH ${latest.ph}, TDS ${latest.tds} ppm, Turbidity ${latest.turbidity} NTU, Temperature ${latest.temperature} ┬░C`
                          : "No readings available yet."}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Reading status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {latest?.status ?? "No data"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Last update
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {latest?.timestamp
                            ? (() => {
                                const iso = toIsoLocal(latest.timestamp);
                                return iso
                                  ? new Date(iso).toLocaleString()
                                  : String(latest.timestamp);
                              })()
                            : "Unknown"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/70">
                    <ChatPanel />
                  </div>
                </motion.section>
              )}

              {activeTab === "Cloud" && (
                <motion.section
                  key="cloud-page"
                  className="space-y-5 rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                      Cloud
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Sync and last-reading workflow for the selected device.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                        Sync
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                        Refresh registry
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Pull the latest device list from Firebase and preserve
                        local data on failure.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void syncDeviceRegistry()}
                          className="bg-cyan-500 hover:bg-cyan-600 text-white"
                          disabled={syncingDevices}
                        >
                          {syncingDevices ? "Syncing..." : "Sync now"}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          Load backup
                        </Button>
                        <input
                          ref={fileInputRef}
                          onChange={handleLoadFile}
                          type="file"
                          accept="application/json"
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                        Last reading
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                        {selectedDevice?.name ?? "No device selected"}
                      </p>
                      {latest ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <p>
                            Time:{" "}
                            {(() => {
                              const iso = toIsoLocal(latest.timestamp);
                              return iso
                                ? new Date(iso).toLocaleString()
                                : String(latest.timestamp);
                            })()}
                          </p>
                          <p>pH: {latest.ph}</p>
                          <p>TDS: {latest.tds} ppm</p>
                          <p>Turbidity: {latest.turbidity} NTU</p>
                          <p>Temperature: {latest.temperature} ┬░C</p>
                          <p>Status: {latest.status}</p>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                          No readings available yet.
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          onClick={handleSaveData}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Download backup
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === "Hardware" && (
                <motion.section
                  key="hardware-page"
                  className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                      Hardware
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Connected devices and sensor state.
                    </p>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                          Device registry
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          Sync devices and register new hardware here.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void syncDeviceRegistry()}
                          className="bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200"
                          disabled={syncingDevices}
                        >
                          {syncingDevices ? "Syncing..." : "Sync Devices"}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setActiveTab("Hardware");
                            setShowAddDeviceModal(true);
                          }}
                          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-cyan-500/50 transition-all duration-200"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Device
                        </Button>
                      </div>
                    </div>

                    {showAddForm && (
                      <form
                        onSubmit={handleAddDevice}
                        className="mt-4 grid gap-3 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/10 md:grid-cols-4"
                      >
                        <Input
                          placeholder="Device name"
                          value={newDevice.name}
                          onChange={(event) =>
                            setNewDevice((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                        <select
                          value={newDevice.type}
                          onChange={(event) => {
                            setNewDevice((prev) => ({
                              ...prev,
                              type: event.target.value as "simulator" | "real",
                            }));
                            setNewDeviceConnected(
                              event.target.value === "simulator",
                            );
                          }}
                          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                        >
                          <option value="simulator">Simulator</option>
                          <option value="real">Real Device</option>
                        </select>
                        <Input
                          placeholder="Manual location name"
                          value={newDevice.manualLocation}
                          onChange={(event) =>
                            setNewDevice((prev) => ({
                              ...prev,
                              manualLocation: event.target.value,
                            }))
                          }
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                        <div className="md:col-span-4">
                          <DeviceLocationPicker
                            value={newDeviceMapLocation}
                            onChange={(next) => {
                              setNewDeviceMapLocation(next);
                              setNewDevice((prev) => ({
                                ...prev,
                                manualLocation:
                                  next.address ||
                                  next.label ||
                                  prev.manualLocation,
                                latitude: next.lat,
                                longitude: next.lng,
                              }));
                            }}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          {newDevice.type === "real" ? (
                            <>
                              <Button
                                type="button"
                                className={`bg-blue-500 hover:bg-blue-600 text-white ${newDeviceConnected ? "opacity-80" : ""}`}
                                onClick={() => setNewDeviceConnected(true)}
                              >
                                {newDeviceConnected
                                  ? "Connected"
                                  : "Connect Device"}
                              </Button>
                              <span
                                className={`text-sm ${newDeviceConnected ? "text-emerald-300" : "text-amber-300"}`}
                              >
                                {newDeviceConnected
                                  ? "Real device connected"
                                  : "Connect to enable registration"}
                              </span>
                            </>
                          ) : (
                            <div className="text-sm text-emerald-200">
                              Simulator mode selected. Enter location and
                              coordinates.
                            </div>
                          )}
                        </div>
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/35 px-4 py-3 text-sm text-slate-200 md:col-span-3">
                          <p className="flex items-center gap-2 font-semibold text-cyan-300">
                            <LocateFixed className="h-4 w-4" />
                            Precise Coordinates
                          </p>
                          <p className="mt-1">
                            {newDeviceMapLocation.lat.toFixed(5)},{" "}
                            {newDeviceMapLocation.lng.toFixed(5)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Stored in database for geo-intelligence, clustering
                            and radius insights.
                          </p>
                        </div>
                        <Button
                          type="submit"
                          className="bg-green-500 hover:bg-green-600 text-white md:col-span-4"
                          disabled={addDeviceLoading}
                        >
                          {addDeviceLoading
                            ? "Registering..."
                            : "Register Device"}
                        </Button>
                      </form>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => setSelectedDeviceId(device.id)}
                        className={`rounded-2xl border p-4 text-left transition-all duration-200 ${selectedDeviceId === device.id ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]" : "border-slate-200/80 bg-slate-50/90 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                              {device.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {device.uniqueId}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${device.status === "active" ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}
                          >
                            {device.status}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                            Battery: {device.battery ?? 0}%
                          </div>
                          <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                            Type: {device.deviceType ?? "simulator"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.section>
              )}

              {activeTab === "Reports" && (
                <motion.section
                  key="reports-page"
                  className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                      Reports
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Export summary data when you need it.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={downloadCSV}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={handleSaveData}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
                    >
                      Download JSON
                    </button>
                  </div>
                </motion.section>
              )}

              {activeTab === "Profile" && (
                <motion.section
                  key="profile-page"
                  className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">
                      Smart Profile Center
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                      Experience our premium profile management system
                    </p>
                    <button
                      onClick={() => navigate("/profile")}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition"
                    >
                      Open Full Profile →
                    </button>
                  </div>
                </motion.section>
              )}

              {activeTab === "Settings" && (
                <motion.section
                  key="settings-page"
                  className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                    Settings
                  </h3>
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-slate-600 dark:text-slate-400">
                      Simulator only:
                    </label>
                    <button
                      onClick={() => setSimulatorOnly((s) => !s)}
                      className={`px-3 py-2 rounded ${simulatorOnly ? "bg-green-600 text-white" : "bg-slate-700 text-white"}`}
                    >
                      {simulatorOnly ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveTab("Overview");
                      }}
                      className="px-3 py-2 bg-cyan-600 rounded text-white"
                    >
                      Return to Overview
                    </button>
                  </div>
                </motion.section>
              )}

              {activeTab === "Help" && (
                <motion.section
                  key="help-page"
                  className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <HelpSupportSection />
                </motion.section>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-gray-300">
            Select a device to view readings, graph, and chat analysis.
          </div>
        )}

        {/* Device Detail Popup */}
        {selectedDetailDevice && (
          <DeviceDetailPopup
            device={selectedDetailDevice}
            latestReading={latestReadings[0]}
            onClose={() => setSelectedDetailDevice(null)}
            onAnalytics={() => {
              setActiveTab("Charts");
              setSelectedDetailDevice(null);
            }}
            recentReadings={history.slice(-10)}
          />
        )}
        <FloatingSyncWidget
          syncing={syncingDevices}
          onSync={() => void syncDeviceRegistry()}
        />
        <BottomDock
          activeTab={mobileNavigationActive}
          onNavigate={(tab) => {
            if (tab === "Alerts") {
              setSelectedInfoPanel("Alerts");
              return;
            }

            setSelectedInfoPanel(null);
            setActiveTab(tab as DashboardTab);
          }}
        />
      </div>
    </main>
  );
};

export default UserDashboard;
