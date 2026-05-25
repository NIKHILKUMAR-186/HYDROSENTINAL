import { beforeEach, describe, expect, it } from "vitest";
import { buildUserWorkbookXml } from "@/lib/excelSync";

describe("Excel sync", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds one summary sheet and one sheet per device", () => {
    const workbook = buildUserWorkbookXml(
      { uid: "user-1", email: "test@example.com" },
      [
        {
          id: "device-1",
          ownerUid: "user-1",
          name: "North Sensor",
          uniqueId: "DEVICE_NORTH",
          location: "North Zone",
          battery: 90,
          status: "active",
          createdAt: "2026-04-30T08:00:00.000Z",
        },
        {
          id: "device-2",
          ownerUid: "user-1",
          name: "South Sensor",
          uniqueId: "DEVICE_SOUTH",
          location: "South Zone",
          battery: 75,
          status: "inactive",
          createdAt: "2026-04-30T09:00:00.000Z",
        },
      ]
    );

    expect(workbook).toContain('ss:Name="User Summary"');
    expect(workbook).toContain('ss:Name="North Sensor"');
    expect(workbook).toContain('ss:Name="South Sensor"');
    expect(workbook).toContain("DEVICE_NORTH");
    expect(workbook).toContain("DEVICE_SOUTH");
  });

  it("exports only the last 10 readings for each device", () => {
    const readingsByDevice = {
      "device-1": Array.from({ length: 12 }, (_, index) => ({
          timestamp: `2026-04-30T00:${String(index).padStart(2, "0")}:00.000Z`,
          ph: 7,
          tds: 100 + index,
          turbidity: 5,
          temperature: 25,
          status: "SAFE" as const,
      })),
    };

    const workbook = buildUserWorkbookXml(
      { uid: "user-1", email: "test@example.com" },
      [
        {
          id: "device-1",
          ownerUid: "user-1",
          name: "North Sensor",
          uniqueId: "DEVICE_NORTH",
          location: "North Zone",
          status: "active",
          createdAt: "2026-04-30T08:00:00.000Z",
        },
      ],
      { readingsByDevice }
    );

    expect(workbook).not.toContain("2026-04-30T00:00:00.000Z");
    expect(workbook).not.toContain("2026-04-30T00:01:00.000Z");
    expect(workbook).toContain("2026-04-30T00:02:00.000Z");
    expect(workbook).toContain("2026-04-30T00:11:00.000Z");
  });
});
