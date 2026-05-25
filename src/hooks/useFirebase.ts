import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  userService,
  UserProfile,
  deviceService,
  Device,
  notificationService,
  Notification,
  complaintService,
  Complaint,
  activityService,
  Activity,
  analyticsService,
  WaterReading,
  loginHistoryService,
  LoginHistory,
  twoFAService,
} from "@/services/firebaseService";

// ==================== USE USER PROFILE ====================
export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = userService.listenToProfile(user.uid, (profile) => {
        setProfile(profile);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading profile");
      setLoading(false);
    }
  }, [user?.uid]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        await userService.updateProfile(user.uid, updates);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error updating profile");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  const updateProfilePicture = useCallback(
    async (file: File) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        const photoURL = await userService.updateProfilePicture(user.uid, file);
        setProfile((prev) => (prev ? { ...prev, photoURL } : null));
        setError(null);
        return photoURL;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error uploading picture");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  return { profile, loading, error, updateProfile, updateProfilePicture };
};

// ==================== USE DEVICES ====================
export const useDevices = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = deviceService.listenToDevices(user.uid, (devices) => {
        setDevices(devices);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading devices");
      setLoading(false);
    }
  }, [user?.uid]);

  const updateDevice = useCallback(
    async (deviceId: string, updates: Partial<Device>) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        await deviceService.updateDevice(user.uid, deviceId, updates);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error updating device");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  const deleteDevice = useCallback(
    async (deviceId: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        await deviceService.deleteDevice(user.uid, deviceId);
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error deleting device");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  return { devices, loading, error, updateDevice, deleteDevice };
};

// ==================== USE NOTIFICATIONS ====================
export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = notificationService.listenToNotifications(
        user.uid,
        (notifications) => {
          setNotifications(notifications);
          setUnreadCount(notifications.filter((n) => !n.read).length);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading notifications");
      setLoading(false);
    }
  }, [user?.uid]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        await notificationService.markAsRead(user.uid, notificationId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error marking as read");
        throw err;
      }
    },
    [user?.uid]
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        await notificationService.deleteNotification(user.uid, notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error deleting notification");
        throw err;
      }
    },
    [user?.uid]
  );

  return { notifications, loading, error, unreadCount, markAsRead, deleteNotification };
};

// ==================== USE COMPLAINTS ====================
export const useComplaints = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = complaintService.listenToComplaints(user.uid, (complaints) => {
        setComplaints(complaints);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading complaints");
      setLoading(false);
    }
  }, [user?.uid]);

  const createComplaint = useCallback(
    async (
      complaint: Omit<Complaint, "id" | "ticketId" | "createdAt" | "userId">
    ) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        const ticketId = await complaintService.createComplaint(user.uid, complaint);
        setError(null);
        return ticketId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error creating complaint");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  return { complaints, loading, error, createComplaint };
};

// ==================== USE ACTIVITIES ====================
export const useActivities = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = activityService.listenToActivities(user.uid, (activities) => {
        setActivities(activities);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading activities");
      setLoading(false);
    }
  }, [user?.uid]);

  const addActivity = useCallback(
    async (activity: Omit<Activity, "id" | "createdAt">) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        await activityService.addActivity(user.uid, activity);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error adding activity");
        throw err;
      }
    },
    [user?.uid]
  );

  return { activities, loading, error, addActivity };
};

// Backward-compatible alias for callers that use the newer name.
export const useActivityFeed = useActivities;

// ==================== USE WATER ANALYTICS ====================
export const useWaterAnalytics = (deviceId: string) => {
  const { user } = useAuth();
  const [readings, setReadings] = useState<WaterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [averages, setAverages] = useState({
    avgPH: 0,
    avgTDS: 0,
    avgTemp: 0,
    avgTurbidity: 0,
  });

  useEffect(() => {
    if (!user?.uid || !deviceId) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = analyticsService.listenToReadings(
        user.uid,
        deviceId,
        (readings) => {
          setReadings(readings);
          const calcs = analyticsService.calculateAverages(readings);
          setAverages(calcs);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading analytics");
      setLoading(false);
    }
  }, [user?.uid, deviceId]);

  return { readings, averages, loading, error };
};

// ==================== USE LOGIN HISTORY ====================
export const useLoginHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadHistory = async () => {
      try {
        const loginHistory = await loginHistoryService.getLoginHistory(user.uid);
        setHistory(loginHistory);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading login history");
        setLoading(false);
      }
    };

    loadHistory();
  }, [user?.uid]);

  return { history, loading, error };
};

// ==================== USE 2FA ====================
export const useTwoFA = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupTwoFA = useCallback(
    async (phoneNumber: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      try {
        setLoading(true);
        await twoFAService.setupTwoFA(user.uid, phoneNumber);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error setting up 2FA");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.uid]
  );

  const verifyTwoFA = useCallback(async () => {
    if (!user?.uid) throw new Error("User not authenticated");
    try {
      setLoading(true);
      await twoFAService.verifyTwoFA(user.uid);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error verifying 2FA");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const disableTwoFA = useCallback(async () => {
    if (!user?.uid) throw new Error("User not authenticated");
    try {
      setLoading(true);
      await twoFAService.disableTwoFA(user.uid);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error disabling 2FA");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  return { loading, error, setupTwoFA, verifyTwoFA, disableTwoFA };
};

// Backward-compatible alias for callers that use the newer name.
export const useTwoFactor = useTwoFA;
