import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getZone(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn(`[Zone] Invalid coordinates: lat=${lat}, lng=${lng}`);
    return "Zone_Unknown";
  }
  
  const latZone = Math.floor(lat * 10);
  const lngZone = Math.floor(lng * 10);
  const zoneId = `Zone_${latZone}_${lngZone}`;
  
  console.log(`[Zone] Generated zone for lat=${lat}, lng=${lng} => ${zoneId}`);
  return zoneId;
}

type AreaStatusSource = {
  ph?: number;
  tds?: number;
  [key: string]: unknown;
};

export const calculateAreaStatus = (devices: AreaStatusSource[]): string => {
  console.log(`[Area Status] Calculating status for ${devices.length} devices`);
  
  if (!devices || devices.length === 0) {
    console.log("[Area Status] No devices available, returning 'No Data'");
    return "No Data";
  }

  // Check if any device has unsafe readings
  const hasUnsafeDevice = devices.some(d => {
    const ph = typeof d.ph === "number" ? d.ph : 7;
    const tds = typeof d.tds === "number" ? d.tds : 300;
    return ph < 6.5 || ph > 8.5 || tds > 1000;
  });

  if (hasUnsafeDevice) {
    console.log("[Area Status] Found unsafe devices, returning 'Unsafe'");
    return "Unsafe";
  }

  console.log("[Area Status] All devices safe, returning 'Safe'");
  return "Safe";
};