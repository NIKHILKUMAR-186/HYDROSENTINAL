import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  monitorWaterReadings,
  getDeviceAlerts,
  evaluateAlertLevel,
  WaterReading,
  AlertLevel,
  WaterAlert,
  shouldSendAlert,
  storeAlert,
} from "@/services/alertService";
import { RateLimitError, sendAlertSMS, sendDemoAlert } from "@/services/smsService";

interface UseWaterAlertsResult {
  currentReading: WaterReading | null;
  currentLevel: AlertLevel | null;
  recentAlerts: WaterAlert[];
  isLoading: boolean;
  alertIcon: string;
  alertColor: string;
}

export const useWaterAlerts = (
  deviceId: string,
  userId: string,
  userPhone?: string
): UseWaterAlertsResult => {
  const [currentReading, setCurrentReading] = useState<WaterReading | null>(null);
  const [currentLevel, setCurrentLevel] = useState<AlertLevel | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<WaterAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!deviceId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Subscribe to real-time readings
    const unsubscribeReadings = monitorWaterReadings(
      deviceId,
      userId,
      async (reading: WaterReading, level: AlertLevel | null) => {
        setCurrentReading(reading);
        setCurrentLevel(level);
        setIsLoading(false);

        // Send SMS alert if applicable
        if (level && userPhone) {
          const canSend = await shouldSendAlert(deviceId, userId);
          if (canSend) {
            // Try to send SMS via Twilio
            let smsSent = false;
            try {
              smsSent = await sendAlertSMS(
                userPhone,
                `Device ${deviceId}`,
                reading,
                level
              );
            } catch (error) {
              if (error instanceof RateLimitError) {
                toast.error(error.message);
              }

              // Fallback to demo alert
              smsSent = await sendDemoAlert(
                userPhone,
                `Device ${deviceId}`,
                reading,
                level
              );
            }

            // Store alert with SMS status
            await storeAlert(deviceId, userId, reading, level, smsSent);
          }
        }
      },
      () => {
        // No readings yet; let the panel render its empty-state instead of staying on skeletons.
        setIsLoading(false);
      },
    );

    // Subscribe to recent alerts
    const unsubscribeAlerts = getDeviceAlerts(deviceId, (alerts) => {
      setRecentAlerts(alerts);
      // Alert history should render even before a live reading arrives.
      setIsLoading(false);
    });

    // Fallback: if the listeners are ready but nothing has emitted yet, don't trap the UI in loading.
    const loadingFallback = window.setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubscribeReadings();
      unsubscribeAlerts();
      window.clearTimeout(loadingFallback);
    };
  }, [deviceId, userId, userPhone]);

  // Get icon and color based on current alert level
  const alertIcon =
    currentLevel === AlertLevel.DANGER
      ? "🔴"
      : currentLevel === AlertLevel.WARNING
      ? "🟡"
      : "🟢";

  const alertColor =
    currentLevel === AlertLevel.DANGER
      ? "text-red-600 dark:text-red-400"
      : currentLevel === AlertLevel.WARNING
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return {
    currentReading,
    currentLevel,
    recentAlerts,
    isLoading,
    alertIcon,
    alertColor,
  };
};
