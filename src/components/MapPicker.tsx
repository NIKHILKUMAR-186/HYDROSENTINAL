import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import useLocation from '@/hooks/useLocation';
import { getZone } from '@/lib/utils';

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}

const LocationMarker: React.FC<{
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}> = ({ onLocationSelect, initialLat = 20.5937, initialLng = 78.9629 }) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect(lat, lng, 'Selected from map');
    },
  });

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const { lat, lng } = marker.getLatLng();
          setPosition([lat, lng]);
          onLocationSelect(lat, lng, 'Dragged location');
        },
      }}
    />
  );
};

export const MapPicker: React.FC<MapPickerProps> = ({ onLocationSelect, initialLat, initialLng }) => {
  const { coords, updateFromMap, geocodeAddress, useCurrentLocation, address } = useLocation(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : INDIA_CENTER,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Enter a location to search.');
      return;
    }

    setSearchError('');
    setSearchLoading(true);
    try {
      const result = await geocodeAddress(searchTerm.trim());
      if (result) {
        await updateFromMap(result.lat, result.lng);
        onLocationSelect(result.lat, result.lng, result.address);
      } else {
        setSearchError('Location not found. Try a more specific address.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    onLocationSelect(coords.lat, coords.lng, address || 'Selected location');
  }, [address, coords.lat, coords.lng, onLocationSelect]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Pick device location</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search an address or place the marker on the map.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void useCurrentLocation().then((next) => {
            if (!next) return;
            onLocationSelect(next.lat, next.lng, next.address || 'Current location');
          })}
          className="bg-cyan-500 text-white hover:bg-cyan-600"
        >
          Use Current Location
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search address or location"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <Button
          type="button"
          onClick={handleSearch}
          className="whitespace-nowrap bg-slate-800 text-white hover:bg-slate-900"
          disabled={searchLoading}
        >
          {searchLoading ? 'Searching...' : 'Find location'}
        </Button>
      </div>
      {searchError ? <p className="text-xs text-red-500">{searchError}</p> : null}

      <div className="h-72 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} initialLat={coords.lat} initialLng={coords.lng} />
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
          <p className="font-semibold">{getZone(coords.lat, coords.lng)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">
        {address || 'No address resolved yet.'}
      </div>
    </div>
  );
};
