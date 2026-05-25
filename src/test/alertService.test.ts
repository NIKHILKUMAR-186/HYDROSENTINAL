import { describe, expect, it } from "vitest";
import { AlertLevel, normalizeWaterAlert } from "@/services/alertService";

describe("alert normalization", () => {
  it("normalizes frontend WaterAlert-shaped records", () => {
    const alert = normalizeWaterAlert(
      {
        id: "alert-1",
        deviceId: "device-1",
        userId: "user-1",
        level: AlertLevel.DANGER,
        message: "High TDS detected",
        readings: {
          ph: 7.2,
          tds: 980,
          turbidity: 12,
        },
        timestamp: 1710000000000,
        sentSMS: true,
        createdAt: "2026-05-01T08:00:00.000Z",
      },
      "fallback",
    );

    expect(alert?.id).toBe("alert-1");
    expect(alert?.level).toBe(AlertLevel.DANGER);
    expect(alert?.timestamp).toBe(1710000000000);
    expect(alert?.createdAt).toBe("2026-05-01T08:00:00.000Z");
    expect(alert?.sentSMS).toBe(true);
  });

  it("normalizes legacy backend anomaly alerts", () => {
    const legacyAlert = {
        deviceId: "device-2",
        userId: "user-2",
        severity: "critical",
        reason: "TDS too high (1200)",
        timestamp: "2026-05-01T10:15:00.000Z",
        createdAt: "2026-05-01T10:15:00.000Z",
        readings: {
          ph: 6.3,
          turbidity: 18,
        },
      } as any;

    const alert = normalizeWaterAlert(legacyAlert, "device-2-1714568100000");

    expect(alert?.id).toBe("device-2-1714568100000");
    expect(alert?.level).toBe(AlertLevel.DANGER);
    expect(alert?.message).toBe("TDS too high (1200)");
    expect(alert?.timestamp).toBeGreaterThan(0);
    expect(alert?.createdAt).toBe("2026-05-01T10:15:00.000Z");
    expect(alert?.readings.ph).toBe(6.3);
  });
});
