/**
 * Supabase Service - Complete replacement for Firebase database operations
 * Handles all device, alert, complaint, and admin queries
 */
import { supabase } from "@/integrations/supabase/client";

// ==================== DEVICE SERVICE ====================
export const deviceService = {
  async getAllDevices() {
    console.log("[SUPABASE DEVICES] Fetching all devices");
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
    console.log("[SUPABASE DEVICES]", data);
    return data;
  },

  async getUserDevices(userId: string) {
    console.log("[SUPABASE DEVICES] Fetching devices for user:", userId);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("owner_uid", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
    console.log("[SUPABASE DEVICES]", data);
    return data;
  },

  async getDeviceById(deviceId: string) {
    console.log("[SUPABASE DEVICES] Fetching device:", deviceId);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("id", deviceId)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
    console.log("[SUPABASE DEVICES]", data);
    return data || null;
  },

  async createDevice(device: any) {
    console.log("[SUPABASE DEVICES] Creating device:", device);
    const { data, error } = await supabase
      .from("devices")
      .insert([device])
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
    console.log("[SUPABASE DEVICES]", data);
    return data;
  },

  async updateDevice(deviceId: string, updates: any) {
    console.log("[SUPABASE DEVICES] Updating device:", deviceId, updates);
    const { data, error } = await supabase
      .from("devices")
      .update(updates)
      .eq("id", deviceId)
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
    console.log("[SUPABASE DEVICES]", data);
    return data;
  },

  async deleteDevice(deviceId: string) {
    console.log("[SUPABASE DEVICES] Deleting device:", deviceId);
    const { error } = await supabase
      .from("devices")
      .delete()
      .eq("id", deviceId);
    
    if (error) {
      console.error("[SUPABASE DEVICES] Error:", error);
      throw error;
    }
  },

  async subscribeToUserDevices(userId: string, callback: (devices: any[]) => void) {
    console.log("[SUPABASE DEVICES] Subscribing to user devices:", userId);
    const subscription = supabase
      .from("devices")
      .on("*", (payload) => {
        if (payload.new.owner_uid === userId) {
          callback([payload.new]);
        }
      })
      .subscribe();
    return subscription;
  },
};

// ==================== READINGS SERVICE ====================
export const readingsService = {
  async getDeviceReadings(deviceId: string, limit: number = 100) {
    console.log("[SUPABASE READINGS] Fetching readings for device:", deviceId);
    const { data, error } = await supabase
      .from("device_readings")
      .select("*")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error("[SUPABASE READINGS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE READINGS]", data);
    return data;
  },

  async createReading(reading: any) {
    console.log("[SUPABASE READINGS] Creating reading:", reading);
    const { data, error } = await supabase
      .from("device_readings")
      .insert([reading])
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE READINGS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE READINGS]", data);
    return data;
  },

  async subscribeToDeviceReadings(deviceId: string, callback: (readings: any) => void) {
    console.log("[SUPABASE READINGS] Subscribing to readings for device:", deviceId);
    const subscription = supabase
      .from("device_readings")
      .on("INSERT", (payload) => {
        if (payload.new.device_id === deviceId) {
          callback(payload.new);
        }
      })
      .subscribe();
    return subscription;
  },
};

// ==================== ALERTS SERVICE ====================
export const alertsService = {
  async getAllAlerts() {
    console.log("[SUPABASE ALERTS] Fetching all alerts");
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE ALERTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ALERTS]", data);
    return data;
  },

  async getUserAlerts(userId: string) {
    console.log("[SUPABASE ALERTS] Fetching alerts for user:", userId);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE ALERTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ALERTS]", data);
    return data;
  },

  async getUnreadAlerts(userId: string) {
    console.log("[SUPABASE ALERTS] Fetching unread alerts for user:", userId);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE ALERTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ALERTS]", data);
    return data;
  },

  async createAlert(alert: any) {
    console.log("[SUPABASE ALERTS] Creating alert:", alert);
    const { data, error } = await supabase
      .from("alerts")
      .insert([alert])
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE ALERTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ALERTS]", data);
    return data;
  },

  async updateAlert(alertId: string, updates: any) {
    console.log("[SUPABASE ALERTS] Updating alert:", alertId, updates);
    const { data, error } = await supabase
      .from("alerts")
      .update(updates)
      .eq("id", alertId)
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE ALERTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ALERTS]", data);
    return data;
  },

  async subscribeToAlerts(userId: string, callback: (alert: any) => void) {
    console.log("[SUPABASE ALERTS] Subscribing to alerts for user:", userId);
    const subscription = supabase
      .from("alerts")
      .on("INSERT", (payload) => {
        if (payload.new.user_id === userId) {
          callback(payload.new);
        }
      })
      .subscribe();
    return subscription;
  },
};

