import { useEffect, useRef, useState } from "react";
import { usePerformanceMode } from "@/lib/performanceMode";
import { usePrefersReducedMotion } from "@/hooks/useAnimationUtils";

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
  const fpsRef = useRef({ frameCount: 0, lastTime: Date.now(), fps: 60 });
  const performanceMode = usePerformanceMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Adaptive animation: disable on mobile or low-end devices
  const shouldAnimate = !performanceMode && !prefersReducedMotion && !isMobile;

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
    const particleCount = 40;
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

    const drawGradientCircle = (
      x: number,
      y: number,
      r: number,
      color: [number, number, number],
      opacity: number,
    ) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      const [r_, g_, b_] = color;
      gradient.addColorStop(0, `rgba(${r_},${g_},${b_},${opacity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(${r_},${g_},${b_},${opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(${r_},${g_},${b_},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
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
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, "rgba(5, 15, 30, 0)");
      bgGradient.addColorStop(1, "rgba(2, 8, 20, 0.3)");
      ctx.fillStyle = bgGradient;
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

        drawGradientCircle(orb.x, orb.y, orb.r * 2, orb.color, orb.opacity * 0.5);
        drawGradientCircle(orb.x, orb.y, orb.r, orb.color, orb.opacity);
      });

      particles.forEach((p) => {
        p.x += p.dx + Math.sin(timeRef.current * 0.01 + p.baseX) * 0.2;
        p.y += p.dy + Math.cos(timeRef.current * 0.01 + p.baseY) * 0.2;

        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;

        const pulse = Math.sin(timeRef.current * 0.02 + p.life * Math.PI * 2) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

        const particleGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
        particleGradient.addColorStop(0, `rgba(100,200,255,${0.6 * pulse})`);
        particleGradient.addColorStop(1, `rgba(0,150,255,${0.2 * pulse})`);
        ctx.fillStyle = particleGradient;
        ctx.fill();

        ctx.strokeStyle = `rgba(0,255,255,${0.3 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();
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