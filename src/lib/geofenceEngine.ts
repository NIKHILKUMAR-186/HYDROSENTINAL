/**
 * geofenceEngine.ts - Geofencing and zone management
 * Handles zone definitions, boundary checking, and zone alerts
 */

import { calculateDistance } from "./locationService";

export interface GeoZone {
  id: string;
  name: string;
  type: "radius" | "polygon" | "river_basin";
  centerLat: number;
  centerLng: number;
  radiusKm?: number;
  vertices?: Array<{ lat: number; lng: number }>;
  alertThreshold?: {
    ph?: { min?: number; max?: number };
    tds?: number;
    turbidity?: number;
    temperature?: number;
  };
  description?: string;
  color?: string;
}

export interface ZoneCheckResult {
  isInZone: boolean;
  zone?: GeoZone;
  distanceToCenter?: number;
  distanceToBoundary?: number;
}

export interface ZoneAlert {
  id: string;
  deviceId: string;
  zoneId: string;
  zoneName: string;
  type: "entry" | "exit" | "threshold_breach";
  timestamp: string;
  message: string;
  severity: "low" | "medium" | "high";
}

// Predefined water quality monitoring zones for India
export const PREDEFINED_ZONES: GeoZone[] = [
  {
    id: "zone-ganga-main",
    name: "Ganga River Main Channel",
    type: "river_basin",
    centerLat: 25.3,
    centerLng: 83.0,
    radiusKm: 50,
    description: "Main Ganga river channel monitoring zone",
    color: "#3b82f6",
    alertThreshold: {
      tds: 900,
      ph: { min: 6.5, max: 8.5 },
      turbidity: 30,
    },
  },
  {
    id: "zone-drinking-water",
    name: "Drinking Water Supply Zone",
    type: "radius",
    centerLat: 25.59,
    centerLng: 85.14,
    radiusKm: 15,
    description: "Drinking water treatment and supply area",
    color: "#10b981",
    alertThreshold: {
      tds: 500,
      ph: { min: 6.8, max: 8.2 },
      turbidity: 10,
    },
  },
  {
    id: "zone-agricultural",
    name: "Agricultural Runoff Zone",
    type: "radius",
    centerLat: 26.0,
    centerLng: 84.5,
    radiusKm: 25,
    description: "Areas with agricultural runoff concerns",
    color: "#f59e0b",
    alertThreshold: {
      tds: 1200,
      turbidity: 50,
    },
  },
  {
    id: "zone-industrial",
    name: "Industrial Area",
    type: "radius",
    centerLat: 25.8,
    centerLng: 85.8,
    radiusKm: 20,
    description: "Industrial and manufacturing areas",
    color: "#ef4444",
    alertThreshold: {
      tds: 800,
      ph: { min: 6.0, max: 9.0 },
      turbidity: 40,
    },
  },
];

/**
 * Check if a point is inside a circle-based zone
 */
const isInCircleZone = (
  lat: number,
  lng: number,
  zone: GeoZone,
): [boolean, number] => {
  if (!zone.radiusKm || zone.centerLat === undefined || zone.centerLng === undefined) {
    return [false, 0];
  }
  
  const distance = calculateDistance(lat, lng, zone.centerLat, zone.centerLng);
  return [distance <= zone.radiusKm, distance];
};

/**
 * Check if point is inside a polygon using ray casting algorithm
 */
const isInPolygonZone = (
  lat: number,
  lng: number,
  zone: GeoZone,
): boolean => {
  if (!zone.vertices || zone.vertices.length < 3) return false;
  
  let isInside = false;
  let j = zone.vertices.length - 1;
  
  for (let i = 0; i < zone.vertices.length; i++) {
    const xi = zone.vertices[i].lat;
    const yi = zone.vertices[i].lng;
    const xj = zone.vertices[j].lat;
    const yj = zone.vertices[j].lng;
    
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
    
    j = i;
  }
  
  return isInside;
};

/**
 * Check if device is within a zone
 */
export const checkZoneEntry = (lat: number, lng: number, zone: GeoZone): ZoneCheckResult => {
  let isInZone = false;
  let distanceToCenter = 0;
  let distanceToBoundary = 0;
  
  if (zone.type === "polygon") {
    isInZone = isInPolygonZone(lat, lng, zone);
  } else {
    [isInZone, distanceToCenter] = isInCircleZone(lat, lng, zone);
    if (zone.radiusKm) {
      distanceToBoundary = Math.max(0, distanceToCenter - zone.radiusKm);
    }
  }
  
  return {
    isInZone,
    zone: isInZone ? zone : undefined,
    distanceToCenter,
    distanceToBoundary,
  };
};

/**
 * Check multiple zones for a device location
 */
export const checkAllZones = (
  lat: number,
  lng: number,
  zones: GeoZone[] = PREDEFINED_ZONES,
): ZoneCheckResult[] => {
  return zones.map((zone) => checkZoneEntry(lat, lng, zone)).filter((result) => result.isInZone);
};

/**
 * Validate reading against zone thresholds
 */
export const validateReadingAgainstZone = (
  reading: {
    ph?: number;
    tds?: number;
    turbidity?: number;
    temperature?: number;
  },
  zone: GeoZone,
): { isValid: boolean; violations: string[] } => {
  const violations: string[] = [];
  const threshold = zone.alertThreshold;
  
  if (!threshold) return { isValid: true, violations: [] };
  
  if (threshold.ph) {
    if (reading.ph !== undefined) {
      if (threshold.ph.min && reading.ph < threshold.ph.min) {
        violations.push(`pH too low (${reading.ph} < ${threshold.ph.min})`);
      }
      if (threshold.ph.max && reading.ph > threshold.ph.max) {
        violations.push(`pH too high (${reading.ph} > ${threshold.ph.max})`);
      }
    }
  }
  
  if (threshold.tds !== undefined && reading.tds !== undefined) {
    if (reading.tds > threshold.tds) {
      violations.push(`TDS exceeds limit (${reading.tds} > ${threshold.tds})`);
    }
  }
  
  if (threshold.turbidity !== undefined && reading.turbidity !== undefined) {
    if (reading.turbidity > threshold.turbidity) {
      violations.push(`Turbidity exceeds limit (${reading.turbidity} > ${threshold.turbidity})`);
    }
  }
  
  if (threshold.temperature !== undefined && reading.temperature !== undefined) {
    if (Math.abs(reading.temperature - 25) > threshold.temperature) {
      violations.push(`Temperature abnormal (${reading.temperature}°C)`);
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
  };
};

/**
 * Generate zone alert
 */
export const generateZoneAlert = (
  deviceId: string,
  type: "entry" | "exit" | "threshold_breach",
  zone: GeoZone,
  details?: string,
): ZoneAlert => {
  const timestamp = new Date().toISOString();
  let message = "";
  let severity: "low" | "medium" | "high" = "medium";
  
  if (type === "entry") {
    message = `Device entered ${zone.name}`;
    severity = zone.id.includes("industrial") || zone.id.includes("agricultural") ? "high" : "medium";
  } else if (type === "exit") {
    message = `Device exited ${zone.name}`;
    severity = "low";
  } else if (type === "threshold_breach") {
    message = `Water quality threshold violated in ${zone.name}: ${details}`;
    severity = "high";
  }
  
  return {
    id: `alert-${Date.now()}`,
    deviceId,
    zoneId: zone.id,
    zoneName: zone.name,
    type,
    timestamp,
    message,
    severity,
  };
};
