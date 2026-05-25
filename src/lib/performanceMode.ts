import { useEffect, useState } from "react";

const isClient = () => typeof window !== "undefined";

export const getPerformanceMode = () => {
  if (!isClient()) return false;

  const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory <= 3;
  const hasLowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const saveData = (navigator as any).connection?.saveData;

  return Boolean(hasLowMemory || hasLowCPU || saveData);
};

export const usePerformanceMode = () => {
  const [performanceMode, setPerformanceMode] = useState(false);

  useEffect(() => {
    if (!isClient()) return;

    const updateMode = () => setPerformanceMode(getPerformanceMode());
    updateMode();

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateMode);
    } else {
      mediaQuery.addListener(updateMode as any);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", updateMode);
      } else {
        mediaQuery.removeListener(updateMode as any);
      }
    };
  }, []);

  return performanceMode;
};
