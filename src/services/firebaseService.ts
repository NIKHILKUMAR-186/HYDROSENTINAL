import { where, orderBy, limit, serverTimestamp, Timestamp, Unsubscribe, FieldValue } from "firebase/firestore";
import { docSafe, collectionSafe, getDocSafe, getDocsSafe, querySafe, onSnapshotSafe, setDocSafe, updateDocSafe, deleteDocSafe } from "@/lib/firestoreSafe";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  multiFactor,
  PhoneMultiFactorGenerator,
  getAuth,
} from "firebase/auth";
import { db, storage } from "@/firebase";

// ==================== USER SERVICE ====================
export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  photoURL?: string;
  joinedDate: Timestamp;
  lastLogin: Timestamp;
  phoneNumber?: string;
  twoFactorEnabled: boolean;
  twoFactorPhone?: string;
  twoFactorVerified?: boolean;
  notificationSettings: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    emergencyAlerts: boolean;
    anomalyAlerts: boolean;
    deviceAlerts: boolean;
  };
  themePreference: "light" | "dark";
  languagePreference: string;
  role: "user" | "admin";
}

export const userService = {
  // Get user profile
  async getProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), {
        ...updates,
        lastLogin: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  },

  // Create user document
  async createUserProfile(uid: string, userData: Partial<UserProfile>): Promise<void> {
    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        ...userData,
        joinedDate: serverTimestamp(),
        lastLogin: serverTimestamp(),
        twoFactorEnabled: false,
        notificationSettings: {
          emailAlerts: true,
          smsAlerts: false,
          emergencyAlerts: true,
          anomalyAlerts: true,
          deviceAlerts: true,
        },
        themePreference: "dark",
        languagePreference: "en",
        role: "user",
      });
    } catch (error) {
      console.error("Error creating user profile:", error);
      throw error;
    }
  },

  // Update profile picture
  async updateProfilePicture(uid: string, file: File): Promise<string> {
    try {
      const fileRef = ref(storage, `users/${uid}/profile-picture`);
      await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "users", uid), { photoURL });
      return photoURL;
    } catch (error) {
      console.error("Error updating profile picture:", error);
      throw error;
    }
  },

  // Listen to profile changes (realtime)
  listenToProfile(uid: string, callback: (profile: UserProfile) => void): Unsubscribe {
    return onSnapshot(doc(db, "users", uid), (doc) => {
      if (doc.exists()) {
        callback(doc.data() as UserProfile);
      }
    });
  },
};

// ==================== DEVICE SERVICE ====================
export interface Device {
  id: string;
  deviceName: string;
  uniqueId: string;
  location: string;
  firmwareVersion: string;
  batteryLevel: number;
  status: "online" | "offline";
  lastSynced: Timestamp;
  ownerId: string;
  latitude?: number;
  longitude?: number;
  createdAt: Timestamp;
}

export const deviceService = {
  // Get all devices for user
  async getDevices(uid: string): Promise<Device[]> {
    try {
      const q = querySafe(collectionSafe(db, "users", uid, "devices"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => doc.data() as Device);
    } catch (error) {
      console.error("Error fetching devices:", error);
      throw error;
    }
  },

  // Listen to devices (realtime)
  listenToDevices(uid: string, callback: (devices: Device[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "users", uid, "devices")),
      (snapshot) => {
        const devices = snapshot.docs.map((doc) => doc.data() as Device);
        callback(devices);
      }
    );
  },

  // Update device
  async updateDevice(uid: string, deviceId: string, updates: Partial<Device>): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid, "devices", deviceId), {
        ...updates,
        lastSynced: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating device:", error);
      throw error;
    }
  },

  // Delete device
  async deleteDevice(uid: string, deviceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "users", uid, "devices", deviceId));
    } catch (error) {
      console.error("Error deleting device:", error);
      throw error;
    }
  },
};

// ==================== NOTIFICATION SERVICE ====================
export interface Notification {
  id: string;
  userId: string;
  type: "alert" | "device" | "complaint" | "sensor" | "emergency";
  title: string;
  message: string;
  deviceId?: string;
  read: boolean;
  createdAt: Timestamp;
  severity?: "low" | "medium" | "high" | "critical";
}

