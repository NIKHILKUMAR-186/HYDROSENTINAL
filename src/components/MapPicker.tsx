import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
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
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    country: string;
    state: string;
    district: string;
    city: string;
    postalCode: string;
    accuracy: number | null;
    permissionStatus: string;
    gpsStatus: string;
    source: "sync" | "current-location" | "search" | "map-click" | "marker-drag";
  }) => void;
  initialLat?: number;
  initialLng?: number;
}

const LocationMarker: React.FC<{
  onLocationSelect: (
    lat: number,
    lng: number,
    source: "map-click" | "marker-drag",
  ) => void;
  initialLat?: number;
  initialLng?: number;
}> = ({ onLocationSelect, initialLat = 20.5937, initialLng = 78.9629 }) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  useEffect(() => {
    if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect(lat, lng, 'map-click');
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
          onLocationSelect(lat, lng, 'marker-drag');
        },
      }}
    />
  );
};

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [lat, lng, map]);

  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ onLocationSelect, initialLat, initialLng }) => {
  const {
    coords,
    updateFromMap,
    geocodeAddress,
    useCurrentLocation,
    startLiveTracking,
    stopLiveTracking,
    address,
    addressDetails,
    zone,
    accuracy,
    loadingAddress,
    locating,
    permissionStatus,
    gpsStatus,
    liveTracking,
    error,
  } = useLocation(
    Number.isFinite(initialLat) && Number.isFinite(initialLng)
      ? { lat: initialLat, lng: initialLng }
      : INDIA_CENTER,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mapLoading, setMapLoading] = useState(true);

  const selectedAddress = useMemo(
    () => address || addressDetails.fullAddress || 'Selected location',
    [address, addressDetails.fullAddress],
  );

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
        onLocationSelect({
          lat: result.lat,
          lng: result.lng,
          address: result.address,
          country: result.country || '',
          state: result.state || '',
          district: result.district || '',
          city: result.city || '',
          postalCode: result.postalCode || '',
          accuracy,
          permissionStatus,
          gpsStatus,
          source: 'search',
        });
      } else {
        setSearchError('Location not found. Try a more specific address.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    onLocationSelect({
      lat: coords.lat,
      lng: coords.lng,
      address: selectedAddress,
      country: addressDetails.country || '',
      state: addressDetails.state || '',
      district: addressDetails.district || '',
      city: addressDetails.city || '',
      postalCode: addressDetails.postalCode || '',
      accuracy,
      permissionStatus,
      gpsStatus,
      source: 'sync',
    });
  }, [
    accuracy,
    addressDetails.city,
    addressDetails.country,
    addressDetails.district,
    addressDetails.postalCode,
    addressDetails.state,
    coords.lat,
    coords.lng,
    gpsStatus,
    onLocationSelect,
    permissionStatus,
    selectedAddress,
  ]);

  useEffect(() => {
    void useCurrentLocation();
  }, [useCurrentLocation]);

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
            onLocationSelect({
              lat: next.lat,
              lng: next.lng,
              address: next.address || 'Current location',
              country: addressDetails.country || '',
              state: addressDetails.state || '',
              district: addressDetails.district || '',
              city: addressDetails.city || '',
              postalCode: addressDetails.postalCode || '',
              accuracy: next.accuracy ?? accuracy,
              permissionStatus,
              gpsStatus,
              source: 'current-location',
            });
          })}
          className="bg-cyan-500 text-white hover:bg-cyan-600"
          disabled={locating}
        >
          {locating ? 'Locating...' : 'Use Current Location'}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          onClick={() => {
            if (liveTracking) {
              stopLiveTracking();
              return;
            }
            startLiveTracking();
          }}
        >
          {liveTracking ? 'Stop Live Tracking' : 'Enable Live Tracking'}
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
            eventHandlers={{
              load: () => setMapLoading(false),
            }}
          />
          <RecenterMap lat={coords.lat} lng={coords.lng} />
          <LocationMarker
            onLocationSelect={(lat, lng, source) => {
              void updateFromMap(lat, lng);
              onLocationSelect({
                lat,
                lng,
                address: selectedAddress,
                country: addressDetails.country || '',
                state: addressDetails.state || '',
                district: addressDetails.district || '',
                city: addressDetails.city || '',
                postalCode: addressDetails.postalCode || '',
                accuracy,
                permissionStatus,
                gpsStatus,
                source,
              });
            }}
            initialLat={coords.lat}
            initialLng={coords.lng}
          />
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
          <p className="font-semibold">{zone || getZone(coords.lat, coords.lng)}</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-2">
        <p><span className="font-semibold">Permission:</span> {permissionStatus}</p>
        <p><span className="font-semibold">GPS status:</span> {gpsStatus}</p>
        <p><span className="font-semibold">Map loading:</span> {mapLoading ? 'Loading' : 'Ready'}</p>
        <p><span className="font-semibold">Accuracy:</span> {Number.isFinite(accuracy) ? `${accuracy.toFixed(1)} m` : 'N/A'}</p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200 sm:grid-cols-2">
        <p className="sm:col-span-2"><span className="font-semibold">Detected Address:</span> {loadingAddress ? 'Resolving address...' : selectedAddress}</p>
        <p><span className="font-semibold">Country:</span> {addressDetails.country || 'N/A'}</p>
        <p><span className="font-semibold">State:</span> {addressDetails.state || 'N/A'}</p>
        <p><span className="font-semibold">District:</span> {addressDetails.district || 'N/A'}</p>
        <p><span className="font-semibold">City:</span> {addressDetails.city || 'N/A'}</p>
        <p><span className="font-semibold">Pincode:</span> {addressDetails.postalCode || 'N/A'}</p>
      </div>

      {error ? (
        <p className="text-xs text-amber-600 dark:text-amber-300">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">
        Click map, drag marker, search place, or use current location. All changes update coordinates and address instantly.
      </div>
    </div>
  );
};
