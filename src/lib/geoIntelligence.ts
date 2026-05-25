import { DeviceReading, DeviceRecord } from "@/lib/deviceStore";

export type WaterRiskLevel = "safe" | "moderate" | "unsafe";

export type GeoDevicePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: WaterRiskLevel;
  ph?: number;
  turbidity?: number;
  temperature?: number;
  tds?: number;
  battery?: number;
  zone?: string;
  location?: string;
  ownerUid?: string;
};

export type RadiusInsight = {
  radiusKm: number;
  totalDevices: number;
  unsafeDevices: number;
  avgSafetyScore: number;
  avgPh: number;
  avgTurbidity: number;
};

export type ZoneInsight = {
  zoneId: string;
  devices: GeoDevicePoint[];
  avgSafetyScore: number;
  unsafeCount: number;
  riskLevel: WaterRiskLevel;
};

export type UnsafeSpreadPrediction = {
  center: { lat: number; lng: number };
  riskScore: number;
  message: string;
  affectedDeviceIds: string[];
};

export const toWaterRiskLevel = (
  reading?: Pick<DeviceReading, "ph" | "tds" | "turbidity" | "status">,
): WaterRiskLevel => {
  if (!reading) return "moderate";
  const isUnsafe =
    reading.status === "NOT SAFE" ||
    (reading.ph ?? 7) < 6 ||
    (reading.ph ?? 7) > 8.5 ||
    (reading.turbidity ?? 0) > 25 ||
    (reading.tds ?? 0) > 1000;
  if (isUnsafe) return "unsafe";

  const isModerate =
    (reading.ph ?? 7) < 6.5 ||
    (reading.ph ?? 7) > 8.2 ||
    (reading.turbidity ?? 0) > 15 ||
    (reading.tds ?? 0) > 750;
  return isModerate ? "moderate" : "safe";
};

export const getSafetyScore = (
  reading?: Pick<DeviceReading, "ph" | "tds" | "turbidity" | "temperature">,
) => {
  if (!reading) return 50;

  const phPenalty = Math.min(30, Math.abs((reading.ph ?? 7) - 7) * 12);
  const turbidityPenalty = Math.min(35, Math.max(0, (reading.turbidity ?? 0) - 5) * 1.5);
  const tdsPenalty = Math.min(30, Math.max(0, (reading.tds ?? 200) - 300) / 30);
  const tempPenalty = Math.min(15, Math.max(0, Math.abs((reading.temperature ?? 25) - 26) * 1.8));
  const score = 100 - phPenalty - turbidityPenalty - tdsPenalty - tempPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const haversineKm = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const makeGeoDevicePoints = (
  devices: DeviceRecord[],
  latestReadingByDevice: Record<string, DeviceReading | undefined>,
): GeoDevicePoint[] =>
  devices
    .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
    .map((d) => {
      const latest = latestReadingByDevice[d.id];
      return {
        id: d.id,
        name: d.name,
        lat: d.latitude as number,
        lng: d.longitude as number,
        status: toWaterRiskLevel(latest),
        ph: latest?.ph,
        turbidity: latest?.turbidity,
        temperature: latest?.temperature,
        tds: latest?.tds,
        battery: d.battery,
        zone: d.zone,
        location: d.location,
        ownerUid: d.ownerUid,
      };
    });

export const getRadiusInsights = (
  center: { lat: number; lng: number },
  points: GeoDevicePoint[],
  radiiKm: number[],
): RadiusInsight[] =>
  radiiKm.map((radiusKm) => {
    const inRadius = points.filter((p) => haversineKm(center, p) <= radiusKm);
    const unsafeDevices = inRadius.filter((p) => p.status === "unsafe").length;
    const safeScores = inRadius.map((p) =>
      getSafetyScore({
        ph: p.ph,
        tds: p.tds,
        turbidity: p.turbidity,
        temperature: p.temperature,
      }),
    );
    const avgSafetyScore = safeScores.length
      ? Math.round(safeScores.reduce((sum, curr) => sum + curr, 0) / safeScores.length)
      : 0;
    const avgPh = inRadius.length
      ? Number(
          (
            inRadius.reduce((sum, curr) => sum + (curr.ph ?? 7), 0) / inRadius.length
          ).toFixed(2),
        )
      : 0;
    const avgTurbidity = inRadius.length
      ? Number(
          (
            inRadius.reduce((sum, curr) => sum + (curr.turbidity ?? 0), 0) /
            inRadius.length
          ).toFixed(1),
        )
      : 0;

    return {
      radiusKm,
      totalDevices: inRadius.length,
      unsafeDevices,
      avgSafetyScore,
      avgPh,
      avgTurbidity,
    };
  });

export const buildZoneInsights = (points: GeoDevicePoint[]) => {
  const zoneMap = new Map<string, GeoDevicePoint[]>();
  points.forEach((point) => {
    const zoneId = point.zone ?? `Grid_${Math.floor(point.lat * 10)}_${Math.floor(point.lng * 10)}`;
    const current = zoneMap.get(zoneId) ?? [];
    zoneMap.set(zoneId, [...current, point]);
  });

  const zones: ZoneInsight[] = Array.from(zoneMap.entries()).map(([zoneId, devices]) => {
    const unsafeCount = devices.filter((d) => d.status === "unsafe").length;
    const avgSafetyScore = Math.round(
      devices.reduce(
        (sum, d) =>
          sum +
          getSafetyScore({
            ph: d.ph,
            turbidity: d.turbidity,
            tds: d.tds,
            temperature: d.temperature,
          }),
        0,
      ) / devices.length,
    );
    const riskLevel: WaterRiskLevel =
      unsafeCount >= Math.ceil(devices.length * 0.4)
        ? "unsafe"
        : unsafeCount > 0
          ? "moderate"
          : "safe";

    return { zoneId, devices, avgSafetyScore, unsafeCount, riskLevel };
  });

  return zones.sort((a, b) => b.unsafeCount - a.unsafeCount);
};

export const getUnsafeSpreadPrediction = (
  selectedPoint: GeoDevicePoint | null,
  points: GeoDevicePoint[],
): UnsafeSpreadPrediction | null => {
  if (!selectedPoint) return null;

  const nearby = points.filter(
    (point) =>
      point.id !== selectedPoint.id &&
      haversineKm({ lat: selectedPoint.lat, lng: selectedPoint.lng }, point) <= 5,
  );
  if (!nearby.length) return null;

  const unsafeNearby = nearby.filter((p) => p.status === "unsafe").length;
  const moderateNearby = nearby.filter((p) => p.status === "moderate").length;
  const pressure = unsafeNearby * 1.2 + moderateNearby * 0.6;
  const riskScore = Math.min(100, Math.round((pressure / nearby.length) * 100));

  if (riskScore < 35) return null;

  return {
    center: { lat: selectedPoint.lat, lng: selectedPoint.lng },
    riskScore,
    message:
      riskScore >= 70
        ? "Unsafe spread probability is high in this locality."
        : "This area may become unsafe soon. Monitor nearby devices closely.",
    affectedDeviceIds: nearby.map((p) => p.id),
  };
};
