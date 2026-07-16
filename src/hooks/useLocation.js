import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getZone } from "@/lib/utils";

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

const DEBOUNCE_MS = 350;

const reverseGeocodeUrl = (lat, lng) =>
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;

const searchGeocodeUrl = (query) =>
  `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;

const toFinite = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAddressData = (data, fallbackLat, fallbackLng, fallbackAddress = "") => {
  const address = data?.address || {};
  const lat = toFinite(data?.lat, fallbackLat) ?? fallbackLat;
  const lng = toFinite(data?.lon, fallbackLng) ?? fallbackLng;
  const city =
    address.city || address.town || address.village || address.hamlet || "";
  const district =
    address.state_district || address.county || address.municipality || "";

  return {
    lat,
    lng,
    fullAddress: data?.display_name || fallbackAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    country: address.country || "",
    state: address.state || address.region || "",
    district,
    city,
    postalCode: address.postcode || "",
  };
};

export const useLocation = (initialValue = INDIA_CENTER) => {
  const safeInitial = {
    lat: toFinite(initialValue?.lat, INDIA_CENTER.lat) ?? INDIA_CENTER.lat,
    lng: toFinite(initialValue?.lng, INDIA_CENTER.lng) ?? INDIA_CENTER.lng,
  };

  const [coords, setCoords] = useState(safeInitial);
  const [accuracy, setAccuracy] = useState(null);
  const [addressDetails, setAddressDetails] = useState(() =>
    normalizeAddressData(null, safeInitial.lat, safeInitial.lng, ""),
  );
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [liveTracking, setLiveTracking] = useState(false);
  const [error, setError] = useState("");

  const reverseDebounceRef = useRef(null);
  const activeReverseControllerRef = useRef(null);
  const watchIdRef = useRef(null);
  const cacheRef = useRef(new Map());

  const zone = useMemo(() => getZone(coords.lat, coords.lng), [coords.lat, coords.lng]);

  const updateCoordinates = useCallback((lat, lng, nextAccuracy = null) => {
    const safeLat = toFinite(lat);
    const safeLng = toFinite(lng);

    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
      return false;
    }

    setCoords({ lat: safeLat, lng: safeLng });
    if (Number.isFinite(nextAccuracy)) {
      setAccuracy(nextAccuracy);
    }
    setError("");
    return true;
  }, []);

  const resolveAddress = useCallback(async (lat, lng) => {
    const safeLat = toFinite(lat);
    const safeLng = toFinite(lng);

    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
      return "";
    }

    const cacheKey = `${safeLat.toFixed(6)},${safeLng.toFixed(6)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setAddressDetails(cached);
      setError("");
      return cached.fullAddress;
    }

    activeReverseControllerRef.current?.abort();
    const controller = new AbortController();
    activeReverseControllerRef.current = controller;

    setLoadingAddress(true);
    setError("");

    try {
      const response = await fetch(reverseGeocodeUrl(safeLat, safeLng), {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed (${response.status})`);
      }

      const data = await response.json();
      const normalized = normalizeAddressData(data, safeLat, safeLng);
      cacheRef.current.set(cacheKey, normalized);
      setAddressDetails(normalized);
      return normalized.fullAddress;
    } catch (err) {
      if (err?.name === "AbortError") {
        return "";
      }

      console.warn("Reverse geocoding failed", err);
      setAddressDetails((prev) => ({
        ...prev,
        lat: safeLat,
        lng: safeLng,
        fullAddress: `${safeLat.toFixed(6)}, ${safeLng.toFixed(6)}`,
      }));
      setError("Unable to resolve address right now.");
      return "";
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  const scheduleResolveAddress = useCallback(
    (lat, lng) => {
      if (reverseDebounceRef.current) {
        window.clearTimeout(reverseDebounceRef.current);
      }

      reverseDebounceRef.current = window.setTimeout(() => {
        void resolveAddress(lat, lng);
      }, DEBOUNCE_MS);
    },
    [resolveAddress],
  );

  const geocodeAddress = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setError("Enter at least 2 characters to search.");
      return null;
    }

    setLoadingAddress(true);
    setError("");

    try {
      const response = await fetch(searchGeocodeUrl(query), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No results found");
      }

      const first = data[0];
      const normalized = normalizeAddressData(first, safeInitial.lat, safeInitial.lng, query);
      const didUpdate = updateCoordinates(normalized.lat, normalized.lng);
      if (!didUpdate) {
        throw new Error("Geocoding returned invalid coordinates");
      }

      setAddressDetails(normalized);
      cacheRef.current.set(`${normalized.lat.toFixed(6)},${normalized.lng.toFixed(6)}`, normalized);

      return {
        lat: normalized.lat,
        lng: normalized.lng,
        address: normalized.fullAddress,
        country: normalized.country,
        state: normalized.state,
        district: normalized.district,
        city: normalized.city,
        postalCode: normalized.postalCode,
      };
    } catch (err) {
      console.warn("Forward geocoding failed", err);
      setError("Unable to resolve address from text.");
      return null;
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  useEffect(() => {
    scheduleResolveAddress(coords.lat, coords.lng);
  }, [coords.lat, coords.lng, scheduleResolveAddress]);

  const updateFromMap = useCallback(async (lat, lng) => {
    const didUpdate = updateCoordinates(lat, lng);
    if (!didUpdate) {
      return "";
    }

    return resolveAddress(lat, lng);
  }, [resolveAddress, updateCoordinates]);

  const useCurrentLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported on this browser.");
        setGpsStatus("unsupported");
        setPermissionStatus("unsupported");
        resolve(null);
        return;
      }

      setLocating(true);
      setGpsStatus("locating");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          updateCoordinates(nextCoords.lat, nextCoords.lng, position.coords.accuracy);
          setPermissionStatus("granted");
          setGpsStatus("ready");
          setLocating(false);

          const nextAddress = await resolveAddress(nextCoords.lat, nextCoords.lng);
          resolve({
            ...nextCoords,
            accuracy: position.coords.accuracy,
            address: nextAddress,
          });
        },
        (geoError) => {
          setLocating(false);
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setPermissionStatus("denied");
            setGpsStatus("permission-denied");
            setError("Location permission denied. Select a point manually on the map.");
          } else if (geoError.code === geoError.TIMEOUT) {
            setGpsStatus("timeout");
            setError("Location request timed out. Try current location again.");
          } else {
            setGpsStatus("unavailable");
            setError("GPS is unavailable. You can still search or pick on map.");
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, [resolveAddress, updateCoordinates]);

  const stopLiveTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLiveTracking(false);
    setGpsStatus((prev) => (prev === "tracking" ? "ready" : prev));
  }, []);

  const startLiveTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this browser.");
      setPermissionStatus("unsupported");
      setGpsStatus("unsupported");
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setLiveTracking(true);
    setGpsStatus("tracking");
    setError("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
        );
        setPermissionStatus("granted");
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setPermissionStatus("denied");
          setGpsStatus("permission-denied");
          setError("Live tracking blocked by browser permission.");
        } else if (geoError.code === geoError.TIMEOUT) {
          setGpsStatus("timeout");
          setError("Live tracking timed out.");
        } else {
          setGpsStatus("unavailable");
          setError("Live tracking unavailable.");
        }
        stopLiveTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      },
    );
  }, [stopLiveTracking, updateCoordinates]);

  useEffect(() => {
    if (!navigator?.permissions?.query) {
      return;
    }

    let active = true;
    let permissionStatusHandle = null;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (!active) return;
        permissionStatusHandle = status;
        setPermissionStatus(status.state);

        status.onchange = () => {
          setPermissionStatus(status.state);
        };
      })
      .catch(() => {
        // Ignore unsupported permission APIs.
      });

    return () => {
      active = false;
      if (permissionStatusHandle) {
        permissionStatusHandle.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (reverseDebounceRef.current) {
        window.clearTimeout(reverseDebounceRef.current);
      }
      activeReverseControllerRef.current?.abort();
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    coords,
    accuracy,
    setCoords,
    updateFromMap,
    geocodeAddress,
    useCurrentLocation,
    startLiveTracking,
    stopLiveTracking,
    address: addressDetails.fullAddress,
    addressDetails,
    zone,
    loadingAddress,
    locating,
    permissionStatus,
    gpsStatus,
    liveTracking,
    error,
  };
};

export default useLocation;
