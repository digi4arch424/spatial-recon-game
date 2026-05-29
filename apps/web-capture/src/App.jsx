import { useState, useRef, useEffect, useCallback } from 'react'

const STATUS = { IDLE: 'IDLE', ACQUIRING: 'ACQUIRING', LOCKED: 'LOCKED', CAPTURED: 'CAPTURED', ERROR: 'ERROR' }

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

function useTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return tick
}

function Clock() {
  const tick = useTick()
  const now = new Date()
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--blue)', letterSpacing: 2 }}>
      {now.toISOString().replace('T', ' ').slice(0, 19)} UTC
    </span>
  )
}

function CornerBrackets({ color = 'var(--green)', size = 24, thickness = 2, gap = 14 }) {
  const s = { position: 'absolute', width: size, height: size }
  const shared = { border: `${thickness}px solid ${color}` }
  return (
    <>
      <span style={{ ...s, top: gap, left: gap, borderRight: 'none', borderBottom: 'none', ...shared }} />
      <span style={{ ...s, top: gap, right: gap, borderLeft: 'none', borderBottom: 'none', ...shared }} />
      <span style={{ ...s, bottom: gap, left: gap, borderRight: 'none', borderTop: 'none', ...shared }} />
      <span style={{ ...s, bottom: gap, right: gap, borderLeft: 'none', borderTop: 'none', ...shared }} />
    </>
  )
}

function Crosshair({ active }) {
  const c = active ? 'var(--green)' : 'var(--muted)'
  return (
    <svg style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 60, height: 60,
      opacity: active ? 1 : 0.4, transition: 'opacity 0.3s'
    }} viewBox="0 0 60 60" fill="none">
      <circle cx="30" cy="30" r="10" stroke={c} strokeWidth="1" />
      <line x1="30" y1="0" x2="30" y2="16" stroke={c} strokeWidth="1" />
      <line x1="30" y1="44" x2="30" y2="60" stroke={c} strokeWidth="1" />
      <line x1="0" y1="30" x2="16" y2="30" stroke={c} strokeWidth="1" />
      <line x1="44" y1="30" x2="60" y2="30" stroke={c} strokeWidth="1" />
    </svg>
  )
}

function ScanLine({ scanning }) {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    if (!scanning) return
    let frame, p = 0
    const animate = () => { p = (p + 0.4) % 100; setPos(p); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [scanning])
  if (!scanning) return null
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: `${pos}%`, height: 2,
      background: 'linear-gradient(90deg, transparent, rgba(57,232,62,0.6), transparent)',
      pointerEvents: 'none', zIndex: 4
    }} />
  )
}

function StatBadge({ label, value, color = 'var(--blue)' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 14px', border: '1px solid var(--muted)', background: 'var(--bg-panel)'
    }}>
      <span style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{label}</span>
      <span style={{ fontSize: 14, letterSpacing: 2, color, fontFamily: 'var(--mono)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function Dot({ on, color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: on ? color : 'var(--muted)',
      boxShadow: on ? `0 0 6px ${color}` : 'none',
      transition: 'all 0.2s'
    }} />
  )
}

// ─── MOBILE BOTTOM PANEL ─────────────────────────────────────────────────────

