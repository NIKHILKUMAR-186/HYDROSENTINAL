import { beforeEach, describe, expect, it } from "vitest";
import {
  DeviceRecord,
  generateRandomReading,
  appendLocalDeviceReading,
  getLocalDeviceHistory,
  upsertLocalDevice,
} from "@/lib/deviceStore";

describe("Device store simulator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generateRandomReading returns a full reading", () => {
    const r = generateRandomReading();
    expect(r).toHaveProperty("timestamp");
    expect(typeof r.ph).toBe("number");
    expect(typeof r.tds).toBe("number");
    expect(typeof r.turbidity).toBe("number");
    expect(typeof r.temperature).toBe("number");
    expect(["SAFE", "NOT SAFE"]).toContain(r.status);
  });

  it("appendLocalDeviceReading appends and keeps at most 30 readings", () => {
    const demoDevice: DeviceRecord = {
      id: "demo-device",
      ownerUid: "demo",
      name: "Demo",
      uniqueId: "demo-device",
      location: "North",
      battery: 85,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    upsertLocalDevice(demoDevice);

    const before = getLocalDeviceHistory(demoDevice.id);
    const initialLen = before.length;

    for (let i = 0; i < 35; i++) {
      appendLocalDeviceReading(demoDevice.id);
    }

    const after = getLocalDeviceHistory(demoDevice.id);
    expect(after.length).toBeLessThanOrEqual(30);
    expect(after.length).toBeGreaterThanOrEqual(initialLen);
  });
});
