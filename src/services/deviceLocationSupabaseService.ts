import { supabase } from "@/utils/supabase";

export type DeviceLocationPayload = {
  deviceId: string;
  ownerUid: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  postalCode: string;
  zone: string;
  accuracy: number | null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const saveDeviceLocationToSupabase = async (
  payload: DeviceLocationPayload,
) => {
  if (!isFiniteNumber(payload.latitude) || !isFiniteNumber(payload.longitude)) {
    throw new Error("Latitude and longitude are required before registration.");
  }

  const record = {
    device_id: payload.deviceId,
    owner_uid: payload.ownerUid,
    name: payload.name,
    latitude: payload.latitude,
    longitude: payload.longitude,
    address: payload.address,
    city: payload.city,
    district: payload.district,
    state: payload.state,
    country: payload.country,
    postal_code: payload.postalCode,
    zone: payload.zone,
    accuracy: payload.accuracy,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("device_locations")
    .upsert(record, { onConflict: "device_id" })
    .select("device_id, latitude, longitude")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to save location to Supabase.");
  }

  return data;
};
