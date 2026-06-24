import { useEffect, useRef, useState } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  baseX: number;
  baseY: number;
  life: number;
  maxLife: number;
};

type FloatingOrb = {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  opacity: number;
  color: [number, number, number];
};

const HydroBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldAnimate = !prefersReducedMotion;

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!shouldAnimate) return;

      const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();

    const particles: Particle[] = [];
    const floatingOrbs: FloatingOrb[] = [];

    // 🌊 Optimized particle count: 40 (50% reduction)
    const particleCount = 100;
    const orbCount = 6;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.5 + 0.2;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 0.5,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        baseX: Math.random() * canvas.width,
        baseY: Math.random() * canvas.height,
        life: Math.random(),
        maxLife: Math.random() * 0.5 + 0.5,
      });
    }

    // ✨ Optimized orbs (50% reduction for better performance)
    for (let i = 0; i < orbCount; i++) {
      floatingOrbs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 8 + 4,
        dx: (Math.random() - 0.5) * 0.2,
        dy: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.4 + 0.2,
        color: Math.random() > 0.5 ? [0, 255, 255] : [0, 150, 255],
      });
    }

    // Pre-render particle sprites to avoid creating gradients every frame
    const particleSpriteCache = new Map<string, CanvasImageSource>();
    
    const getOrCreateParticleSprite = (r: number, color: [number, number, number], opacity: number): CanvasImageSource => {
      const cacheKey = `${r}_${color[0]}_${color[1]}_${color[2]}_${Math.round(opacity * 10)}`;
      
      if (particleSpriteCache.has(cacheKey)) {
        return particleSpriteCache.get(cacheKey)!;
      }

      // Create offscreen canvas for particle sprite (only once per unique particle type)
      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = r * 4;
      spriteCanvas.height = r * 4;
      const spriteCtx = spriteCanvas.getContext("2d");
      
      if (spriteCtx) {
        const cx = r * 2;
        const cy = r * 2;
        const gradient = spriteCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const [r_, g_, b_] = color;
        gradient.addColorStop(0, `rgba(${r_},${g_},${b_},${opacity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(${r_},${g_},${b_},${opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${r_},${g_},${b_},0)`);

        spriteCtx.fillStyle = gradient;
        spriteCtx.beginPath();
        spriteCtx.arc(cx, cy, r, 0, Math.PI * 2);
        spriteCtx.fill();
      }

      particleSpriteCache.set(cacheKey, spriteCanvas);
      return spriteCanvas;
    };

    // Cache background gradient
    let bgGradientCached: CanvasGradient | null = null;
    const getBackgroundGradient = () => {
      if (!bgGradientCached) {
        bgGradientCached = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGradientCached.addColorStop(0, "rgba(5, 15, 30, 0)");
        bgGradientCached.addColorStop(1, "rgba(2, 8, 20, 0.3)");
      }
      return bgGradientCached;
    };

    const drawWaveLines = (time: number) => {
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = `rgba(0,200,255,${0.1 - i * 0.02})`;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const amplitude = 30 + i * 5;
        const frequency = 0.01 - i * 0.002;

        for (let x = 0; x < canvas.width; x += 10) {
          const y =
            canvas.height * 0.3 + Math.sin(x * frequency + time * 0.02) * amplitude + i * 40;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
      }
    };

    const draw = () => {
      // Use cached background gradient
      ctx.fillStyle = getBackgroundGradient();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      timeRef.current += 1;
      
      // Skip wave lines every other frame for performance
      if (timeRef.current % 2 === 0) {
        drawWaveLines(timeRef.current);
      }

      floatingOrbs.forEach((orb) => {
        orb.x += orb.dx;
        orb.y += orb.dy;
        orb.opacity += Math.sin(timeRef.current * 0.01) * 0.1;
        orb.opacity = Math.max(0.1, Math.min(0.6, orb.opacity));

        if (orb.x > canvas.width + 50) orb.x = -50;
        if (orb.x < -50) orb.x = canvas.width + 50;
        if (orb.y > canvas.height + 50) orb.y = -50;
        if (orb.y < -50) orb.y = canvas.height + 50;

        // Use cached sprite instead of drawing gradient every frame
        const sprite = getOrCreateParticleSprite(orb.r * 2, orb.color, orb.opacity * 0.5);
        ctx.drawImage(sprite, orb.x - orb.r * 2, orb.y - orb.r * 2);
        const sprite2 = getOrCreateParticleSprite(orb.r, orb.color, orb.opacity);
        ctx.drawImage(sprite2, orb.x - orb.r, orb.y - orb.r);
      });

      particles.forEach((p) => {
        p.x += p.dx + Math.sin(timeRef.current * 0.01 + p.baseX) * 0.2;
        p.y += p.dy + Math.cos(timeRef.current * 0.01 + p.baseY) * 0.2;

        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;

        const pulse = Math.sin(timeRef.current * 0.02 + p.life * Math.PI * 2) * 0.5 + 0.5;
        
        // Use cached particle sprite with adjusted opacity based on pulse
        const particleOpacity = 0.6 * pulse;
        const particleSprite = getOrCreateParticleSprite(p.r * 2, [100, 200, 255], particleOpacity);
        ctx.globalAlpha = pulse;
        ctx.drawImage(particleSprite, p.x - p.r * 2, p.y - p.r * 2);
        ctx.globalAlpha = 1;
      });

      // Skip particle linking (expensive) - only draw on desktop devices
      if (!isMobile && timeRef.current % 3 === 0) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 150) {
              ctx.strokeStyle = `rgba(0,200,255,${0.1 * (1 - distance / 150)})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Clean up sprite cache to prevent memory leaks
      particleSpriteCache.clear();
      bgGradientCached = null;
    };
  }, [shouldAnimate, isMobile]);

  return (
    <>
      {/* 🌊 REAL IMAGE BACKGROUND */}
      <div
        className="hydro-bg-image"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url('/background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: -2,
        }}
      />

      {/* 🌫️ PREMIUM GRADIENT OVERLAY */}
      <div
        className="hydro-bg-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(2,12,27,0.75) 0%, rgba(0,50,100,0.6) 50%, rgba(2,12,27,0.75) 100%)",
          zIndex: -1,
        }}
      />

      {/* 🌊 ANIMATED ELEMENTS LAYER */}
      <div
        className="hydro-bg-radial"
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(circle at 30% 50%, rgba(0,100,150,0.1), transparent 50%)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />

      {/* ✨ ENHANCED PARTICLE ANIMATION */}
      {shouldAnimate && (
        <canvas
          className="hydro-bg-canvas"
          ref={canvasRef}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            filter: "brightness(1.1)",
          }}
        />
      )}
    </>
  );
};

export default HydroBackground;