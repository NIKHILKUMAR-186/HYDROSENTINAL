/**
 * LiveDeviceMap.tsx - Futuristic Real-Time Device Location Map
 * Features: Real-time Firestore sync, clustering, heatmap, geofencing, device popups
 * Technology: Leaflet with OpenStreetMap (no API key needed), enterprise styling
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, GeoJSON } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, Filter, Zap, AlertTriangle, Signal, Battery } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeviceRecord } from "@/lib/deviceStore";
import { subscribeToDeviceLocations } from "@/lib/firebaseLocationSync";
import {
  createMapMarker,
  determineMarkerStatus,
  getMarkerColor,
  clusterizeMarkers,
  calculateMapBounds,
  type MapMarker,
  type MapCluster,
} from "@/lib/mapService";
import { checkAllZones, PREDEFINED_ZONES } from "@/lib/geofenceEngine";
import { injectPulseAnimation } from "@/lib/markerRenderer";

interface LiveDeviceMapProps {
  userId?: string;
  devices?: DeviceRecord[];
  latestReadings?: Record<string, any>;
  onDeviceSelect?: (deviceId: string) => void;
  selectedDeviceId?: string;
  height?: string;
  showHeatmap?: boolean;
  showClustering?: boolean;
  showGeofences?: boolean;
}

type FilterStatus = "all" | "healthy" | "warning" | "critical" | "offline" | "simulator";

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const CircleMarkerAny = CircleMarker as any;
const PopupAny = Popup as any;

const ensureLeafletIcons = () => {
  if (typeof window === "undefined") return;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

ensureLeafletIcons();
injectPulseAnimation();

export const LiveDeviceMap: React.FC<LiveDeviceMapProps> = ({
  userId,
  devices: externalDevices,
  latestReadings = {},
  onDeviceSelect,
  selectedDeviceId,
  height = "h-[500px]",
  showHeatmap = true,
  showClustering = true,
  showGeofences = true,
}) => {
  const [devices, setDevices] = useState<DeviceRecord[]>(externalDevices || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [zoomLevel, setZoomLevel] = useState(11);
  const [centerLat, setCenterLat] = useState(25.59);
  const [centerLng, setCenterLng] = useState(85.14);

  // Subscribe to Firestore device locations in real-time
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToDeviceLocations(
      userId,
      (updatedDevices) => {
        setDevices(updatedDevices);
        
        // Auto-fit bounds if devices loaded
        if (updatedDevices.length > 0) {
          const validDevices = updatedDevices.filter(
            (d) => d.latitude && d.longitude,
          );
          if (validDevices.length > 0) {
            const avgLat = validDevices.reduce((sum, d) => sum + (d.latitude || 0), 0) / validDevices.length;
            const avgLng = validDevices.reduce((sum, d) => sum + (d.longitude || 0), 0) / validDevices.length;
            setCenterLat(avgLat);
            setCenterLng(avgLng);
          }
        }
      },
      (error) => {
        console.error("Failed to sync device locations:", error);
      },
    );

    return unsubscribe;
  }, [userId]);

  // Create map markers from devices
  const markers = useMemo(() => {
    return devices
      .filter((d) => d.latitude && d.longitude)
      .map((device) => createMapMarker(device, latestReadings[device.id]))
      .filter((marker) => {
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = marker.name.toLowerCase().includes(query);
          const matchesAddress = marker.address?.toLowerCase().includes(query);
          if (!matchesName && !matchesAddress) return false;
        }

        // Apply status filter
        if (filterStatus !== "all" && marker.status !== filterStatus) {
          return false;
        }

        return true;
      });
  }, [devices, latestReadings, searchQuery, filterStatus]);

  // Clustered markers for performance
  const displayMarkers = useMemo(() => {
    if (!showClustering) return markers;
    return clusterizeMarkers(markers, zoomLevel);
  }, [markers, showClustering, zoomLevel]);

  // Heatmap rings
  const heatmapRings = useMemo(() => {
    if (!showHeatmap) return [];
    
    return markers.map((marker) => {
      const radius = {
        healthy: 0.003,
        warning: 0.004,
        critical: 0.005,
        offline: 0.002,
        simulator: 0.0035,
      }[marker.status];

      return {
        id: marker.id,
        lat: marker.lat,
        lng: marker.lng,
        radius,
        color: getMarkerColor(marker.status),
      };
    });
  }, [markers, showHeatmap]);

  // Get selected device for center
  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );

  const mapCenter = selectedDevice?.latitude && selectedDevice?.longitude
    ? [selectedDevice.latitude, selectedDevice.longitude]
    : [centerLat, centerLng];

  return (
    <div className={`relative w-full rounded-[1.5rem] border border-slate-200/80 bg-white/90 overflow-hidden shadow-xl dark:border-slate-700 dark:bg-slate-900/80 ${height}`}>
      {/* Search and Filter Bar */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search devices by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur"
            />
          </div>
          <Button
            onClick={() => setShowHeatmap?.((prev: boolean) => !prev)}
            className={`${showHeatmap ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-700 hover:bg-slate-600"} text-white`}
            size="sm"
          >
            <Zap className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["all", "healthy", "warning", "critical", "offline", "simulator"] as FilterStatus[]).map(
            (status) => (
              <Button
                key={status}
                onClick={() => setFilterStatus(status)}
                size="sm"
                className={`whitespace-nowrap ${
                  filterStatus === status
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : "bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-700/80 dark:text-slate-200"
                }`}
              >
                {status === "all" ? "All Devices" : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ),
          )}
        </div>
      </div>

      {/* Map Container */}
      {markers.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-center">
          <div className="rounded-full bg-cyan-500/20 p-4 mb-4">
            <MapPin className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-semibold">
            No devices with locations yet
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Register a device and select a location to see it on the map
          </p>
        </div>
      ) : (
        <MapContainerAny
          center={mapCenter}
          zoom={zoomLevel}
          onZoomend={(map: any) => setZoomLevel(map.getZoom())}
          className="h-full w-full"
          style={{ background: "#1a1a2e" }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          {/* Dark themed tile layer */}
          <TileLayerAny
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Heatmap visualization */}
          {heatmapRings.map((ring) => (
            <CircleMarkerAny
              key={`heat-${ring.id}`}
              center={[ring.lat, ring.lng]}
              radius={ring.radius * 110000}
              pathOptions={{
                color: ring.color,
                fillColor: ring.color,
                fillOpacity: 0.15,
                weight: 1,
                dashArray: "4",
              }}
            />
          ))}

          {/* Geofence zones */}
          {showGeofences &&
            PREDEFINED_ZONES.map((zone) => (
              <CircleMarkerAny
                key={`geofence-${zone.id}`}
                center={[zone.centerLat, zone.centerLng]}
                radius={zone.radiusKm ? (zone.radiusKm * 1000) / 111000 : 0}
                pathOptions={{
                  color: zone.color || "#8b5cf6",
                  fillColor: zone.color || "#8b5cf6",
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: "8",
                }}
              >
                <PopupAny>
                  <div className="text-sm font-semibold text-slate-900">
                    {zone.name}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{zone.description}</p>
                </PopupAny>
              </CircleMarkerAny>
            ))}

          {/* Device markers */}
          {displayMarkers.map((item) => {
            const isCluster = "count" in item;
            const marker = item as MapMarker;

            if (isCluster) {
              const cluster = item as MapCluster;
              return (
                <CircleMarkerAny
                  key={cluster.id}
                  center={[cluster.lat, cluster.lng]}
                  radius={Math.sqrt(cluster.count) * 8}
                  pathOptions={{
                    color: "white",
                    fillColor: getMarkerColor(
                      cluster.status === "critical"
                        ? "critical"
                        : cluster.status === "warning"
                          ? "warning"
                          : cluster.status === "healthy"
                            ? "healthy"
                            : "offline",
                    ),
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      // Find first real device in cluster for context
                      const device = devices.find(
                        (d) =>
                          d.latitude &&
                          Math.abs(d.latitude - cluster.lat) < 0.01 &&
                          Math.abs(d.longitude - cluster.lng) < 0.01,
                      );
                      if (device) onDeviceSelect?.(device.id);
                    },
                  }}
                >
                  <PopupAny>
                    <div className="text-sm font-semibold">{cluster.count} devices</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Zoom in to see individual devices
                    </p>
                  </PopupAny>
                </CircleMarkerAny>
              );
            }

            return (
              <MarkerAny
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createMarkerIcon(marker.status)}
                eventHandlers={{
                  click: () => onDeviceSelect?.(marker.deviceId),
                }}
                className={selectedDeviceId === marker.deviceId ? "ring-4 ring-cyan-500" : ""}
              >
                <PopupAny>
                  <DeviceMarkerPopup marker={marker} />
                </PopupAny>
              </MarkerAny>
            );
          })}
        </MapContainerAny>
      )}

      {/* Device count badge */}
      <div className="absolute bottom-4 left-4 z-40 rounded-full bg-white/95 dark:bg-slate-800/95 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-lg">
        {markers.length} device{markers.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

/**
 * Create Leaflet icon for marker
 */
function createMarkerIcon(status: string): L.Icon {
  const colorMap: Record<string, string> = {
    healthy: "#10b981",
    warning: "#f59e0b",
    critical: "#ef4444",
    offline: "#9ca3af",
    simulator: "#3b82f6",
  };

  const color = colorMap[status] || "#64748b";
  const iconHtml = `
    <div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${color};
      border: 3px solid white;
      box-shadow: 0 0 20px ${color}40, 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      ${status === "critical" || status === "warning" ? "animation: pulse 2s infinite;" : ""}
    " class="${status === "critical" || status === "warning" ? "animate-pulse" : ""}">
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

/**
 * Device Marker Popup Component
 */
const DeviceMarkerPopup: React.FC<{ marker: MapMarker }> = ({ marker }) => {
  const statusColor = {
    healthy: "#10b981",
    warning: "#f59e0b",
    critical: "#ef4444",
    offline: "#9ca3af",
    simulator: "#3b82f6",
  }[marker.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-64 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div
        className="h-12 px-4 flex items-center gap-2"
        style={{ backgroundColor: statusColor }}
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
          {marker.status === "healthy" ? "✓" : marker.status === "critical" ? "✕" : "!"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{marker.name}</p>
          <p className="text-xs opacity-90">{marker.deviceId}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Status</span>
          <span
            className="font-semibold px-2 py-1 rounded-full text-xs"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {marker.status.charAt(0).toUpperCase() + marker.status.slice(1)}
          </span>
        </div>

        {/* Water Quality Readings */}
        {(marker.ph || marker.tds || marker.temperature || marker.turbidity) && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
            {marker.ph && (
              <div className="text-xs">
                <p className="text-slate-400">pH</p>
                <p className="font-semibold">{marker.ph.toFixed(1)}</p>
              </div>
            )}
            {marker.tds && (
              <div className="text-xs">
                <p className="text-slate-400">TDS</p>
                <p className="font-semibold">{marker.tds} ppm</p>
              </div>
            )}
            {marker.temperature && (
              <div className="text-xs">
                <p className="text-slate-400">Temp</p>
                <p className="font-semibold">{marker.temperature.toFixed(1)}°C</p>
              </div>
            )}
            {marker.turbidity && (
              <div className="text-xs">
                <p className="text-slate-400">NTU</p>
                <p className="font-semibold">{marker.turbidity.toFixed(1)}</p>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        {marker.address && (
          <div className="text-xs pt-2 border-t border-slate-700">
            <p className="text-slate-400 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Location
            </p>
            <p className="font-semibold mt-1 line-clamp-2">{marker.address}</p>
          </div>
        )}

        {/* Battery and Signal */}
        {(marker.battery !== undefined || marker.lastUpdate) && (
          <div className="flex gap-2 text-xs pt-2 border-t border-slate-700">
            {marker.battery !== undefined && (
              <div className="flex items-center gap-1">
                <Battery className="h-3 w-3 text-yellow-400" />
                <span>{marker.battery}%</span>
              </div>
            )}
            {marker.lastUpdate && (
              <div className="flex items-center gap-1 text-slate-400">
                <Signal className="h-3 w-3" />
                <span>{new Date(marker.lastUpdate).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Simulator badge */}
        {marker.isSimulator && (
          <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            <Zap className="h-3 w-3" />
            Simulator Device
          </div>
        )}
      </div>
    </motion.div>
  );
};
