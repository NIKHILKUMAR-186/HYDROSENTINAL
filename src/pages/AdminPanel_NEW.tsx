// AdminPanel.tsx - Complete Supabase Migration
// All Firebase queries removed and replaced with Supabase

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

// Import Supabase services instead of Firebase
import { 
  adminService, 
  deviceService, 
  readingsService, 
  complaintsService 
} from "@/services/supabaseService";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Import types
type UserRole = "user" | "admin";

type UserSummary = {
  id: string;
  email: string;
  role: UserRole;
  deviceCount: number;
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

type DeviceRecord = {
  id: string;
  owner_uid: string;
  name: string;
  unique_id: string;
  location: string;
  device_type?: "simulator" | "real";
  status: "active" | "inactive";
  battery?: number;
  created_at: string;
  updated_at: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  zone?: string;
  installation_type?: string;
  is_location_configured?: boolean;
  last_location_update?: string;
};

// Helper functions
const formatDate = (date?: string) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return "Invalid date";
  }
};

const getSyncFreshnessMeta = (lastSyncAt: string) => ({
  lastSyncAt: lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "Never",
  isFresh: lastSyncAt ? new Date().getTime() - new Date(lastSyncAt).getTime() < 60000 : false,
});

const mergeDeviceRecords = (rootDevices: DeviceRecord[], nestedDevices: DeviceRecord[]) => {
  const merged = new Map<string, DeviceRecord>();
  [...rootDevices, ...nestedDevices].forEach((device) => {
    merged.set(device.id, device);
  });
  return Array.from(merged.values());
};

