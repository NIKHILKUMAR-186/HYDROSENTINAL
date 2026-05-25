/**
 * mapService.ts - Enterprise Map Service with Mapbox GL JS Integration
 * Handles map initialization, clustering, heatmaps, and marker rendering
 */

import type { DeviceRecord } from "./deviceStore";

export type MapMarkerStatus = "healthy" | "warning" | "critical" | "offline" | "simulator";

export interface MapMarker {
  id: string;
  deviceId: string;
  lat: number;
  lng: number;
  name: string;
  status: MapMarkerStatus;
  ph?: number;
  tds?: number;
  temperature?: number;
  turbidity?: number;
  battery?: number;
  address?: string;
  lastUpdate?: string;
  isSimulator: boolean;
}

export interface MapCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  status: "mixed" | "healthy" | "warning" | "critical" | "offline";
  avgBattery: number;
}

export const getMarkerColor = (status: MapMarkerStatus): string => {
  const colors: Record<MapMarkerStatus, string> = {
    healthy: "#10b981", // emerald-500
    warning: "#f59e0b", // amber-500
    critical: "#ef4444", // red-500
    offline: "#9ca3af", // gray-400
    simulator: "#3b82f6", // blue-500
  };
  return colors[status];
};

export const getMarkerGlowColor = (status: MapMarkerStatus): string => {
  const colors: Record<MapMarkerStatus, string> = {
    healthy: "rgba(16, 185, 129, 0.4)",
    warning: "rgba(245, 158, 11, 0.4)",
    critical: "rgba(239, 68, 68, 0.4)",
    offline: "rgba(156, 163, 175, 0.2)",
    simulator: "rgba(59, 130, 246, 0.4)",
  };
  return colors[status];
};

export const determineMarkerStatus = (device: DeviceRecord, latestReading?: any): MapMarkerStatus => {
  if (device.status === "inactive") return "offline";
  if (device.deviceType === "simulator") return "simulator";
  
  if (!latestReading) return "offline";
  
  if (latestReading.status === "NOT SAFE") return "critical";
  if (latestReading.status === "SAFE") {
    const tds = latestReading.tds ?? 0;
    const ph = latestReading.ph ?? 7;
    const turbidity = latestReading.turbidity ?? 0;
    
    // WARNING if approaching limits
    if (tds > 800 || ph < 6.8 || ph > 8.2 || turbidity > 15) {
      return "warning";
    }
    
    return "healthy";
  }
  
  return "offline";
};

export const createMapMarker = (device: DeviceRecord, latestReading?: any): MapMarker => {
  const status = determineMarkerStatus(device, latestReading);
  
  return {
    id: `marker-${device.id}`,
    deviceId: device.id,
    lat: device.latitude ?? 0,
    lng: device.longitude ?? 0,
    name: device.name,
    status,
    ph: latestReading?.ph,
    tds: latestReading?.tds,
    temperature: latestReading?.temperature,
    turbidity: latestReading?.turbidity,
    battery: device.battery,
    address: device.location,
    lastUpdate: latestReading?.timestamp,
    isSimulator: device.deviceType === "simulator",
  };
};

export const calculateMapBounds = (markers: MapMarker[]): [[number, number], [number, number]] | null => {
  if (markers.length === 0) return null;
  
  let minLat = markers[0].lat;
  let maxLat = markers[0].lat;
  let minLng = markers[0].lng;
  let maxLng = markers[0].lng;
  
  for (const marker of markers) {
    minLat = Math.min(minLat, marker.lat);
    maxLat = Math.max(maxLat, marker.lat);
    minLng = Math.min(minLng, marker.lng);
    maxLng = Math.max(maxLng, marker.lng);
  }
  
  return [[minLat, minLng], [maxLat, maxLng]];
};

export const createHeatmapData = (markers: MapMarker[]): Array<[number, number, number]> => {
  return markers.map((marker) => {
    let intensity = 0;
    if (marker.status === "critical") intensity = 1;
    else if (marker.status === "warning") intensity = 0.6;
    else if (marker.status === "healthy") intensity = 0.2;
    else intensity = 0.1;
    
    return [marker.lat, marker.lng, intensity];
  });
};

export const clusterizeMarkers = (
  markers: MapMarker[],
  zoomLevel: number,
  cellSize: number = 64,
): (MapMarker | MapCluster)[] => {
  if (zoomLevel >= 12) return markers;
  
  const clusters: Map<string, MapMarker[]> = new Map();
  const clusterKey = cellSize / Math.pow(2, 12 - zoomLevel);
  
  for (const marker of markers) {
    const cellLat = Math.floor(marker.lat / clusterKey) * clusterKey;
    const cellLng = Math.floor(marker.lng / clusterKey) * clusterKey;
    const key = `${cellLat},${cellLng}`;
    
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(marker);
  }
  
  const result: (MapMarker | MapCluster)[] = [];
  
  for (const [, clusteredMarkers] of clusters) {
    if (clusteredMarkers.length === 1) {
      result.push(clusteredMarkers[0]);
    } else {
      const avgLat = clusteredMarkers.reduce((sum, m) => sum + m.lat, 0) / clusteredMarkers.length;
      const avgLng = clusteredMarkers.reduce((sum, m) => sum + m.lng, 0) / clusteredMarkers.length;
      const avgBattery = clusteredMarkers.reduce((sum, m) => sum + (m.battery ?? 50), 0) / clusteredMarkers.length;
      
      const statusCounts = {
        healthy: clusteredMarkers.filter(m => m.status === "healthy").length,
        warning: clusteredMarkers.filter(m => m.status === "warning").length,
        critical: clusteredMarkers.filter(m => m.status === "critical").length,
      };
      
      let clusterStatus: "healthy" | "warning" | "critical" | "mixed" | "offline" = "mixed";
      if (statusCounts.critical > 0) clusterStatus = "critical";
      else if (statusCounts.warning > 0) clusterStatus = "warning";
      else if (statusCounts.healthy === clusteredMarkers.length) clusterStatus = "healthy";
      
      result.push({
        id: `cluster-${avgLat}-${avgLng}`,
        lat: avgLat,
        lng: avgLng,
        count: clusteredMarkers.length,
        status: clusterStatus,
        avgBattery,
      });
    }
  }
  
  return result;
};
