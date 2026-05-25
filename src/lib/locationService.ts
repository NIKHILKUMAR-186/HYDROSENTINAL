/**
 * locationService.ts - Location handling, geocoding, and validation
 * Provides real geolocation detection and address reversal lookup
 */

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationWithAddress extends LocationCoordinates {
  address?: string;
  city?: string;
  country?: string;
  formattedAddress?: string;
}

/**
 * Get user's current GPS location using Geolocation API
 */
export const getCurrentLocation = async (): Promise<LocationCoordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        reject(error);
      },
      {
        timeout: 10000,
        enableHighAccuracy: true,
      },
    );
  });
};

/**
 * Validate latitude and longitude
 */
export const validateCoordinates = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Reverse geocode coordinates using OpenStreetMap (free, no API key needed)
 * Falls back gracefully if API unavailable
 */
export const reverseGeocode = async (
  lat: number,
  lng: number,
): Promise<LocationWithAddress> => {
  if (!validateCoordinates(lat, lng)) {
    return { lat, lng, formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: { "Accept": "application/json" },
      },
    );
    
    if (!response.ok) throw new Error("Nominatim API failed");
    
    const data = await response.json();
    const address = data.address || {};
    
    return {
      lat,
      lng,
      address: data.display_name,
      city: address.city || address.town || address.village,
      country: address.country,
      formattedAddress: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  } catch (error) {
    console.warn("Reverse geocoding failed, using coordinates only:", error);
    return {
      lat,
      lng,
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
};

/**
 * Forward geocode (search for address) using OpenStreetMap Nominatim
 * Returns top result with coordinates
 */
export const forwardGeocode = async (
  query: string,
): Promise<LocationWithAddress[]> => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      {
        headers: { "Accept": "application/json" },
      },
    );
    
    if (!response.ok) throw new Error("Nominatim API failed");
    
    const results = await response.json();
    
    return results.map((result: any) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
      formattedAddress: result.display_name,
    }));
  } catch (error) {
    console.warn("Forward geocoding failed:", error);
    return [];
  }
};

/**
 * Calculate distance between two coordinates (in kilometers)
 * Using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if point is within radius of another point
 */
export const isWithinRadius = (
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
): boolean => {
  const distance = calculateDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusKm;
};

/**
 * Get India-specific zones for water monitoring
 */
export const getWaterZone = (lat: number, lng: number): string => {
  const zones = [
    {
      name: "Ganga Basin",
      bounds: { minLat: 23, maxLat: 32, minLng: 73, maxLng: 89 },
    },
    {
      name: "Brahmaputra Basin",
      bounds: { minLat: 22, maxLat: 32, minLng: 85, maxLng: 97 },
    },
    {
      name: "Deccan Rivers",
      bounds: { minLat: 12, maxLat: 22, minLng: 68, maxLng: 80 },
    },
    {
      name: "Western Coastal",
      bounds: { minLat: 8, maxLat: 20, minLng: 68, maxLng: 76 },
    },
    {
      name: "Bay of Bengal",
      bounds: { minLat: 8, maxLat: 22, minLng: 80, maxLng: 92 },
    },
  ];
  
  for (const zone of zones) {
    if (
      lat >= zone.bounds.minLat &&
      lat <= zone.bounds.maxLat &&
      lng >= zone.bounds.minLng &&
      lng <= zone.bounds.maxLng
    ) {
      return zone.name;
    }
  }
  
  return "Other Region";
};
