import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Distributes frameCount points evenly across the hemisphere
// using a golden-ratio spiral. When orientationHistory is provided,
// uses actual captured angles instead.

function buildPoints(frameCount, orientationHistory) {
  if (frameCount === 0) return []

  if (orientationHistory && orientationHistory.length > 0) {
    return orientationHistory.map(({ alpha, beta }) => {
      const phi   = ((alpha ?? 0) * Math.PI) / 180
      const theta = (((90 - Math.max(0, beta ?? 45)) * Math.PI) / 180)
      return new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      )
    })
  }

  // Golden-ratio spiral across hemisphere surface
  const pts = []
  for (let i = 0; i < frameCount; i++) {
    const phi   = Math.acos(1 - (i + 0.5) / frameCount)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    pts.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    ))
  }
  return pts
}

export function CoverageMap({ frameCount, orientationHistory }) {
  const canvasRef  = useRef(null)
  const sceneRef   = useRef(null)
  const animRef    = useRef(null)

  // ── Initialise scene once ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas   = canvasRef.current
    const W = 228, H = 140

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    camera.position.set(0, 1.4, 2.4)
    camera.lookAt(0, 0, 0)

    // Hemisphere wireframe
    const hemiGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    const hemiMat = new THREE.MeshBasicMaterial({
      color: 0x1e3a52, wireframe: true, transparent: true, opacity: 0.35
    })
    const hemi = new THREE.Mesh(hemiGeo, hemiMat)
    scene.add(hemi)

    // Base ring
    const ringGeo = new THREE.RingGeometry(0.98, 1.0, 32)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e3a52, side: THREE.DoubleSide })
    scene.add(Object.assign(new THREE.Mesh(ringGeo, ringMat), { rotation: { x: -Math.PI / 2 } }))

    // Subject dot at origin
    const subjectGeo = new THREE.SphereGeometry(0.07, 8, 8)
    const subjectMat = new THREE.MeshBasicMaterial({ color: 0x00aaff })
    scene.add(new THREE.Mesh(subjectGeo, subjectMat))

    // Animate
    let angle = 0
    const animate = () => {
      animRef.current = requestAnimationFrame(animate)
      angle += 0.004
      hemi.rotation.y = angle
      const pts = scene.getObjectByName('coveragePoints')
      if (pts) pts.rotation.y = angle
      renderer.render(scene, camera)
    }
    animate()

    sceneRef.current = { scene, renderer, hemiGeo, hemiMat, ringGeo, ringMat, subjectGeo, subjectMat }

    return () => {
      cancelAnimationFrame(animRef.current)
      hemiGeo.dispose(); hemiMat.dispose()
      ringGeo.dispose(); ringMat.dispose()
      subjectGeo.dispose(); subjectMat.dispose()
      renderer.dispose()
    }
  }, [])

  // ── Update coverage points when frames change ─────────────────────────────
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    const { scene } = ref

    const existing = scene.getObjectByName('coveragePoints')
    if (existing) {
      existing.geometry.dispose()
      existing.material.dispose()
      scene.remove(existing)
    }

    if (frameCount === 0) return

    const pts       = buildPoints(frameCount, orientationHistory)
    const positions = new Float32Array(pts.flatMap(p => [p.x, p.y, p.z]))
    const geo       = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0x39e83e, size: 0.09, transparent: true, opacity: 0.9 })
    const mesh      = new THREE.Points(geo, mat)
    mesh.name       = 'coveragePoints'
    scene.add(mesh)
  }, [frameCount, orientationHistory])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: 'auto', opacity: 0.9 }}
    />
  )
}
