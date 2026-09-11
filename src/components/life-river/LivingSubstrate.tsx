"use client"

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import simFragment from '../../shaders/rd-simulation.glsl?raw'
import displayFragment from '../../shaders/rd-display.glsl?raw'
import { RD_PRESETS, type Organism } from '../../lib/rd-presets'

console.log('%c[LivingSubstrate] v3.0 loaded — organisms + morphing', 'color: #fbbf24; font-weight: bold')

const SIM_VERTEX = /* glsl */ `
varying vec2 v_uvs[9];
uniform vec2 resolution;
void main() {
  vec2 uv = position.xy * 0.5 + 0.5;
  vec2 t = 1.0 / resolution;
  v_uvs[0] = uv;                                   // center
  v_uvs[1] = uv + vec2(0.0, -t.y);                 // top
  v_uvs[2] = uv + vec2(t.x, 0.0);                  // right
  v_uvs[3] = uv + vec2(0.0, t.y);                  // bottom
  v_uvs[4] = uv + vec2(-t.x, 0.0);                 // left
  v_uvs[5] = uv + vec2(t.x, -t.y);                 // top-right
  v_uvs[6] = uv + vec2(t.x, t.y);                  // bottom-right
  v_uvs[7] = uv + vec2(-t.x, t.y);                 // bottom-left
  v_uvs[8] = uv + vec2(-t.x, -t.y);                // top-left
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const DISPLAY_VERTEX = /* glsl */ `
varying vec2 v_uv;
void main() {
  v_uv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function createSeedTexture(size: number): THREE.DataTexture {
  const data = new Float32Array(size * size * 4)

  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = 1.0 // A
    data[i * 4 + 1] = 0.0 // B
    data[i * 4 + 2] = 0.0
    data[i * 4 + 3] = 1.0
  }

  const seeds = 28
  for (let s = 0; s < seeds; s++) {
    const cx = Math.random() * size
    const cy = Math.random() * size
    const r = 3 + Math.random() * 9
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(size - 1, Math.ceil(cy + r + 1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(size - 1, Math.ceil(cx + r + 1)); x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d <= r) {
          const idx = (y * size + x) * 4
          data[idx + 1] = Math.min(1, data[idx + 1] + (1 - d / r) * 0.9)
        }
      }
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

class SubstrateErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[LivingSubstrate] WebGL unavailable — falling back to CSS glow:', error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// Parse hex color to [r,g,b] in [0,1]
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return [r, g, b]
}

interface SubstrateSceneProps {
  accent: string
  organism: Organism
  bufferSize: number
  simPasses: number
  maxAlpha: number
}

function SubstrateScene({ accent, organism, bufferSize, simPasses, maxAlpha }: SubstrateSceneProps) {
  const gl = useThree(s => s.gl)
  const viewport = useThree(s => s.viewport)
  const accentRgb = useMemo(() => hexToRgb(accent), [accent])
  const targetRef = useRef(RD_PRESETS[organism])
  const prevTime = useRef(0)

  // Update target organism when prop changes (collapse-safe morph)
  useEffect(() => {
    targetRef.current = RD_PRESETS[organism]
  }, [organism])

  const { simMaterial, displayMaterial, seedTexture, rtA, rtB, simScene, simMesh, simCamera } = useMemo(() => {
    const init = RD_PRESETS[organism]
    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        previousIterationTexture: { value: null as THREE.Texture | null },
        f: { value: init.f },
        k: { value: init.k },
        dA: { value: 1.0 },
        dB: { value: 0.5 },
        timestep: { value: 1.0 },
        flowSpeed: { value: 0.0015 },
        resolution: { value: new THREE.Vector2(bufferSize, bufferSize) },
      },
      vertexShader: SIM_VERTEX,
      fragmentShader: simFragment,
      depthTest: false,
      depthWrite: false,
    })
    const displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        textureToDisplay: { value: null as THREE.Texture | null },
        accentColor: { value: new THREE.Vector3(0.96, 0.62, 0.04) }, // default amber
        maxAlpha: { value: maxAlpha },
      },
      vertexShader: DISPLAY_VERTEX,
      fragmentShader: displayFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const seedTexture = createSeedTexture(bufferSize)
    const rtOpts = {
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }
    const rtA = new THREE.WebGLRenderTarget(bufferSize, bufferSize, rtOpts)
    const rtB = rtA.clone()
    const simScene = new THREE.Scene()
    const simMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial)
    simMesh.frustumCulled = false
    simScene.add(simMesh)
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    simCamera.position.z = 1
    return { simMaterial, displayMaterial, seedTexture, rtA, rtB, simScene, simMesh, simCamera }
  }, [bufferSize, maxAlpha])

  // Update accent color when prop changes
  useEffect(() => {
    displayMaterial.uniforms.accentColor.value.set(accentRgb[0], accentRgb[1], accentRgb[2])
  }, [accentRgb, displayMaterial])

  useEffect(() => {
    displayMaterial.uniforms.maxAlpha.value = maxAlpha
  }, [maxAlpha, displayMaterial])

  const seeded = useRef(false)

  useEffect(() => {
    return () => {
      rtA.dispose()
      rtB.dispose()
      seedTexture.dispose()
      simMaterial.dispose()
      displayMaterial.dispose()
      simMesh.geometry.dispose()
    }
  }, [rtA, rtB, seedTexture, simMaterial, displayMaterial, simMesh])

  useFrame(({ clock }) => {
    if (document.hidden) return

    if (!seeded.current) {
      simMaterial.uniforms.previousIterationTexture.value = seedTexture
      gl.setRenderTarget(rtA)
      gl.render(simScene, simCamera)
      seeded.current = true
    }

    // Collapse-safe organism morphing — walk f/k, never teleport
    const now = clock.getElapsedTime()
    const dt = prevTime.current === 0 ? 0.016 : Math.min(now - prevTime.current, 0.1)
    prevTime.current = now
    const damp = 1 - Math.exp(-dt * 0.9) // ~3s walk between organisms
    simMaterial.uniforms.f.value += (targetRef.current.f - simMaterial.uniforms.f.value) * damp
    simMaterial.uniforms.k.value += (targetRef.current.k - simMaterial.uniforms.k.value) * damp

    // Ping-pong simulation passes
    for (let i = 0; i < simPasses; i++) {
      simMaterial.uniforms.previousIterationTexture.value = rtA.texture
      gl.setRenderTarget(rtB)
      gl.render(simScene, simCamera)

      simMaterial.uniforms.previousIterationTexture.value = rtB.texture
      gl.setRenderTarget(rtA)
      gl.render(simScene, simCamera)
    }

    gl.setRenderTarget(null)
    displayMaterial.uniforms.textureToDisplay.value = rtA.texture
  })

  return (
    <mesh material={displayMaterial} frustumCulled={false}>
      <planeGeometry args={[viewport.width, viewport.height]} />
    </mesh>
  )
}

