import { useEffect, useRef, useState } from 'react'

export function MeshViewer({ meshUrl, sessionId, onClose }) {
  const mountRef = useRef(null)
  const animRef  = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [stats,   setStats]   = useState(null)

  useEffect(() => {
    if (!meshUrl || !mountRef.current) return

    const container = mountRef.current
    let cancelled   = false
    let renderer, controls

    async function init() {
      // ── Dynamic imports avoid Three.js circular dependency at module load ──
      const THREE           = await import('three')
      const { OBJLoader }   = await import('three/examples/jsm/loaders/OBJLoader.js')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

      if (cancelled) return

      const W = container.clientWidth
      const H = container.clientHeight

      // ── Scene ────────────────────────────────────────────────────────────
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x020810)
      scene.fog = new THREE.Fog(0x020810, 10, 50)

      // ── Camera ───────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.001, 1000)
      camera.position.set(0, 1.5, 3)

      // ── Renderer ──────────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)

      // ── Lights ────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.5))

      const key = new THREE.DirectionalLight(0xffffff, 1.2)
      key.position.set(5, 10, 7.5)
      key.castShadow = true
      scene.add(key)

      const fill = new THREE.DirectionalLight(0x39e83e, 0.15)
      fill.position.set(-5, 3, -5)
      scene.add(fill)

      const rim = new THREE.DirectionalLight(0x00aaff, 0.1)
      rim.position.set(0, -5, -10)
      scene.add(rim)

      // ── Grid ──────────────────────────────────────────────────────────────
      const grid = new THREE.GridHelper(20, 40, 0x1e3a52, 0x1e3a52)
      grid.material.opacity = 0.25
      grid.material.transparent = true
      scene.add(grid)

      // ── Orbit controls ────────────────────────────────────────────────────
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping   = true
      controls.dampingFactor   = 0.05
      controls.minDistance     = 0.5
      controls.maxDistance     = 20
      controls.autoRotate      = true
      controls.autoRotateSpeed = 1.0

      renderer.domElement.addEventListener('pointerdown', () => {
        controls.autoRotate = false
      })

      // ── Load OBJ ──────────────────────────────────────────────────────────
      const loader = new OBJLoader()
      loader.load(
        meshUrl,
        (obj) => {
          if (cancelled) return

          const box    = new THREE.Box3().setFromObject(obj)
          const centre = box.getCenter(new THREE.Vector3())
          const size   = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale  = 2 / maxDim

          obj.position.sub(centre)
          obj.scale.setScalar(scale)

          const newBox = new THREE.Box3().setFromObject(obj)
          obj.position.y -= newBox.min.y

          let vtx = 0, tri = 0
          obj.traverse(child => {
            if (child.isMesh) {
              child.material = new THREE.MeshLambertMaterial({
                color: 0xc8dff0, emissive: 0x0a0f1a
              })
              child.castShadow    = true
              child.receiveShadow = true
              vtx += child.geometry.attributes.position?.count || 0
              tri += child.geometry.index
                ? child.geometry.index.count / 3
                : (child.geometry.attributes.position?.count || 0) / 3
            }
          })

          scene.add(obj)
          setStats({ vertices: vtx, triangles: Math.round(tri) })
          setLoading(false)
        },
        undefined,
        () => {
          setError('Failed to load mesh')
          setLoading(false)
        }
      )

      // ── Animation loop ────────────────────────────────────────────────────
      const animate = () => {
        animRef.current = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        const W = container.clientWidth
        const H = container.clientHeight
        camera.aspect = W / H
        camera.updateProjectionMatrix()
        renderer.setSize(W, H)
      }
      window.addEventListener('resize', onResize)

      // Store cleanup ref
      animRef._cleanup = () => {
        window.removeEventListener('resize', onResize)
        controls.dispose()
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    }

    init().catch(err => {
      setError(`Viewer initialisation failed: ${err.message}`)
      setLoading(false)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
      if (animRef._cleanup) animRef._cleanup()
    }
  }, [meshUrl])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: '#020810', fontFamily: 'var(--mono)'
    }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading */}
      {loading && !error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12
        }}>
          <span style={{ fontSize: 11, letterSpacing: 4, color: 'var(--green)' }}>◌ LOADING MESH...</span>
          <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-dim)' }}>SESSION: {sessionId}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          <span style={{ fontSize: 11, letterSpacing: 4, color: 'var(--red)' }}>✕ LOAD FAILED</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', maxWidth: 300, textAlign: 'center' }}>{error}</span>
        </div>
      )}

      {/* HUD — top left */}
      {!loading && !error && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 3,
          pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <span style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(57,232,62,0.8)' }}>3D RECONSTRUCTION ●</span>
          <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.6)' }}>SESSION: {sessionId}</span>
          {stats && (
            <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-dim)' }}>
              {stats.vertices.toLocaleString()} VTX · {stats.triangles.toLocaleString()} TRI
            </span>
          )}
        </div>
      )}

      {/* HUD — bottom left */}
      {!loading && !error && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 3, pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.5)' }}>
            DRAG TO ORBIT · SCROLL TO ZOOM · RIGHT-CLICK TO PAN
          </span>
        </div>
      )}

      {/* Close */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 3,
        padding: '6px 16px', background: 'rgba(0,0,0,0.7)',
        border: '1px solid var(--muted)', color: 'var(--text-dim)',
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 3, cursor: 'pointer'
      }}>✕ CLOSE</button>
    </div>
  )
}
