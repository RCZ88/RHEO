import { useRef, useEffect, useMemo } from 'react'
import { sample, aggregateBias } from './physics/noiseField'

/**
 * NeuralFlow — ambient background for the Self page.
 * 
 * Flow-field streamlines (Headway mechanic) in muted violet/cyan.
 * Runs on a 2D canvas, no dependencies beyond React.
 * Uses requestAnimationFrame, pauses on document.hidden.
 */
export function NeuralFlow({ opacity = 0.5, dataPoints = [], respectReducedMotion = true }: {
  opacity?: number;
  /** Settled graph nodes. The field is biased toward them so the ambient layer
      is about the brain data instead of independent decoration (spec §4.4). */
  dataPoints?: Array<{ x?: number; y?: number; strength?: number }>;
  /** When false, render one static sampled frame instead of animating. */
  respectReducedMotion?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let W = 0, H = 0

    function resize() {
      W = container.clientWidth
      H = container.clientHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Bias the field toward where the graph actually is. Degree drives
    // strength, so dense regions pull the flow harder (spec §3 data flow).
    const biasPts = dataPoints
      .filter(n => typeof n.x === 'number' && typeof n.y === 'number')
      .map(n => ({ x: n.x as number, y: n.y as number, strength: n.strength ?? 0.2 }));

    const pts: Array<{ x: number; y: number; vx: number; vy: number; hue: number }> = []
    const NUM_PTS = 340
    const SEED = 42
    let rng = SEED
    function rand() { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646 }

    for (let i = 0; i < NUM_PTS; i++) {
      pts.push({
        x: rand() * W,
        y: rand() * H,
        vx: (rand() - 0.5) * 0.3,
        vy: (rand() - 0.5) * 0.3,
        hue: 250 + rand() * 30, // violet range
      })
    }

    let t = 0
    let raf: number

    function draw() {
      ctx.clearRect(0, 0, W, H)

      for (const p of pts) {
        // Field: divergence-free curl noise from noiseField.ts. This REPLACES
        // the old ad-hoc sin/cos swirl, which was not a flow field at all.
        const [fx, fy] = sample(p.x * 0.0022, p.y * 0.0022, t * 0.00016)
        const bias = biasPts.length ? aggregateBias(p.x, p.y, biasPts, 160) : 0
        const mag = 0.6 + bias * 1.6

        p.vx += fx * mag * 0.02
        p.vy += fy * mag * 0.02
        // Damping
        p.vx *= 0.98
        p.vy *= 0.98
        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.2) { p.vx = (p.vx / speed) * 1.2; p.vy = (p.vy / speed) * 1.2 }

        p.x += p.vx
        p.y += p.vy

        // Wrap around with soft edge
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        if (p.y < -10) p.y = H + 10
        if (p.y > H + 10) p.y = -10

        const nx = p.x + p.vx * 26
        const ny = p.y + p.vy * 8

        const alpha = (0.16 + 0.10 * Math.sin(t * 0.0008 + p.x * 0.008 + p.y * 0.006)) * opacity

        ctx.strokeStyle = `hsla(${p.hue}, 45%, 55%, ${alpha})`
        ctx.lineWidth = 1.15
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
      }

      t += 1
      if (respectReducedMotion) raf = requestAnimationFrame(draw)
    }
    if (!respectReducedMotion) draw()
    else raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [opacity, dataPoints, respectReducedMotion])

  return (
    <div ref={containerRef} className="w-full h-full pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  )
}
