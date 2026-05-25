import React, { useEffect, useRef, useState } from 'react';

/*
  Cinematic premium water-themed hero background.
  - Lightweight canvas particle system for AI data flow and glow.
  - Layered SVG + CSS gradients for smooth liquid waves and caustics.
  - Floating transparent droplets (DOM) for parallax interaction.
  - Glass HUD rings and subtle volumetric bloom.
  - Scroll-linked 3D parallax for depth.
  - Reduced-motion accessibility support.

  Designed specifically for light-mode, subtle, premium SaaS aesthetic.
  Hackathon-winning cinematic quality.
*/

export function HeroBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const mouseLerp = useRef({ x: 0, y: 0 });
  const scrollY = useRef(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced-motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(DPR, DPR);

    // Particles (AI data flow / sensor dots) — tuned for premium visual density
    const PARTICLE_COUNT = prefersReducedMotion
      ? Math.max(15, Math.floor((w * h) / 200000))
      : Math.max(50, Math.floor((w * h) / 65000));
    const particles: Array<any> = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.05 - Math.random() * 0.25,
        hue: 175 + Math.random() * 35,
        alpha: 0.15 + Math.random() * 0.6,
        t: Math.random() * Math.PI * 2,
      });
    }

    // Track scroll position for parallax depth
    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const DPR = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function step() {
      // smooth pointer lerp
      mouseLerp.current.x += (pointer.current.x - mouseLerp.current.x) * 0.08;
      mouseLerp.current.y += (pointer.current.y - mouseLerp.current.y) * 0.08;

      ctx.clearRect(0, 0, w, h);

      // Enhanced caustic overlay with scroll-linked depth parallax
      const scrollDepthFactor = Math.min(1, scrollY.current / (h * 0.5));
      const causticIntensity = prefersReducedMotion ? 0.008 : 0.014;
      
      for (let i = 0; i < 3; i++) {
        const depthLayerShift = (i + 1) * scrollDepthFactor * 15;
        const gx = w * (0.35 + i * 0.2) + (mouseLerp.current.x - w / 2) * 0.02 * (i + 1) + depthLayerShift;
        const gy = h * (0.45 + i * 0.08) + (mouseLerp.current.y - h / 2) * 0.02 * (i + 1);
        const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6);
        grd.addColorStop(0, `rgba(220,255,255,${causticIntensity * (i + 1)})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      // particles with scroll-linked depth layering
      particles.forEach((p, i) => {
        const animSpeed = prefersReducedMotion ? 0.002 : 0.008;
        p.t += animSpeed + Math.abs(p.vx) * 0.01;
        p.x += p.vx + Math.sin(p.t) * 0.12 + (mouseLerp.current.x - w / 2) * 0.00008 + (scrollDepthFactor * 8) * (0.15 - (i % 3) * 0.05);
        p.y += p.vy + Math.cos(p.t * 0.6) * 0.06 + (mouseLerp.current.y - h / 2) * 0.00012;

        if (p.y < -20 || p.x < -40 || p.x > w + 40) {
          p.x = Math.random() * w;
          p.y = h + 20 + Math.random() * 60;
        }

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 12);
        glow.addColorStop(0, `hsla(${p.hue}, 90%, 68%, ${p.alpha * 0.95})`);
        glow.addColorStop(0.35, `hsla(${p.hue}, 85%, 62%, ${p.alpha * 0.52})`);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    window.addEventListener('resize', resize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
    };
    const onTouch = (e: TouchEvent) => {
      if (prefersReducedMotion) return;
      pointer.current.x = e.touches[0]?.clientX || pointer.current.x;
      pointer.current.y = e.touches[0]?.clientY || pointer.current.y;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch as any);
    };
  }, [prefersReducedMotion]);

  // Floating droplets DOM elements for foreground parallax
  const droplets = Array.from({ length: prefersReducedMotion ? 0 : 7 }).map((_, i) => (
    <div
      key={i}
      className="absolute pointer-events-none rounded-full"
      style={{
        width: `${28 + i * 12}px`,
        height: `${28 + i * 12}px`,
        left: `${10 + i * 12}%`,
        top: `${12 + (i * 9) % 36}%`,
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), rgba(175,245,255,0.12))',
        transform: `translate3d(0,0,0)`,
        opacity: 0.85 - i * 0.08,
        filter: 'blur(8px) drop-shadow(0 12px 28px rgba(110,230,255,0.06))',
        mixBlendMode: 'screen',
        backdropFilter: 'blur(6px) saturate(120%)',
        WebkitBackdropFilter: 'blur(6px) saturate(120%)',
      }}
    />
  ));

  return (
    <div
      className={`absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {/* Canvas for particles, soft caustics, and volumetric light */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Soft liquid gradient wave layer (SVG) with scroll parallax */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        preserveAspectRatio="none" 
        viewBox="0 0 1440 800" 
        style={{ 
          opacity: prefersReducedMotion ? 0.92 : 0.96,
          transform: `translateY(${scrollY.current * 0.03}px)`,
        }}
      >
        <defs>
          <linearGradient id="lgA" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fafffe" stopOpacity="1" />
            <stop offset="45%" stopColor="#e6faff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#e8fdfc" stopOpacity="0.95" />
          </linearGradient>
          <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="30" result="b" />
            <feBlend in="SourceGraphic" in2="b" mode="screen" />
          </filter>
        </defs>

        {/* Layered liquid shapes */}
        <g filter="url(#softBlur)" style={{ mixBlendMode: 'screen' }}>
          <path d="M0,320 C240,200 480,440 720,370 C960,300 1200,420 1440,360 L1440,800 L0,800 Z" fill="url(#lgA)" opacity={prefersReducedMotion ? "0.85" : "0.92"} />
          <path d="M0,380 C260,300 520,460 780,380 C1040,300 1300,460 1440,420 L1440,800 L0,800 Z" fill="#e6fffb" opacity={prefersReducedMotion ? "0.45" : "0.58"} />
        </g>
      </svg>

      {/* Glass HUD rings with scroll-linked scaling */}
      <svg 
        className="absolute left-1/2 top-40 -translate-x-1/2 pointer-events-none" 
        viewBox="0 0 780 780" 
        fill="none"
        style={{
          width: prefersReducedMotion ? '600px' : '780px',
          height: prefersReducedMotion ? '600px' : '780px',
          opacity: prefersReducedMotion ? 0.5 : 0.75,
          transform: `translate3d(-50%, ${scrollY.current * -0.02}px, 0) scale(${1 + scrollY.current * 0.0002})`,
          willChange: 'transform',
        }}
      >
        <defs>
          <radialGradient id="r1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dffcff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#dffcff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#dffcff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="390" cy="390" r="260" stroke="rgba(200,255,250,0.16)" strokeWidth="2" />
        <circle cx="390" cy="390" r="180" stroke="rgba(160,235,220,0.12)" strokeWidth="1.5" />
        <circle cx="390" cy="390" r="100" stroke="rgba(120,220,200,0.09)" strokeWidth="1" />
        <circle cx="390" cy="390" r="40" fill="url(#r1)" />
      </svg>

      {/* Foreground droplets (DOM) */}
      <div className="absolute inset-0 pointer-events-none">
        {droplets}

        {/* subtle glass reflection strip */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl"
          style={{
            width: '68%',
            height: '46%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 20px 80px rgba(120,200,220,0.06)',
            backdropFilter: 'blur(8px) saturate(120%)',
            WebkitBackdropFilter: 'blur(8px) saturate(120%)',
            mixBlendMode: 'screen',
            opacity: 0.95,
          }}
        />
      </div>
    </div>
  );
}

export default HeroBackground;