// ==================== COMPLAINTS SERVICE ====================
export const complaintsService = {
  async getUserComplaints(userId: string) {
    console.log("[SUPABASE COMPLAINTS] Fetching complaints for user:", userId);
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE COMPLAINTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE COMPLAINTS]", data);
    return data;
  },

  async getAllComplaints() {
    console.log("[SUPABASE COMPLAINTS] Fetching all complaints");
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE COMPLAINTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE COMPLAINTS]", data);
    return data;
  },

  async createComplaint(complaint: any) {
    console.log("[SUPABASE COMPLAINTS] Creating complaint:", complaint);
    const { data, error } = await supabase
      .from("complaints")
      .insert([complaint])
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE COMPLAINTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE COMPLAINTS]", data);
    return data;
  },

  async updateComplaint(complaintId: string, updates: any) {
    console.log("[SUPABASE COMPLAINTS] Updating complaint:", complaintId, updates);
    const { data, error } = await supabase
      .from("complaints")
      .update(updates)
      .eq("id", complaintId)
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE COMPLAINTS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE COMPLAINTS]", data);
    return data;
  },
};

// ==================== ADMIN SERVICE ====================
export const adminService = {
  async getAllUsers() {
    console.log("[SUPABASE ADMIN] Fetching all users");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE ADMIN] Error:", error);
      throw error;
    }
    console.log("[SUPABASE ADMIN] Users:", data);
    return data;
  },

  async getUserWithDevices(userId: string) {
    console.log("[SUPABASE ADMIN] Fetching user and devices:", userId);
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    if (userError) {
      console.error("[SUPABASE ADMIN] User Error:", userError);
      throw userError;
    }

    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("*")
      .eq("owner_uid", userId);
    
    if (devicesError) {
      console.error("[SUPABASE ADMIN] Devices Error:", devicesError);
      throw devicesError;
    }

    return { user, devices };
  },

  async subscribeToUsers(callback: (users: any[]) => void) {
    console.log("[SUPABASE ADMIN] Subscribing to users");
    const subscription = supabase
      .from("profiles")
      .on("*", () => {
        // Re-fetch all users on any change
        this.getAllUsers().then(callback);
      })
      .subscribe();
    return subscription;
  },

  async subscribeToDevices(callback: (devices: any[]) => void) {
    console.log("[SUPABASE ADMIN] Subscribing to devices");
    const subscription = supabase
      .from("devices")
      .on("*", () => {
        // Re-fetch all devices on any change
        deviceService.getAllDevices().then(callback);
      })
      .subscribe();
    return subscription;
  },
};

// ==================== DEVICE LOCATIONS SERVICE ====================
export const deviceLocationsService = {
  async getDeviceLocation(deviceId: string) {
    console.log("[SUPABASE LOCATIONS] Fetching location for device:", deviceId);
    const { data, error } = await supabase
      .from("device_locations")
      .select("*")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("[SUPABASE LOCATIONS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE LOCATIONS]", data);
    return data || null;
  },

  async getAllDeviceLocations() {
    console.log("[SUPABASE LOCATIONS] Fetching all device locations");
    const { data, error } = await supabase
      .from("device_locations")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[SUPABASE LOCATIONS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE LOCATIONS]", data);
    return data;
  },

  async createLocation(location: any) {
    console.log("[SUPABASE LOCATIONS] Creating location:", location);
    const { data, error } = await supabase
      .from("device_locations")
      .insert([location])
      .select()
      .single();
    
    if (error) {
      console.error("[SUPABASE LOCATIONS] Error:", error);
      throw error;
    }
    console.log("[SUPABASE LOCATIONS]", data);
    return data;
  },

  async subscribeToLocations(deviceId: string, callback: (location: any) => void) {
    console.log("[SUPABASE LOCATIONS] Subscribing to locations for device:", deviceId);
    const subscription = supabase
      .from("device_locations")
      .on("INSERT", (payload) => {
        if (payload.new.device_id === deviceId) {
          callback(payload.new);
        }
      })
      .subscribe();
    return subscription;
  },
};
