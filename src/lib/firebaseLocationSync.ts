/**
 * firebaseLocationSync.ts - Real-time Firestore location listener
 * Provides live map marker updates using Firebase onSnapshot
 */

import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { DeviceRecord } from "./deviceStore";

export interface LocationUpdate {
  deviceId: string;
  lat: number;
  lng: number;
  address?: string;
  timestamp: string;
  status: "active" | "inactive";
}

export const subscribeToDeviceLocations = (
  userId: string,
  onUpdate: (devices: DeviceRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  try {
    // Subscribe to all devices for this user
    const q = query(
      collection(db, "devices"),
      where("ownerUid", "==", userId),
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const devices: DeviceRecord[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          devices.push({
            id: doc.id,
            ownerUid: data.ownerUid || userId,
            name: data.name || "Unnamed Device",
            uniqueId: data.uniqueId || doc.id,
            location: data.location || "Not configured",
            deviceType: data.deviceType || "simulator",
            latitude: data.latitude,
            longitude: data.longitude,
            zone: data.zone,
            status: data.status || "inactive",
            battery: data.battery ?? 0,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });
        
        onUpdate(devices);
      },
      (error) => {
        console.error("Location sync error:", error);
        onError?.(error as Error);
      },
    );
    
    return unsubscribe;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return () => {};
  }
};

/**
 * Subscribe to a single device's location updates
 */
export const subscribeToDeviceLocation = (
  deviceId: string,
  onUpdate: (update: LocationUpdate) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  try {
    const q = query(
      collection(db, "deviceLocations"),
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (data.deviceId === deviceId) {
            onUpdate({
              deviceId: data.deviceId,
              lat: data.latitude || 0,
              lng: data.longitude || 0,
              address: data.address,
              timestamp: data.timestamp || new Date().toISOString(),
              status: data.status || "active",
            });
          }
        });
      },
      (error) => {
        console.error("Device location listener error:", error);
        onError?.(error as Error);
      },
    );
    
    return unsubscribe;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return () => {};
  }
};

/**
 * Subscribe to live readings for location-based water quality updates
 */
export const subscribeToDeviceReadingsForLocation = (
  userId: string,
  onReadingUpdate: (deviceId: string, reading: any) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  try {
    const q = query(
      collection(db, "readings"),
      where("userId", "==", userId),
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            onReadingUpdate(data.deviceId, {
              ph: data.ph,
              tds: data.tds,
              turbidity: data.turbidity,
              temperature: data.temperature,
              status: data.status,
              timestamp: data.timestamp,
            });
          }
        });
      },
      (error) => {
        console.error("Reading listener error:", error);
        onError?.(error as Error);
      },
    );
    
    return unsubscribe;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return () => {};
  }
};
