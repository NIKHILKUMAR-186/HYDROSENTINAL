import { useEffect, useMemo, useState } from "react";
import { DeviceReading } from "@/lib/deviceStore";
import {
  GeoDevicePoint,
  WaterRiskLevel,
  getSafetyScore,
  toWaterRiskLevel,
} from "@/lib/geoIntelligence";

type SimulatedPoint = GeoDevicePoint & {
  simulated: true;
  safetyScore: number;
};

const randomInRange = (min: number, max: number, fractionDigits = 2) =>
  Number((min + Math.random() * (max - min)).toFixed(fractionDigits));

const randomWalk = (value: number, magnitude: number, min: number, max: number) => {
  const next = value + (Math.random() - 0.5) * magnitude;
  return Math.max(min, Math.min(max, next));
};

export const useGeoSimulation = (
  center: { lat: number; lng: number },
  enabled: boolean,
  count = 70,
) => {
  const [simReadings, setSimReadings] = useState<Record<string, DeviceReading>>({});

  const simulatedDevices = useMemo<SimulatedPoint[]>(() => {
    if (!enabled) return [];
    return Array.from({ length: count }).map((_, index) => {
      const offsetLat = randomInRange(-0.12, 0.12, 4);
      const offsetLng = randomInRange(-0.12, 0.12, 4);
      const id = `sim-${index + 1}`;
      const reading = simReadings[id] ?? {
        timestamp: new Date().toISOString(),
        ph: randomInRange(6.3, 8.7, 2),
        tds: randomInRange(220, 1200, 0),
        turbidity: randomInRange(2, 30, 1),
        temperature: randomInRange(22, 34, 1),
        status: "SAFE",
      };
      const status = toWaterRiskLevel(reading);
      const safetyScore = getSafetyScore(reading);
      return {
        id,
        name: `Sim Device ${index + 1}`,
        lat: center.lat + offsetLat,
        lng: center.lng + offsetLng,
        status,
        ph: reading.ph,
        tds: reading.tds,
        turbidity: reading.turbidity,
        temperature: reading.temperature,
        location: "Simulation Grid",
        zone: `SimZone-${Math.ceil((index + 1) / 10)}`,
        battery: randomInRange(40, 98, 0),
        ownerUid: "simulator",
        simulated: true,
        safetyScore,
      };
    });
  }, [center.lat, center.lng, count, enabled, simReadings]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      setSimReadings((prev) => {
        const next: Record<string, DeviceReading> = { ...prev };
        for (let index = 0; index < count; index += 1) {
          const id = `sim-${index + 1}`;
          const current = next[id] ?? {
            timestamp: new Date().toISOString(),
            ph: randomInRange(6.3, 8.7, 2),
            tds: randomInRange(220, 1200, 0),
            turbidity: randomInRange(2, 30, 1),
            temperature: randomInRange(22, 34, 1),
            status: "SAFE" as const,
          };
          const reading: DeviceReading = {
            timestamp: new Date().toISOString(),
            ph: Number(randomWalk(current.ph, 0.35, 5.8, 9.1).toFixed(2)),
            tds: Math.round(randomWalk(current.tds, 140, 150, 1450)),
            turbidity: Number(randomWalk(current.turbidity, 5, 0.5, 40).toFixed(1)),
            temperature: Number(randomWalk(current.temperature, 1.4, 18, 38).toFixed(1)),
            status: "SAFE",
          };
          const risk = toWaterRiskLevel(reading);
          reading.status = risk === "unsafe" ? "NOT SAFE" : "SAFE";
          next[id] = reading;
        }
        return next;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [count, enabled]);

  const alertFeed = useMemo(() => {
    return simulatedDevices
      .filter((device) => device.status === "unsafe")
      .slice(0, 20)
      .map((device) => ({
        id: `alert-${device.id}`,
        deviceId: device.id,
        message: `${device.name} crossed safe water limits`,
        status: device.status as WaterRiskLevel,
        timestamp: new Date().toISOString(),
      }));
  }, [simulatedDevices]);

  return { simulatedDevices, alertFeed };
};