function SubstrateCanvas(props: SubstrateSceneProps) {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 10], near: 0.1, far: 1000 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <SubstrateScene {...props} />
    </Canvas>
  )
}

export interface LivingSubstrateProps {
  /** Accent hex color (e.g. '#8b5cf6'). Default '#fbbf24' (amber). */
  accent?: string
  /** Organism preset name. Default 'coral'. */
  organism?: Organism
  /** Simulation passes per frame. 1=calmer, 2=smoother. Default 1. */
  speed?: number
  /** Buffer resolution. 256 or 384. Default auto (384 on high-DPI). */
  resolution?: number
  /** Max alpha for display ramp. Default 0.20. */
  maxAlpha?: number
  /** Enable/disable. Default true. */
  enabled?: boolean
}

export function LivingSubstrate({
  accent = '#fbbf24',
  organism = 'coral',
  speed = 1,
  resolution,
  maxAlpha = 0.20,
  enabled = true,
}: LivingSubstrateProps) {
  const [motionEnabled, setMotionEnabled] = useState(
    () => typeof window === 'undefined' ? false : !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setMotionEnabled(!e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const bufferSize = resolution ?? (typeof window !== 'undefined' && window.devicePixelRatio > 1.5 ? 384 : 256)
  const simPasses = speed === 2 ? 2 : 1
  const showWebGL = enabled && motionEnabled

  if (!showWebGL) {
    // Static fallback — brighter to ensure visibility
    return (
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{
          opacity: 0.5,
          background: `radial-gradient(ellipse at 50% 40%, ${accent}40, ${accent}20 50%, transparent 80%)`,
        }} />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
      <SubstrateErrorBoundary>
        <SubstrateCanvas accent={accent} organism={organism} bufferSize={bufferSize} simPasses={simPasses} maxAlpha={maxAlpha} />
      </SubstrateErrorBoundary>
    </div>
  )
}