function MobilePanel({ status, frameCount, captured, statusColor, isLive,
  onStart, onCapture, onStop, onRetry, onClear }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
      background: 'rgba(7,21,38,0.96)',
      borderTop: '1px solid var(--muted)',
      backdropFilter: 'blur(8px)',
      transition: 'height 0.3s ease'
    }}>
      {/* Drag handle + status strip */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', cursor: 'pointer', userSelect: 'none'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Dot on={isLive} color='var(--green)' />
          <span style={{ fontSize: 11, letterSpacing: 3, color: statusColor }}>{status}</span>
          <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)' }}>
            FRAMES: {String(frameCount).padStart(4, '0')}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>
          {expanded ? '▼ CLOSE' : '▲ EXPAND'}
        </span>
      </div>

      {/* Primary action button — always visible */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 10 }}>
        {status === STATUS.IDLE && (
          <button onClick={onStart} style={{
            flex: 1, padding: '16px 0',
            background: 'rgba(57,232,62,0.1)', border: '1px solid var(--green)',
            color: 'var(--green)', fontFamily: 'var(--mono)',
            fontSize: 14, letterSpacing: 3, cursor: 'pointer'
          }}>▶ INITIALIZE CAMERA</button>
        )}
        {status === STATUS.ACQUIRING && (
          <div style={{
            flex: 1, padding: '16px 0', textAlign: 'center',
            fontSize: 13, letterSpacing: 3, color: 'var(--green)'
          }}>◌ ACQUIRING SIGNAL...</div>
        )}
        {status === STATUS.LOCKED && (
          <>
            <button onClick={onCapture} style={{
              flex: 2, padding: '16px 0',
              background: 'rgba(57,232,62,0.12)', border: '1px solid var(--green)',
              color: 'var(--green)', fontFamily: 'var(--mono)',
              fontSize: 14, letterSpacing: 3, cursor: 'pointer'
            }}>◉ CAPTURE</button>
            <button onClick={onStop} style={{
              flex: 1, padding: '16px 0',
              background: 'transparent', border: '1px solid var(--muted)',
              color: 'var(--text-dim)', fontFamily: 'var(--mono)',
              fontSize: 12, letterSpacing: 2, cursor: 'pointer'
            }}>■ STOP</button>
          </>
        )}
        {status === STATUS.ERROR && (
          <button onClick={onRetry} style={{
            flex: 1, padding: '16px 0',
            background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)',
            color: 'var(--red)', fontFamily: 'var(--mono)',
            fontSize: 13, letterSpacing: 3, cursor: 'pointer'
          }}>↺ RETRY</button>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--muted)', paddingTop: 16 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <StatBadge label="STATUS" value={status.slice(0,4)} color={statusColor} />
            <StatBadge label="FRAMES" value={String(frameCount).padStart(4,'0')} color="var(--green)" />
            <StatBadge label="LAYER" value="L01" color="var(--blue)" />
            <StatBadge label="MODULE" value="CAM" color="var(--text)" />
          </div>

          {/* Captured thumbnail */}
          {captured && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>LAST CAPTURE</div>
              <div style={{ position: 'relative', border: '1px solid var(--blue-dim)', marginBottom: 8 }}>
                <img src={captured} alt="Captured frame" style={{ width: '100%', display: 'block', opacity: 0.9 }} />
                <CornerBrackets color="var(--blue)" size={12} thickness={1} gap={5} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={captured} download={`recon-l01-${Date.now()}.jpg`} style={{
                  flex: 1, padding: '10px 0', textAlign: 'center',
                  background: 'rgba(0,170,255,0.08)', border: '1px solid var(--blue-dim)',
                  color: 'var(--blue)', fontFamily: 'var(--mono)',
                  fontSize: 11, letterSpacing: 2, textDecoration: 'none', display: 'block'
                }}>↓ SAVE</a>
                <button onClick={onClear} style={{
                  flex: 1, padding: '10px 0', background: 'transparent',
                  border: '1px solid var(--muted)', color: 'var(--text-dim)',
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 2, cursor: 'pointer'
                }}>✕ CLEAR</button>
              </div>
            </div>
          )}

          {/* Level progress */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>LEVEL PROGRESS</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 4,
                  background: i === 0 ? 'var(--green)' : 'var(--muted)',
                  opacity: i === 0 ? 1 : 0.4
                }} />
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>1 / 20</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [captured, setCaptured] = useState(null)
  const [frameCount, setFrameCount] = useState(0)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(false)
  const width = useWindowSize()
  const isMobile = width < 768

  const startCamera = useCallback(async () => {
    setStatus(STATUS.ACQUIRING)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setStatus(STATUS.LOCKED) }
      }
    } catch (err) {
      setError(err.message || 'Camera access denied')
      setStatus(STATUS.ERROR)
    }
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || status !== STATUS.LOCKED) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCaptured(dataUrl)
    setFrameCount(c => c + 1)
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    setStatus(STATUS.CAPTURED)
    setTimeout(() => setStatus(STATUS.LOCKED), 1200)
  }, [status])

  const clearCapture = useCallback(() => setCaptured(null), [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setStatus(STATUS.IDLE); setCaptured(null); setFrameCount(0)
  }, [])

  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }, [])

  const isLive = status === STATUS.LOCKED || status === STATUS.CAPTURED
  const statusColor = {
    IDLE: 'var(--text-dim)', ACQUIRING: 'var(--green)',
    LOCKED: 'var(--green-soft)', CAPTURED: 'var(--blue)', ERROR: 'var(--red)'
  }[status]

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', fontFamily: 'var(--mono)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '8px 14px' : '10px 20px',
        borderBottom: '1px solid var(--muted)', background: 'var(--bg-surface)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 4, color: 'var(--green)' }}>DIGI</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 4, color: 'var(--blue)' }}>ARCH</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 2, color: 'var(--text-dim)', marginLeft: 6 }}>424</span>
          </div>
          {!isMobile && <div style={{ width: 1, height: 18, background: 'var(--muted)' }} />}
          {!isMobile && <span style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 600, letterSpacing: 4, color: 'var(--text-dim)' }}>SPATIAL RECON</span>}
          <div style={{ padding: '2px 8px', border: '1px solid var(--green-dim)', background: 'rgba(57,232,62,0.06)' }}>
            <span style={{ fontSize: 10, letterSpacing: 3, color: 'var(--green)' }}>LVL 01</span>
          </div>
        </div>
        {!isMobile && <Clock />}
      </div>

      {/* Mission bar — desktop only */}
      {!isMobile && (
        <div style={{
          padding: '8px 20px', borderBottom: '1px solid var(--muted)',
          background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
        }}>
          <span style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)' }}>MISSION</span>
          <span style={{ fontSize: 12, letterSpacing: 2, color: 'var(--text)' }}>CAMERA SPAWN — ACQUIRE SINGLE FRAME</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: 3, color: 'var(--text-dim)' }}>MODULE: web-capture</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Viewfinder — always full flex on mobile, partial on desktop */}
        <div style={{
          flex: 1, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#020810'
        }}>
          {/* Dual-tone circuit grid */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            backgroundImage: ['linear-gradient(rgba(57,232,62,0.04) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(57,232,62,0.04) 1px, transparent 1px)'].join(','),
            backgroundSize: '40px 40px',
            maskImage: 'linear-gradient(to right, black 0%, black 50%, transparent 50%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 50%, transparent 50%)'
          }} />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            backgroundImage: ['linear-gradient(rgba(0,170,255,0.04) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(0,170,255,0.04) 1px, transparent 1px)'].join(','),
            backgroundSize: '40px 40px',
            maskImage: 'linear-gradient(to right, transparent 50%, black 50%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 50%, black 50%)'
          }} />

          <video ref={videoRef} playsInline muted style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: isLive ? 'block' : 'none',
            filter: 'contrast(1.05) saturate(0.9)',
            zIndex: 2, position: 'relative'
          }} />

          {!isLive && status !== STATUS.ERROR && (
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="4" y="14" width="56" height="40" rx="4" stroke="var(--muted)" strokeWidth="1.5" />
                <circle cx="32" cy="34" r="10" stroke="var(--muted)" strokeWidth="1.5" />
                <circle cx="32" cy="34" r="4" fill="var(--muted)" />
                <rect x="22" y="10" width="20" height="6" rx="2" stroke="var(--muted)" strokeWidth="1.5" />
              </svg>
              <span style={{ fontSize: 11, letterSpacing: 4, color: 'var(--text-dim)' }}>NO SIGNAL</span>
              <span style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-dim)', opacity: 0.6 }}>DESIGN — BUILD — ITERATE</span>
            </div>
          )}

          {status === STATUS.ERROR && (
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24 }}>
              <span style={{ fontSize: 11, letterSpacing: 4, color: 'var(--red)' }}>ACCESS DENIED</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 260 }}>{error}</span>
            </div>
          )}

          {isLive && (
            <>
              <CornerBrackets color={status === STATUS.CAPTURED ? 'var(--blue)' : 'var(--green)'} />
              <Crosshair active={status === STATUS.LOCKED} />
              <ScanLine scanning={status === STATUS.ACQUIRING} />
              <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 5, pointerEvents: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(57,232,62,0.8)' }}>REC ●</div>
              </div>
              {!isMobile && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.7)' }}>VID 1280×720 / MJPEG</span>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.5)' }}>ENV CAM / AUTO FOCUS</span>
                </div>
              )}
            </>
          )}

          {flash && <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.7, zIndex: 10, pointerEvents: 'none' }} />}

          {/* Mobile bottom panel */}
          {isMobile && (
            <MobilePanel
              status={status} frameCount={frameCount} captured={captured}
              statusColor={statusColor} isLive={isLive}
              onStart={startCamera} onCapture={captureFrame}
              onStop={stopCamera} onRetry={startCamera} onClear={clearCapture}
            />
          )}
        </div>

        {/* Desktop right panel */}
        {!isMobile && (
          <div style={{ width: 260, borderLeft: '1px solid var(--muted)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 12 }}>SYSTEM STATUS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'SIGNAL', on: isLive, color: 'var(--green)' },
                  { label: 'STREAM', on: isLive, color: 'var(--blue)' },
                  { label: 'CAPTURE READY', on: status === STATUS.LOCKED, color: 'var(--green)' },
                ].map(({ label, on, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: on ? color : 'var(--text-dim)' }}>{on ? 'ACTIVE' : 'OFFLINE'}</span>
                      <Dot on={on} color={color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, borderBottom: '1px solid var(--muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatBadge label="STATUS" value={status} color={statusColor} />
              <StatBadge label="FRAMES" value={String(frameCount).padStart(4, '0')} color="var(--green)" />
              <StatBadge label="LAYER" value="L01" color="var(--blue)" />
              <StatBadge label="MODULE" value="CAM" color="var(--text)" />
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 4 }}>CONTROLS</div>
              {status === STATUS.IDLE && (
                <button onClick={startCamera} style={{ padding: '12px 0', background: 'rgba(57,232,62,0.08)', border: '1px solid var(--green)', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: 3, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.target.style.background = 'rgba(57,232,62,0.18)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(57,232,62,0.08)'}>
                  ▶ INITIALIZE CAMERA
                </button>
              )}
              {status === STATUS.ACQUIRING && (
                <div style={{ textAlign: 'center', padding: 12, fontSize: 11, letterSpacing: 3, color: 'var(--green)' }}>◌ ACQUIRING SIGNAL...</div>
              )}
              {status === STATUS.LOCKED && (
                <button onClick={captureFrame} style={{ padding: '12px 0', background: 'rgba(57,232,62,0.12)', border: '1px solid var(--green)', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: 3, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.target.style.background = 'rgba(57,232,62,0.22)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(57,232,62,0.12)'}>
                  ◉ CAPTURE FRAME
                </button>
              )}
              {(status === STATUS.LOCKED || status === STATUS.CAPTURED || status === STATUS.ACQUIRING) && (
                <button onClick={stopCamera} style={{ padding: '10px 0', background: 'transparent', border: '1px solid var(--muted)', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 3, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
                  onMouseLeave={e => { e.target.style.borderColor = 'var(--muted)'; e.target.style.color = 'var(--text-dim)' }}>
                  ■ TERMINATE STREAM
                </button>
              )}
              {status === STATUS.ERROR && (
                <button onClick={startCamera} style={{ padding: '12px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 3, cursor: 'pointer' }}>
                  ↺ RETRY
                </button>
              )}
            </div>

            {captured && (
              <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)' }}>LAST CAPTURE</div>
                <div style={{ position: 'relative', border: '1px solid var(--blue-dim)' }}>
                  <img src={captured} alt="Captured frame" style={{ width: '100%', display: 'block', opacity: 0.9 }} />
                  <CornerBrackets color="var(--blue)" size={12} thickness={1} gap={5} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={captured} download={`recon-l01-${Date.now()}.jpg`} style={{ flex: 1, padding: '8px 0', textAlign: 'center', background: 'rgba(0,170,255,0.08)', border: '1px solid var(--blue-dim)', color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 2, textDecoration: 'none', display: 'block' }}>↓ SAVE</a>
                  <button onClick={clearCapture} style={{ flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid var(--muted)', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 2, cursor: 'pointer' }}>✕ CLEAR</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 10 }}>LEVEL PROGRESS</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, background: i === 0 ? 'var(--green)' : 'var(--muted)', opacity: i === 0 ? 1 : 0.4 }} />
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>1 / 20</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom status bar — desktop only */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 20px', borderTop: '1px solid var(--muted)', background: 'var(--bg-panel)', fontSize: 10, letterSpacing: 2, color: 'var(--text-dim)', flexShrink: 0 }}>
          <span style={{ color: 'var(--green)' }}>DIGI</span>
          <span style={{ color: 'var(--blue)', marginLeft: -18 }}>ARCH</span>
          <span style={{ marginLeft: -12 }}>424</span>
          <span style={{ color: 'var(--muted)' }}>|</span>
          <span>DESIGN — BUILD — ITERATE</span>
          <span style={{ color: 'var(--muted)' }}>|</span>
          <span>LAYER: BROWSER / L01</span>
          <span style={{ marginLeft: 'auto', color: statusColor }}>● {status}</span>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
