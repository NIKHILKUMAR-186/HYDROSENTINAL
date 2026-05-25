import { memo, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoDevicePoint, UnsafeSpreadPrediction } from "@/lib/geoIntelligence";
import { Skeleton } from "@/components/ui/skeleton";

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const CircleAny = Circle as any;
const CircleMarkerAny = CircleMarker as any;
const MarkerAny = Marker as any;

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

const markerColor = (status: GeoDevicePoint["status"]) => {
  if (status === "unsafe") return "#ef4444";
  if (status === "moderate") return "#eab308";
  return "#22c55e";
};

type Props = {
  points: GeoDevicePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: { lat: number; lng: number };
  heatmapEnabled: boolean;
  prediction: UnsafeSpreadPrediction | null;
};

export const GeoIntelligenceMap = memo(
  ({ points, selectedId, onSelect, center, heatmapEnabled, prediction }: Props) => {
    const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
    const selectedPoint = useMemo(
      () => points.find((point) => point.id === selectedId) ?? null,
      [points, selectedId],
    );

    const heatRings = useMemo(
      () =>
        heatmapEnabled
          ? points.map((point) => ({
              id: point.id,
              position: [point.lat, point.lng] as [number, number],
              radius: point.status === "unsafe" ? 240 : point.status === "moderate" ? 180 : 120,
              color: markerColor(point.status),
            }))
          : [],
      [heatmapEnabled, points],
    );

    if (!points.length) {
      return (
        <div className="grid h-full min-h-[26rem] gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <Skeleton className="h-10 w-1/3 rounded-xl" />
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            No geo points available yet.
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-full min-h-[26rem]">
        <MapContainerAny
          center={[center.lat, center.lng]}
          zoom={11}
          className="h-full w-full"
          zoomControl
          scrollWheelZoom
        >
          <TileLayerAny
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {heatRings.map((ring) => (
            <CircleAny
              key={`heat-${ring.id}`}
              center={ring.position}
              radius={ring.radius}
              pathOptions={{
                color: ring.color,
                fillColor: ring.color,
                fillOpacity: 0.18,
                weight: 1,
              }}
            />
          ))}

          {prediction ? (
            <CircleAny
              center={prediction.center}
              radius={Math.max(600, prediction.riskScore * 25)}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          ) : null}

          {points.map((point) => (
            <CircleMarkerAny
              key={point.id}
              center={[point.lat, point.lng]}
              radius={point.status === "unsafe" ? 12 : point.status === "moderate" ? 10 : 8}
              pathOptions={{
                color: "#ffffff",
                fillColor: markerColor(point.status),
                fillOpacity: 0.95,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  onSelect(point.id);
                  setActiveMarkerId(point.id);
                },
              }}
            >
              <Popup>
                <div className="min-w-[220px] text-slate-900">
                  <p className="text-sm font-bold">{point.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {point.location ?? point.zone ?? "Unknown location"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>pH: {point.ph ?? "-"}</div>
                    <div>Turbidity: {point.turbidity ?? "-"}</div>
                    <div>Temp: {point.temperature ?? "-"}</div>
                    <div>Status: {point.status}</div>
                  </div>
                </div>
              </Popup>
            </CircleMarkerAny>
          ))}

          {selectedPoint ? (
            <MarkerAny position={[selectedPoint.lat, selectedPoint.lng]}>
              <Popup>
                <div className="min-w-[220px] text-slate-900">
                  <p className="text-sm font-bold">Selected: {selectedPoint.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedPoint.location ?? selectedPoint.zone ?? "Unknown location"}
                  </p>
                </div>
              </Popup>
            </MarkerAny>
          ) : null}
        </MapContainerAny>
      </div>
    );
  },
);

GeoIntelligenceMap.displayName = "GeoIntelligenceMap";