const readLocalUsers = (): UserSummary[] => {
  try {
    const data = localStorage.getItem("admin.users");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const readLocalDevices = (): DeviceRecord[] => {
  try {
    const data = localStorage.getItem("admin.devices");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalUsers = (users: UserSummary[]) => {
  localStorage.setItem("admin.users", JSON.stringify(users));
};

const saveLocalDevices = (devices: DeviceRecord[]) => {
  localStorage.setItem("admin.devices", JSON.stringify(devices));
};

// Main Component
const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [rootDevices, setRootDevices] = useState<DeviceRecord[]>([]);
  const [nestedDevices, setNestedDevices] = useState<DeviceRecord[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersSyncMode, setUsersSyncMode] = useState<"live" | "degraded" | "fallback">("live");
  const [devicesSyncMode, setDevicesSyncMode] = useState<"live" | "degraded" | "fallback">("live");
  const [lastSyncAt, setLastSyncAt] = useState<string>("");

  // Auth check
  useEffect(() => {
    if (!loading && role !== "admin") {
      navigate("/");
    }
  }, [role, loading, navigate]);

  // Load data from Supabase
  useEffect(() => {
    let isMounted = true;

    const loadAdminData = async () => {
      try {
        // Fetch all users from Supabase
        console.log("[ADMIN PANEL] Loading users and devices from Supabase");
        const allUsers = await adminService.getAllUsers();
        
        if (!isMounted) return;

        const userSummaries: UserSummary[] = allUsers.map((profile: any) => ({
          id: profile.id,
          email: profile.email || "unknown@user",
          role: profile.role || "user",
          deviceCount: 0,
          name: profile.full_name,
          organization: profile.organization_name,
          phone: profile.phone,
          createdAt: profile.created_at,
          lastLoginAt: profile.last_login,
        }));

        console.log("[ADMIN PANEL] Users loaded:", userSummaries.length);
        setUsers(userSummaries);
        setUsersSyncMode("live");
        setLastSyncAt(new Date().toISOString());
        saveLocalUsers(userSummaries);
        
        if (userSummaries.length > 0) {
          setSelectedUserId(userSummaries.find((u) => u.role === "user")?.id ?? userSummaries[0].id);
        }

        // Fetch all devices
        const allDevices = await deviceService.getAllDevices();
        console.log("[ADMIN PANEL] Devices loaded:", allDevices.length);
        
        if (!isMounted) return;

        setRootDevices(allDevices);
        setDevicesSyncMode("live");
        setLastSyncAt(new Date().toISOString());
        saveLocalDevices(allDevices);

        setLoading(false);
      } catch (error) {
        console.error("[ADMIN PANEL] Error loading data:", error);
        
        if (!isMounted) return;

        // Fallback to localStorage
        const localUsers = readLocalUsers();
        const localDevices = readLocalDevices();
        
        setUsers(localUsers);
        setRootDevices(localDevices);
        setUsersSyncMode("fallback");
        setDevicesSyncMode("fallback");
        setLastSyncAt(new Date().toISOString());
        setLoading(false);
      }
    };

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedUser = users.find((entry) => entry.id === selectedUserId) ?? null;
  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [selectedDeviceId, devices]
  );

  const selectedUserDevices = useMemo(
    () => devices.filter((device) => device.owner_uid === selectedUserId),
    [devices, selectedUserId]
  );

  useEffect(() => {
    setDevices(mergeDeviceRecords(rootDevices, nestedDevices));
  }, [rootDevices, nestedDevices]);

  // Load readings when device selected
  useEffect(() => {
    if (!selectedDevice) return;

    const loadReadings = async () => {
      try {
        console.log("[ADMIN PANEL] Loading readings for device:", selectedDevice.id);
        const deviceReadings = await readingsService.getDeviceReadings(selectedDevice.id);
        setReadings(deviceReadings || []);
      } catch (error) {
        console.error("[ADMIN PANEL] Error loading readings:", error);
      }
    };

    loadReadings();
  }, [selectedDevice]);

  const deleteUserAndDevices = async (targetUserId: string) => {
    if (!confirm("Delete this user and all associated devices?")) return;

    try {
      console.log("[ADMIN PANEL] Deleting user:", targetUserId);
      
      // Get all devices for this user
      const userDevices = await deviceService.getUserDevices(targetUserId);
      
      // Delete each device
      for (const device of userDevices) {
        await deviceService.deleteDevice(device.id);
      }

      // Update local state
      setUsers(users.filter((u) => u.id !== targetUserId));
      setDevices(devices.filter((d) => d.owner_uid !== targetUserId));
      
      if (selectedUserId === targetUserId) {
        setSelectedUserId(users[0]?.id ?? null);
      }

      toast({ title: "User deleted successfully" });
    } catch (error) {
      console.error("[ADMIN PANEL] Error deleting user:", error);
      toast({ title: "Error deleting user", description: String(error) });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const selectedUserDetails = useMemo(() => {
    if (!selectedUser) return [];
    return [
      { label: "Email", value: selectedUser.email },
      { label: "Role", value: selectedUser.role },
      { label: "User ID", value: selectedUser.id },
      { label: "Phone", value: selectedUser.phone ?? "-" },
      { label: "Organization", value: selectedUser.organization ?? "-" },
      { label: "Created At", value: formatDate(selectedUser.createdAt) },
      { label: "Last Login", value: formatDate(selectedUser.lastLoginAt) },
    ];
  }, [selectedUser]);

  const syncFreshnessMeta = getSyncFreshnessMeta(lastSyncAt);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-blue-400" />
              Admin Panel
            </h1>
            <p className="text-slate-400 text-sm mt-1">Supabase Backend - Sync Mode: {devicesSyncMode}</p>
          </motion.div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-400">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <StatusBanner
          isOnline={devicesSyncMode === "live"}
          lastSyncTime={syncFreshnessMeta.lastSyncAt}
        />

        {/* Main Content */}
        {loading ? (
          <div className="text-center text-slate-400">Loading admin data...</div>
        ) : (
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Users ({users.length})
              </TabsTrigger>
              <TabsTrigger value="devices" className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Devices ({devices.length})
              </TabsTrigger>
              <TabsTrigger value="readings" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Readings ({readings.length})
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Users</h3>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`w-full text-left p-2 rounded text-sm transition ${
                          selectedUserId === u.id
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {u.email}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  {selectedUser && (
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                      <h3 className="text-lg font-semibold text-white">{selectedUser.email}</h3>
                      {selectedUserDetails.map(({ label, value }) => (
                        <div key={label} className="grid grid-cols-3 gap-2 text-sm">
                          <span className="text-slate-400">{label}:</span>
                          <span className="text-slate-200 col-span-2">{value}</span>
                        </div>
                      ))}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUserAndDevices(selectedUser.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Devices Tab */}
            <TabsContent value="devices" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">User Devices</h3>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {selectedUserDevices.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDeviceId(d.id)}
                        className={`w-full text-left p-2 rounded text-sm transition ${
                          selectedDeviceId === d.id
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  {selectedDevice && (
                    <SensorCard
                      name={selectedDevice.name}
                      status={selectedDevice.status}
                      location={selectedDevice.location}
                      battery={selectedDevice.battery}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Readings Tab */}
            <TabsContent value="readings" className="space-y-4">
              {selectedDevice && readings.length > 0 && (
                <WaterGraph data={readings} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
};

export default AdminPanel;
