/**
 * markerRenderer.ts - Custom marker styling and animation utilities
 * Creates SVG markers with status colors and glow effects
 */

import type { MapMarkerStatus } from "./mapService";
import { getMarkerColor, getMarkerGlowColor } from "./mapService";

export interface MarkerStyle {
  color: string;
  glowColor: string;
  size: number;
  glowSize: number;
  pulse: boolean;
  icon: string;
}

export const getMarkerStyle = (status: MapMarkerStatus): MarkerStyle => {
  const baseSize = {
    healthy: 32,
    warning: 40,
    critical: 48,
    offline: 28,
    simulator: 36,
  };
  
  return {
    color: getMarkerColor(status),
    glowColor: getMarkerGlowColor(status),
    size: baseSize[status],
    glowSize: baseSize[status] * 1.5,
    pulse: status === "critical" || status === "warning",
    icon: getStatusIcon(status),
  };
};

export const getStatusIcon = (status: MapMarkerStatus): string => {
  const icons: Record<MapMarkerStatus, string> = {
    healthy: "✓",
    warning: "!",
    critical: "✕",
    offline: "○",
    simulator: "S",
  };
  return icons[status];
};

/**
 * Create SVG marker element for Leaflet/Mapbox
 */
export const createSvgMarker = (
  status: MapMarkerStatus,
  label?: string,
): HTMLElement => {
  const style = getMarkerStyle(status);
  
  const container = document.createElement("div");
  container.className = "relative";
  
  // Create glow effect
  const glow = document.createElement("div");
  glow.style.cssText = `
    position: absolute;
    width: ${style.glowSize}px;
    height: ${style.glowSize}px;
    left: -${style.glowSize / 2}px;
    top: -${style.glowSize / 2}px;
    border-radius: 50%;
    background: ${style.glowColor};
    box-shadow: 0 0 20px ${style.glowColor};
    ${style.pulse ? "animation: pulse 2s infinite;" : ""}
  `;
  
  // Create marker circle
  const marker = document.createElement("div");
  marker.style.cssText = `
    position: relative;
    width: ${style.size}px;
    height: ${style.size}px;
    border-radius: 50%;
    background: ${style.color};
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  
  // Add icon or label
  if (label) {
    marker.textContent = label.substring(0, 1).toUpperCase();
  } else {
    marker.textContent = style.icon;
  }
  
  container.appendChild(glow);
  container.appendChild(marker);
  
  return container;
};

/**
 * Create cluster marker SVG
 */
export const createClusterMarker = (
  count: number,
  status: "healthy" | "warning" | "critical" | "mixed" | "offline",
): HTMLElement => {
  const statusColors: Record<string, string> = {
    healthy: "#10b981",
    warning: "#f59e0b",
    critical: "#ef4444",
    offline: "#9ca3af",
    mixed: "#8b5cf6",
  };
  
  const color = statusColors[status] || "#64748b";
  const size = Math.min(50, 30 + count * 2);
  
  const container = document.createElement("div");
  container.className = "relative";
  
  const marker = document.createElement("div");
  marker.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: ${Math.min(20, 10 + count / 3)}px;
    cursor: pointer;
  `;
  
  marker.textContent = String(Math.min(count, 99)) + (count > 99 ? "+" : "");
  
  container.appendChild(marker);
  return container;
};

/**
 * Animate marker position change (for smooth transitions)
 */
export const animateMarkerMovement = (
  element: HTMLElement,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  duration: number = 1000,
) => {
  const startTime = performance.now();
  const startLat = fromLat;
  const startLng = fromLng;
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-in-out)
    const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    
    const currentLat = startLat + (toLat - startLat) * easeProgress;
    const currentLng = startLng + (toLng - startLng) * easeProgress;
    
    // Update element position (this would be handled by map library)
    element.setAttribute("data-lat", String(currentLat));
    element.setAttribute("data-lng", String(currentLng));
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};

/**
 * Create CSS animation for pulsing effect
 */
export const injectPulseAnimation = () => {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 currentColor;
      }
      50% {
        box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
      }
    }
    
    @keyframes glow-pulse {
      0%, 100% {
        opacity: 0.8;
      }
      50% {
        opacity: 1;
      }
    }
  `;
  
  if (!document.querySelector("style[data-marker-animation]")) {
    style.setAttribute("data-marker-animation", "true");
    document.head.appendChild(style);
  }
};