export const notificationService = {
  // Get notifications
  async getNotifications(uid: string, limit = 50): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, "users", uid, "notifications"),
        where("read", "==", false)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => doc.data() as Notification)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        .slice(0, limit);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  },

  // Listen to notifications (realtime)
  listenToNotifications(uid: string, callback: (notifications: Notification[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "users", uid, "notifications")),
      (snapshot) => {
        const notifications = snapshot.docs.map((doc) => doc.data() as Notification);
        callback(notifications);
      }
    );
  },

  // Mark as read
  async markAsRead(uid: string, notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid, "notifications", notificationId), {
        read: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  // Create notification (backend or admin only)
  async createNotification(uid: string, notification: Omit<Notification, "id" | "createdAt">): Promise<void> {
    try {
      const docRef = docSafe(collectionSafe(db, "users", uid, "notifications"));
      await setDoc(docRef, {
        ...notification,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  // Delete notification
  async deleteNotification(uid: string, notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "users", uid, "notifications", notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  },
};

// ==================== COMPLAINT SERVICE ====================
export interface Complaint {
  id: string;
  ticketId: string;
  userId: string;
  deviceId: string;
  complaintType: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  imageURL?: string;
  status: "submitted" | "in-progress" | "resolved" | "closed";
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

export const complaintService = {
  // Get user complaints
  async getComplaints(uid: string): Promise<Complaint[]> {
    try {
      const q = query(collection(db, "users", uid, "complaints"));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => doc.data() as Complaint)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    } catch (error) {
      console.error("Error fetching complaints:", error);
      throw error;
    }
  },

  // Create complaint
  async createComplaint(uid: string, complaint: Omit<Complaint, "id" | "ticketId" | "createdAt" | "userId">): Promise<string> {
    try {
      const ticketId = `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const docRef = doc(collection(db, "users", uid, "complaints"));
      await setDoc(docRef, {
        ...complaint,
        ticketId,
        userId: uid,
        status: "submitted",
        createdAt: serverTimestamp(),
      });
      return ticketId;
    } catch (error) {
      console.error("Error creating complaint:", error);
      throw error;
    }
  },

  // Listen to complaints (realtime)
  listenToComplaints(uid: string, callback: (complaints: Complaint[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "users", uid, "complaints")),
      (snapshot) => {
        const complaints = snapshot.docs.map((doc) => doc.data() as Complaint);
        callback(complaints);
      }
    );
  },
};

// ==================== ACTIVITY SERVICE ====================
export interface Activity {
  id: string;
  userId: string;
  type: "device_sync" | "alert" | "complaint" | "ai_warning" | "login";
  title: string;
  description: string;
  deviceId?: string;
  createdAt: Timestamp;
}

export const activityService = {
  // Get activities
  async getActivities(uid: string, limit = 50): Promise<Activity[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, "users", uid, "activities"))
      );
      return snapshot.docs
        .map((doc) => doc.data() as Activity)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        .slice(0, limit);
    } catch (error) {
      console.error("Error fetching activities:", error);
      throw error;
    }
  },

  // Listen to activities (realtime)
  listenToActivities(uid: string, callback: (activities: Activity[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "users", uid, "activities")),
      (snapshot) => {
        const activities = snapshot.docs.map((doc) => doc.data() as Activity);
        callback(activities);
      }
    );
  },

  // Add activity (backend or client)
  async addActivity(uid: string, activity: Omit<Activity, "id" | "createdAt">): Promise<void> {
    try {
      const docRef = doc(collection(db, "users", uid, "activities"));
      await setDoc(docRef, {
        ...activity,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding activity:", error);
      throw error;
    }
  },
};

// ==================== ANALYTICS SERVICE ====================
export interface WaterReading {
  timestamp: Timestamp;
  ph: number;
  tds: number;
  temperature: number;
  turbidity: number;
  status: "safe" | "warning" | "danger";
}

export const analyticsService = {
  // Get device readings
  async getReadings(uid: string, deviceId: string, limit = 100): Promise<WaterReading[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, "users", uid, "devices", deviceId, "readings"))
      );
      return snapshot.docs
        .map((doc) => doc.data() as WaterReading)
        .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, limit);
    } catch (error) {
      console.error("Error fetching readings:", error);
      throw error;
    }
  },

  // Listen to readings (realtime)
  listenToReadings(
    uid: string,
    deviceId: string,
    callback: (readings: WaterReading[]) => void
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, "users", uid, "devices", deviceId, "readings")),
      (snapshot) => {
        const readings = snapshot.docs.map((doc) => doc.data() as WaterReading);
        callback(readings);
      }
    );
  },

  // Calculate average metrics
  calculateAverages(readings: WaterReading[]) {
    if (readings.length === 0) {
      return { avgPH: 0, avgTDS: 0, avgTemp: 0, avgTurbidity: 0 };
    }

    const sum = readings.reduce(
      (acc, reading) => ({
        ph: acc.ph + reading.ph,
        tds: acc.tds + reading.tds,
        temperature: acc.temperature + reading.temperature,
        turbidity: acc.turbidity + reading.turbidity,
      }),
      { ph: 0, tds: 0, temperature: 0, turbidity: 0 }
    );

    return {
      avgPH: parseFloat((sum.ph / readings.length).toFixed(2)),
      avgTDS: parseFloat((sum.tds / readings.length).toFixed(2)),
      avgTemp: parseFloat((sum.temperature / readings.length).toFixed(2)),
      avgTurbidity: parseFloat((sum.turbidity / readings.length).toFixed(2)),
    };
  },
};

// ==================== LOGIN HISTORY SERVICE ====================
export interface LoginHistory {
  id: string;
  userId: string;
  timestamp: Timestamp;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
}

export const loginHistoryService = {
  // Add login record
  async recordLogin(uid: string, ipAddress: string): Promise<void> {
    try {
      const docRef = doc(collection(db, "users", uid, "loginHistory"));
      await setDoc(docRef, {
        userId: uid,
        timestamp: serverTimestamp(),
        ipAddress,
        userAgent: navigator.userAgent,
        deviceInfo: `${navigator.platform} - ${navigator.language}`,
      });
    } catch (error) {
      console.error("Error recording login:", error);
      throw error;
    }
  },

  // Get login history
  async getLoginHistory(uid: string, limit = 20): Promise<LoginHistory[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, "users", uid, "loginHistory"))
      );
      return snapshot.docs
        .map((doc) => doc.data() as LoginHistory)
        .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, limit);
    } catch (error) {
      console.error("Error fetching login history:", error);
      throw error;
    }
  },
};

// ==================== 2FA SERVICE ====================
export const twoFAService = {
  // Setup 2FA
  async setupTwoFA(uid: string, phoneNumber: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), {
        twoFactorPhone: phoneNumber,
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      throw error;
    }
  },

  // Verify 2FA
  async verifyTwoFA(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), {
        twoFactorEnabled: true,
        twoFactorVerified: true,
      });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      throw error;
    }
  },

  // Disable 2FA
  async disableTwoFA(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), {
        twoFactorEnabled: false,
        twoFactorVerified: false,
      });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      throw error;
    }
  },
};
