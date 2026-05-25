import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Text Reveal Animation - reveals text letter by letter
 * Usage: Apply to heading elements for premium feel
 */
export const useTextReveal = () => {
  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.03,
          delayChildren: 0.1,
        },
      },
    },
    letter: {
      hidden: { 
        opacity: 0, 
        y: 20,
        clipPath: "inset(0 100% 0 0)"
      },
      visible: {
        opacity: 1,
        y: 0,
        clipPath: "inset(0 0 0 0)",
        transition: {
          duration: 0.5,
        },
      },
    },
  };
};

/**
 * Parallax Scroll Effect - items scroll at different speeds
 * Usage: useParallaxScroll(ref, speed) on container
 */
export const useParallaxScroll = (ref: React.RefObject<HTMLDivElement>, speed = 0.5) => {
  useEffect(() => {
    if (!ref.current) return;

    const handleScroll = () => {
      const element = ref.current;
      if (!element) return;

      const scrollY = window.scrollY;
      const rect = element.getBoundingClientRect();
      const offset = rect.top + scrollY;
      const parallaxOffset = (scrollY - offset) * speed;

      element.style.transform = `translateY(${parallaxOffset}px)`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [ref, speed]);
};

/**
 * Parallax Scroll Animation - for Framer Motion
 * Usage: Pass to motion.div with whileInView
 */
export const getParallaxVariants = (speed = 0.5) => ({
  hidden: { y: 60, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
    },
  },
});

/**
 * Stagger Container - for animating multiple children
 * Usage: Apply to parent, children get staggered animation
 */
export const getStaggerContainerVariants = (staggerChildren = 0.1, delayChildren = 0.2) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

/**
 * Fade & Slide Up - simple entrance animation
 * Usage: Apply to elements on scroll
 */
export const getFadeSlideUpVariants = () => ({
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
});

/**
 * 3D Card Hover Effect
 * Usage: Wrap card in motion.div with this configuration
 */
export type TiltIntensity = 'none' | 'small' | 'normal' | 'hero';

export const get3DCardVariants = (intensity: TiltIntensity = 'normal'): any => {
  // intensity presets
  const presets: Record<TiltIntensity, { rotateX: number; rotateY: number; scale: number; stiffness: number; damping: number; duration: number }> = {
    none: { rotateX: 0, rotateY: 0, scale: 1, stiffness: 300, damping: 30, duration: 0.12 },
    small: { rotateX: -5, rotateY: 5, scale: 1.03, stiffness: 180, damping: 20, duration: 0.26 },
    normal: { rotateX: -5, rotateY: 5, scale: 1.06, stiffness: 220, damping: 18, duration: 0.28 },
    hero: { rotateX: -5, rotateY: 5, scale: 1.08, stiffness: 260, damping: 16, duration: 0.22 },
  };

  const p = presets[intensity];
  return {
    initial: {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
    },
    hover: {
      rotateX: p.rotateX,
      rotateY: p.rotateY,
      scale: p.scale,
      transition: {
        duration: p.duration,
        type: 'spring' as const,
        stiffness: p.stiffness,
        damping: p.damping,
      },
    },
  };
};

export const getHeroCardVariants = () => get3DCardVariants('hero');
export const getSmallCardVariants = () => get3DCardVariants('small');

/**
 * Glow Pulse Animation - for status badges
 * Usage: Apply as animation property in Tailwind
 */
export const getPulseGlowVariants = () => ({
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(0, 180, 200, 0.7)",
      "0 0 0 8px rgba(0, 180, 200, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
});

/**
 * Number Counter Animation - counts from 0 to final value
 * Usage: Apply to metric display elements
 */
export const getCounterVariants = (finalValue: number) => {
  const frames = [];
  for (let i = 0; i <= finalValue; i += Math.ceil(finalValue / 30)) {
    frames.push(i);
  }
  frames.push(finalValue);

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.5,
        ease: "easeOut",
      },
    },
  };
};

/**
 * Scroll-triggered reveal
 * Usage: Pass to motion.div with whileInView
 */
export const getScrollRevealVariants = () => ({
  hidden: { 
    opacity: 0, 
    y: 40,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
    },
  },
});

/**
 * Tooltip/Popover animation
 * Usage: Animate modal or tooltip entrance
 */
export const getTooltipVariants = () => ({
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.15,
    },
  },
});

/**
 * Shimmer Loading Animation
 * Usage: Apply as animation class to skeleton elements
 */
export const getShimmerVariants = () => ({
  animate: {
    backgroundPosition: ["200% 0%", "-200% 0%"],
    transition: {
      duration: 3,
      repeat: Infinity,
    },
  },
});

/**
 * Hook: respects user/system reduced-motion preference
 * Returns true when user prefers reduced motion
 */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update as any);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update as any);
    };
  }, []);

  return reduced;
};
