export const isMobileDevice = (): boolean => {
  // Mobile detection disabled — treat as desktop by default
  return false;
};

export const getConnectionSpeed = (): '2g' | '3g' | '4g' | 'unknown' => {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!connection) return 'unknown';
  return connection.effectiveType || 'unknown';
};

export const isSlowConnection = (): boolean => {
  const speed = getConnectionSpeed();
  return speed === '2g' || speed === '3g';
};

export const getDeviceMemory = (): number => {
  return (navigator as any).deviceMemory || 4;
};

export const getCPUCores = (): number => {
  return navigator.hardwareConcurrency || 4;
};

export const shouldDisableAnimations = (): boolean => {
  // Only respect the user's reduced-motion preference here.
  // Do NOT disable animations based on hardware heuristics — animations should remain available and be scaled responsively.
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !!prefersReduced;
};

export const getPerformanceProfile = () => {
  const cores = getCPUCores();
  const memory = getDeviceMemory();
  const connection = getConnectionSpeed();
  return {
    isMobile: false,
    cores,
    memory,
    connection,
    canUseAnimations: !shouldDisableAnimations(),
    canUseHeavyGraphics: cores > 4 && memory > 4,
    canUse3D: cores > 4,
    shouldLazyLoadImages: isSlowConnection(),
    shouldReduceQuality: memory <= 2 || isSlowConnection(),
  };
};

// Auto-detect and apply performance optimizations
export const initializePerformanceOptimizations = () => {
  const profile = getPerformanceProfile();

  if (!profile.canUseAnimations) {
    document.documentElement.style.setProperty('--reduce-motion', '1');
  }

  if (profile.shouldReduceQuality) {
    document.documentElement.classList.add('low-bandwidth');
  }

  return profile;
};

// Monitor performance metrics
export const monitorPerformance = () => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`[Performance] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      });

      observer.observe({ entryTypes: ['measure', 'navigation'] });
      return observer;
    } catch (e) {
      console.log('[Performance] PerformanceObserver not available');
    }
  }
};
