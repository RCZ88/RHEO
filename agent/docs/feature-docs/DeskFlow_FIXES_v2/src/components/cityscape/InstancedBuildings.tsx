import { useGLTF } from "@react-three/drei"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import {
  ALL_BUILDING_MODEL_URLS,
  type BuildingInstance,
} from "./buildScene"

try {
  ALL_BUILDING_MODEL_URLS.forEach((url) => useGLTF.preload(url))
} catch {
  /* non-fatal */
}

interface SubmeshDef {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  base: THREE.Matrix4
}

function ModelInstances({
  url,
  instances,
}: {
  url: string
  instances: BuildingInstance[]
}) {
  const { scene } = useGLTF(url)
  const { submeshes, size } = useMemo(() => {
    scene.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(scene)
    const sz = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(sz)
    box.getCenter(center)
    const normalize = new THREE.Matrix4().makeTranslation(
      -center.x,
      -box.min.y,
      -center.z,
    )
    const out: SubmeshDef[] = []
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      const base = new THREE.Matrix4()
        .copy(normalize)
        .multiply(mesh.matrixWorld)
      // Replace GLB material with solid-color material so instanceColor works
      const mat = new THREE.MeshStandardMaterial({
        color: "#1a1e2e",
        metalness: 0.7,
        roughness: 0.3,
        emissive: "#112244",
        emissiveIntensity: 0.3,
      })
      out.push({ geometry: mesh.geometry, material: mat, base })
    })
    const safe = (n: number) => (Math.abs(n) < 1e-4 ? 1 : n)
    return {
      submeshes: out,
      size: new THREE.Vector3(safe(sz.x), safe(sz.y), safe(sz.z)),
    }
  }, [scene])

  if (submeshes.length === 0) return null

  return (
    <>
      {submeshes.map((sm, i) => (
        <SubmeshInstanced
          key={i}
          submesh={sm}
          size={size}
          instances={instances}
        />
      ))}
    </>
  )
}

function SubmeshInstanced({
  submesh,
  size,
  instances,
}: {
  submesh: SubmeshDef
  size: THREE.Vector3
  instances: BuildingInstance[]
}) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const inst = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const tempColor = new THREE.Color()

    for (let i = 0; i < instances.length; i++) {
      const b = instances[i]
      scl.set(b.fit[0] / size.x, b.fit[1] / size.y, b.fit[2] / size.z)
      quat.setFromAxisAngle(up, b.rotationY)
      pos.set(b.position[0], b.position[1], b.position[2])
      inst.compose(pos, quat, scl)
      m.multiplyMatrices(inst, submesh.base)
      mesh.setMatrixAt(i, m)

      // Per-instance color: hero buildings get their color, filler get dark neutral
      if (b.color) {
        tempColor.set(b.color)
      } else {
        tempColor.set(0.12, 0.14, 0.22)
      }
      mesh.setColorAt(i, tempColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [submesh, size, instances])

  return (
    <instancedMesh
      ref={ref}
      args={[submesh.geometry, undefined as never, instances.length]}
      material={submesh.material}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

export function InstancedBuildings({
  buildings,
}: {
  buildings: BuildingInstance[]
}) {
  const groups = useMemo(() => {
    const map = new Map<string, BuildingInstance[]>()
    for (const b of buildings) {
      const arr = map.get(b.modelUrl)
      if (arr) arr.push(b)
      else map.set(b.modelUrl, [b])
    }
    return [...map.entries()]
  }, [buildings])

  if (buildings.length === 0) return null

  return (
    <>
      {groups.map(([url, instances]) => (
        <ModelInstances key={url} url={url} instances={instances} />
      ))}
    </>
  )
}

export default InstancedBuildings
