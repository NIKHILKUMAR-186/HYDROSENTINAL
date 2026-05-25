import { useCallback, useEffect, useMemo, useState } from "react";
import { getZone } from "@/lib/utils";

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

const reverseGeocodeUrl = (lat, lng) =>
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;

export const useLocation = (initialValue = INDIA_CENTER) => {
  const [coords, setCoords] = useState(initialValue);
  const [address, setAddress] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [error, setError] = useState("");

  const zone = useMemo(() => getZone(coords.lat, coords.lng), [coords.lat, coords.lng]);

  const resolveAddress = useCallback(async (lat, lng) => {
    setLoadingAddress(true);
    setError("");

    try {
      const response = await fetch(reverseGeocodeUrl(lat, lng), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed (${response.status})`);
      }

      const data = await response.json();
      const nextAddress = data?.display_name || "Selected location";
      setAddress(nextAddress);
      return nextAddress;
    } catch (err) {
      console.warn("Reverse geocoding failed", err);
      setAddress("");
      setError("Unable to resolve address right now.");
      return "";
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  const geocodeAddress = useCallback(async (query) => {
    setLoadingAddress(true);
    setError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No results found");
      }

      const first = data[0];
      const nextCoords = {
        lat: Number(first.lat),
        lng: Number(first.lon),
      };
      const nextAddress = first.display_name || query;
      setCoords(nextCoords);
      setAddress(nextAddress);
      return { ...nextCoords, address: nextAddress };
    } catch (err) {
      console.warn("Forward geocoding failed", err);
      setError("Unable to resolve address from text.");
      return null;
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  useEffect(() => {
    void resolveAddress(coords.lat, coords.lng);
  }, [coords.lat, coords.lng, resolveAddress]);

  const updateFromMap = useCallback(async (lat, lng) => {
    setCoords({ lat, lng });
    return resolveAddress(lat, lng);
  }, [resolveAddress]);

  const useCurrentLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported on this browser.");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoords(nextCoords);
          const nextAddress = await resolveAddress(nextCoords.lat, nextCoords.lng);
          resolve({ ...nextCoords, address: nextAddress });
        },
        () => {
          setError("Location permission denied.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, [resolveAddress]);

  return {
    coords,
    setCoords,
    updateFromMap,
    geocodeAddress,
    useCurrentLocation,
    address,
    zone,
    loadingAddress,
    error,
  };
};

export default useLocation;
