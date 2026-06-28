import React from 'react';
import HeroBackground from './HeroBackground';
import HydroBackground from './HydroBg_area';
import { useTheme } from '@/contexts/ThemeContext';

export default function SharedAnimatedBackground() {
  const { theme } = useTheme();

  // Light mode: keep existing static gradient element (`app-scene-bg`)
  // Dark mode: reuse the exact HeroBackground component
  if (theme === 'light') {
    return <div className="app-scene-bg" aria-hidden />;
  }

  return <HydroBackground />;

}
