// ============================================================
// DeskFlow Dashboard — MomentumOrb (Signature Element)
// Skill: Signature Design — concept-true hero, canvas-based
// Metaphor: Fire/energy orb that breathes with user momentum
// Sources: Aceternity-style glow + ReactBits particle patterns
// ============================================================

import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface MomentumOrbProps {
  momentum: number; // 0-100
  streak: number;
  size?: number;
}

export function MomentumOrb({ momentum, streak, size = 120 }: MomentumOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  const getOrbColor = useCallback((m: number) => {
    // Low momentum = cool blue/cyan
    // Mid momentum = warm amber
    // High momentum = fiery rose/orange
    if (m < 30) return { h: 200 + m * 0.5, s: 70, l: 55 };
    if (m < 60) return { h: 35 + (m - 30) * 1.5, s: 80, l: 55 };
    return { h: 15 + (m - 60) * 0.5, s: 85, l: 55 + (m - 60) * 0.1 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const spawnParticle = (cx: number, cy: number, radius: number, hue: number) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.8;
      particlesRef.current.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 1.2 - 0.3,
        life: 1,
        maxLife: 40 + Math.random() * 40,
        size: 1 + Math.random() * 2.5,
        hue: hue + (Math.random() - 0.5) * 30,
      });
    };

    const animate = () => {
      timeRef.current += 1;
      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.35;
      const color = getOrbColor(momentum);
      const breatheSpeed = prefersReducedMotion ? 0 : 0.03 + (momentum / 100) * 0.04;
      const breathe = Math.sin(timeRef.current * breatheSpeed) * 4;
      const radius = baseRadius + breathe;

      ctx.clearRect(0, 0, size, size);

      // Outer glow layers (optimized: only 3 layers)
      for (let i = 3; i >= 1; i--) {
        const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * (1 + i * 0.6));
        const alpha = (0.08 / i) * (momentum / 100 + 0.3);
        glow.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`);
        glow.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);
      }

      // Core orb
      const coreGrad = ctx.createRadialGradient(cx, cy - radius * 0.15, 0, cx, cy, radius);
      coreGrad.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${Math.min(75, color.l + 15)}%, 0.9)`);
      coreGrad.addColorStop(0.6, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.7)`);
      coreGrad.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l - 10}%, 0.2)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      const highlight = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.3, 0, cx, cy, radius * 0.6);
      highlight.addColorStop(0, `hsla(${color.h}, 40%, 90%, 0.25)`);
      highlight.addColorStop(1, `hsla(${color.h}, 40%, 90%, 0)`);
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Spawn particles based on momentum
      if (!prefersReducedMotion && momentum > 10) {
        const spawnRate = Math.floor((momentum / 100) * 2) + (streak > 0 ? 1 : 0);
        for (let i = 0; i < spawnRate; i++) {
          if (Math.random() < 0.3) spawnParticle(cx, cy, radius, color.h);
        }
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.01; // slight upward drift
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) return false;

        const alpha = p.life * 0.6;
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [momentum, streak, size, getOrbColor]);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="rounded-full"
        aria-hidden="true"
      />
      {/* Screen-reader accessible label */}
      <span className="sr-only">
        Momentum score: {momentum} percent. Current streak: {streak} days.
      </span>
    </motion.div>
  );
}
