import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletIconDefaultProto {
  _getIconUrl?: unknown;
}

const iconDefaultPrototype = L.Icon.Default.prototype as LeafletIconDefaultProto;
delete iconDefaultPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Device {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  zone?: string;
  location?: string;
  status?: string;
}

interface MapViewProps {
  devices: Device[];
}

// Component to handle auto-zoom after map renders
function MapBounds({ devices }: { devices: Device[] }) {
  const map = useMap();
  const boundsFitRef = useRef(false);

  useEffect(() => {
    // Get valid device coordinates
    const validDevices = devices.filter(
      (d) => d.latitude !== undefined && d.longitude !== undefined
    );

    // If we have devices, fit bounds to all of them
    if (validDevices.length > 0 && !boundsFitRef.current) {
      try {
        const latLngs = validDevices.map((d) => [
          d.latitude as number,
          d.longitude as number,
        ]);

        // Validate that we have valid numbers
        const allValid = latLngs.every(
          ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
        );

        if (!allValid) {
          console.warn("[MapView] Invalid coordinates detected, skipping bounds fit");
          return;
        }

        const bounds: LatLngBounds = L.latLngBounds(latLngs);

        // Check if bounds are valid
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
          boundsFitRef.current = true;
          console.log(
            `[MapView] Fitted bounds for ${validDevices.length} devices`
          );
        } else {
          console.warn("[MapView] Invalid bounds calculated");
        }
      } catch (error) {
        console.error("[MapView] Error fitting bounds:", error);
      }
    }
  }, [devices, map]);

  return null;
}

export default function MapView({ devices }: MapViewProps) {
  // Filter devices with valid coordinates
  const validDevices = devices.filter(
    (d) => d.latitude !== undefined && d.longitude !== undefined
  );

  console.log(
    `[MapView] Rendering map with ${validDevices.length} devices out of ${devices.length}`
  );

  // If no devices with coordinates, show fallback message
  if (devices.length === 0 || validDevices.length === 0) {
    return (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300">
        <div className="text-center">
          <p className="text-gray-600 font-medium">No devices available</p>
          <p className="text-gray-400 text-sm">
            Add devices with location data to see them on the map
          </p>
        </div>
      </div>
    );
  }

  // Calculate center from all valid devices
  const centerLat =
    validDevices.reduce((sum, d) => sum + (d.latitude || 0), 0) /
    validDevices.length;
  const centerLng =
    validDevices.reduce((sum, d) => sum + (d.longitude || 0), 0) /
    validDevices.length;

  const center: [number, number] = [centerLat, centerLng];

  return (
    <MapContainer
      center={center}
      zoom={6}
      className="w-full h-[400px] rounded-lg shadow-md"
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Auto-zoom component */}
      <MapBounds devices={validDevices} />

      {/* Device Markers */}
      {validDevices.map((device) => (
        <Marker
          key={device.id || `${device.latitude}-${device.longitude}`}
          position={[device.latitude as number, device.longitude as number]}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <p className="font-bold text-gray-800">
                {device.name || "Unknown Device"}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`font-medium ${
                      device.status === "Safe"
                        ? "text-green-600"
                        : device.status === "Unsafe"
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    {device.status || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Zone:</span>
                  <span className="text-gray-800 font-medium">
                    {device.zone || device.location || "No Zone"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="text-gray-800 text-xs">
                    {device.latitude?.toFixed(2)}, {device.longitude?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
