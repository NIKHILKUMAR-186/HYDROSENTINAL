import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useLocation from "@/hooks/useLocation";
import { getZone } from "@/lib/utils";

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

const ensureLeafletIcons = () => {
  if (typeof window === "undefined") return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

ensureLeafletIcons();

const FlyToSelected = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position?.lat && position?.lng) {
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
    }
  }, [map, position?.lat, position?.lng]);
  return null;
};

const ClickToSetLocation = ({ onPick }) => {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const markerClass = (status) => {
  if (status === "unsafe") return "bg-rose-500/90 border-rose-300";
  if (status === "warning") return "bg-amber-400/90 border-amber-200";
  return "bg-emerald-500/90 border-emerald-200";
};

export const MapPicker = ({ value, onChange, height = "18rem", status = "safe", label = "Selected location" }) => {
  const { coords, updateFromMap, useCurrentLocation, address, zone, loadingAddress, error } = useLocation(
    value?.lat && value?.lng ? value : INDIA_CENTER,
  );

  const currentValue = useMemo(() => {
    if (value?.lat && value?.lng) return value;
    return { ...coords, label: address || label };
  }, [address, coords, label, value]);

  useEffect(() => {
    if (value?.lat && value?.lng && (value.lat !== coords.lat || value.lng !== coords.lng)) {
      void updateFromMap(value.lat, value.lng);
    }
  }, [coords.lat, coords.lng, updateFromMap, value]);

  useEffect(() => {
    onChange({
      lat: coords.lat,
      lng: coords.lng,
      label: address || currentValue.label || label,
      zone,
      address: address || currentValue.label || label,
    });
  }, [address, coords.lat, coords.lng, currentValue.label, label, onChange, zone]);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div class="h-4 w-4 rounded-full border-2 ${markerClass(status)} shadow-lg shadow-black/20 animate-pulse"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [status],
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Pick device location</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tap the map or drag the marker to update coordinates.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void useCurrentLocation().then((next) => {
            if (!next) return;
            onChange({
              lat: next.lat,
              lng: next.lng,
              label: next.address || "Current location",
              zone: getZone(next.lat, next.lng),
              address: next.address || "Current location",
            });
          })}
          className="bg-cyan-500 text-white hover:bg-cyan-600"
        >
          Use Current Location
        </Button>
      </div>

      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700") }>
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom
          className="h-[18rem] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToSetLocation onPick={async (lat, lng) => {
            const nextAddress = await updateFromMap(lat, lng);
            onChange({
              lat,
              lng,
              label: nextAddress || label,
              zone: getZone(lat, lng),
              address: nextAddress || label,
            });
          }} />
          <FlyToSelected position={coords} />
          <Marker
            draggable
            position={[coords.lat, coords.lng]}
            icon={icon}
            eventHandlers={{
              dragend: async (event) => {
                const marker = event.target;
                const nextLatLng = marker.getLatLng();
                const nextAddress = await updateFromMap(nextLatLng.lat, nextLatLng.lng);
                onChange({
                  lat: nextLatLng.lat,
                  lng: nextLatLng.lng,
                  label: nextAddress || label,
                  zone: getZone(nextLatLng.lat, nextLatLng.lng),
                  address: nextAddress || label,
                });
              },
            }}
          >
            <Popup>
              <div className="space-y-1 text-slate-900">
                <p className="text-sm font-semibold">{address || label}</p>
                <p className="text-xs text-slate-600">Zone: {zone}</p>
                <p className="text-xs text-slate-600">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Latitude</p>
          <p className="font-semibold">{coords.lat.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Longitude</p>
          <p className="font-semibold">{coords.lng.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Zone</p>
          <p className="font-semibold">{zone}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">
        {loadingAddress ? "Resolving address..." : address || "No address resolved yet."}
        {error ? ` ${error}` : ""}
      </div>
    </div>
  );
};

export default MapPicker;
