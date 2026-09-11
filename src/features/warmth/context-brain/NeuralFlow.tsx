import { useRef, useEffect } from 'react'

/**
 * NeuralFlow — ambient background for the Self page.
 * 
 * Flow-field streamlines (Headway mechanic) in muted violet/cyan.
 * Runs on a 2D canvas, no dependencies beyond React.
 * Uses requestAnimationFrame, pauses on document.hidden.
 */
export function NeuralFlow({ opacity = 0.5 }: { opacity?: number }) {
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

    const pts: Array<{ x: number; y: number; vx: number; vy: number; hue: number }> = []
    const NUM_PTS = 120
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
        // Field: swirling flow derived from position
        const angle = Math.sin(p.y * 0.005 + t * 0.0004) * 0.8
          + Math.cos(p.x * 0.004 - t * 0.0003) * 0.8
          + Math.sin((p.x + p.y) * 0.002 + t * 0.0002) * 0.4
        const mag = 0.6

        p.vx += Math.cos(angle) * mag * 0.02
        p.vy += Math.sin(angle) * mag * 0.02
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

        const nx = p.x + p.vx * 8
        const ny = p.y + p.vy * 8

        const alpha = (0.04 + 0.03 * Math.sin(t * 0.0008 + p.x * 0.008 + p.y * 0.006)) * opacity

        ctx.strokeStyle = `hsla(${p.hue}, 45%, 55%, ${alpha})`
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
      }

      t += 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [opacity])

  return (
    <div ref={containerRef} className="w-full h-full pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  )
}
