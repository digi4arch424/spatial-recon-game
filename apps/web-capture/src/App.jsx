import { useRef, useCallback, useState }              from 'react'
import { useCamera, STATUS }                          from './hooks/useCamera'
import { useFrameStore }                              from './hooks/useFrameStore'
import { useWindowSize }                              from './hooks/useWindowSize'
import { useDeviceOrientation }                       from './hooks/useDeviceOrientation'
import { useScanGuidance }                            from './hooks/useScanGuidance'
import { useUpload }                                  from './hooks/useUpload'
import { useReconStatus }                             from './hooks/useReconStatus'
import { CornerBrackets, Crosshair,
         ScanLine, CaptureGuide }                     from './components/HudOverlays'
import { Dot, StatBadge, Clock }                      from './components/Primitives'
import { MobilePanel }                                from './components/MobilePanel'
import { FrameStrip }                                 from './components/FrameStrip'
import { CoverageMap }                                from './components/CoverageMap'
import { MeshViewer }                                 from './components/MeshViewer'

function generateSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export default function App() {
  const sessionId          = useRef(generateSessionId())
  const width              = useWindowSize()
  const isMobile           = width < 768
  const [orientHistory, setOrientHistory] = useState([])
  const [viewerOpen,    setViewerOpen]    = useState(false)

  // ── Device orientation ────────────────────────────────────────────────────
  const {
    orientation, available: orientAvailable,
    permitted: orientPermitted, requestPermission: requestOrientation
  } = useDeviceOrientation()

  // ── Frame storage ─────────────────────────────────────────────────────────
  const {
    frames, saveFrame, clearSession, deleteFrame, exportZip, getZipBlob
  } = useFrameStore(sessionId.current)

  // ── Upload + pipeline status ──────────────────────────────────────────────
  const {
    uploadStatus, reconstructionId, progress: uploadProgress,
    error: uploadError, upload, resetUpload
  } = useUpload()

  const {
    status: reconStatus, connected: reconConnected, meshUrl
  } = useReconStatus(reconstructionId)

  // ── Camera hardware + capture logic ───────────────────────────────────────
  const {
    videoRef, canvasRef,
    status, frameCount, error, flash, dupAlert,
    isLive, startCamera, captureFrame, stopCamera
  } = useCamera({
    onFrameCaptured: (dataUrl, count, isBlurry) => {
      // Record orientation snapshot at capture time if available
      if (orientAvailable) {
        setOrientHistory(h => [...h, { ...orientation }])
      }
      return saveFrame(dataUrl, count, isBlurry)
    }
  })

  // ── Scan guidance ─────────────────────────────────────────────────────────
  const guidance = useScanGuidance(frameCount, orientAvailable ? orientation : null)

  // ── Handle upload — must be after useCamera so frameCount is declared ──────
  const handleUpload = useCallback(() => {
    upload(sessionId.current, frameCount, getZipBlob)
  }, [upload, frameCount, getZipBlob])

  // ── Stop: hardware + session reset ────────────────────────────────────────
  const handleStop = useCallback(async () => {
    stopCamera()
    await clearSession()
    resetUpload()
    setOrientHistory([])
    sessionId.current = generateSessionId()
  }, [stopCamera, clearSession, resetUpload])

  const statusColor = {
    IDLE:      'var(--text-dim)',
    ACQUIRING: 'var(--green)',
    LOCKED:    'var(--green-soft)',
    CAPTURED:  'var(--blue)',
    ERROR:     'var(--red)'
  }[status]

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', fontFamily: 'var(--mono)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '8px 14px' : '10px 20px', borderBottom: '1px solid var(--muted)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 4, color: 'var(--green)' }}>DIGI</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 4, color: 'var(--blue)' }}>ARCH</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 16 : 22, fontWeight: 700, letterSpacing: 2, color: 'var(--text-dim)', marginLeft: 6 }}>424</span>
          </div>
          {!isMobile && <div style={{ width: 1, height: 18, background: 'var(--muted)' }} />}
          {!isMobile && <span style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 600, letterSpacing: 4, color: 'var(--text-dim)' }}>SPATIAL RECON</span>}
          <div style={{ padding: '2px 8px', border: '1px solid var(--green-dim)', background: 'rgba(57,232,62,0.06)' }}>
            <span style={{ fontSize: 10, letterSpacing: 3, color: 'var(--green)' }}>LVL 03</span>
          </div>
        </div>
        {!isMobile && <Clock />}
      </div>

      {/* Mission bar — desktop only */}
      {!isMobile && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--muted)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)' }}>MISSION</span>
          <span style={{ fontSize: 12, letterSpacing: 2, color: 'var(--text)' }}>SCENE SAMPLING — ORBIT SUBJECT, BUILD COVERAGE</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: 3, color: guidance.phase.color }}>
            {guidance.phase.label}
          </span>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Viewfinder */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020810' }}>

          {/* Dual-tone circuit grid */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: ['linear-gradient(rgba(57,232,62,0.04) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(57,232,62,0.04) 1px, transparent 1px)'].join(','), backgroundSize: '40px 40px', maskImage: 'linear-gradient(to right, black 0%, black 50%, transparent 50%)', WebkitMaskImage: 'linear-gradient(to right, black 0%, black 50%, transparent 50%)' }} />
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: ['linear-gradient(rgba(0,170,255,0.04) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(0,170,255,0.04) 1px, transparent 1px)'].join(','), backgroundSize: '40px 40px', maskImage: 'linear-gradient(to right, transparent 50%, black 50%)', WebkitMaskImage: 'linear-gradient(to right, transparent 50%, black 50%)' }} />

          {/* Video */}
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: isLive ? 'block' : 'none', filter: 'contrast(1.05) saturate(0.9)', zIndex: 2, position: 'relative' }} />

          {/* Idle */}
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

          {/* Error */}
          {status === STATUS.ERROR && (
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24 }}>
              <span style={{ fontSize: 11, letterSpacing: 4, color: 'var(--red)' }}>ACCESS DENIED</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 260 }}>{error}</span>
            </div>
          )}

          {/* Live overlays */}
          {isLive && (
            <>
              <CornerBrackets color={status === STATUS.CAPTURED ? 'var(--blue)' : 'var(--green)'} />
              <Crosshair active={status === STATUS.LOCKED} />
              <ScanLine scanning={status === STATUS.ACQUIRING} />
              <CaptureGuide guidance={guidance} />
              <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 5, pointerEvents: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(57,232,62,0.8)' }}>REC ●</div>
              </div>
              {!isMobile && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.7)' }}>VID 1280×720 / MJPEG</span>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,170,255,0.5)' }}>{orientAvailable ? 'GYRO: ACTIVE' : 'GYRO: OFFLINE'}</span>
                </div>
              )}
            </>
          )}

          {/* Duplicate alert */}
          {dupAlert && (
            <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '8px 20px', border: '1px solid var(--muted)', pointerEvents: 'none' }}>
              <span style={{ fontSize: 11, letterSpacing: 3, color: '#f59e0b' }}>⚠ DUPLICATE FRAME — MOVE CAMERA</span>
            </div>
          )}

          {/* Flash */}
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: 0.7, zIndex: 10, pointerEvents: 'none' }} />}

          {/* Mobile panel */}
          {isMobile && (
            <MobilePanel
              status={status} frameCount={frameCount} frames={frames}
              statusColor={statusColor} isLive={isLive}
              guidance={guidance}
              orientationHistory={orientHistory}
              orientPermitted={orientPermitted}
              onStart={startCamera} onCapture={captureFrame}
              onStop={handleStop} onRetry={startCamera}
              onDeleteFrame={deleteFrame} onExport={exportZip}
              onRequestOrientation={requestOrientation}
              onUpload={handleUpload}
              uploadStatus={uploadStatus}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              reconStatus={reconStatus}
              reconConnected={reconConnected}
            />
          )}
        </div>

        {/* Desktop right panel */}
        {!isMobile && (
          <div style={{ width: 260, borderLeft: '1px solid var(--muted)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

            {/* System status */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 12 }}>SYSTEM STATUS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'SIGNAL',        on: isLive,                   color: 'var(--green)' },
                  { label: 'STREAM',        on: isLive,                   color: 'var(--blue)'  },
                  { label: 'CAPTURE READY', on: status === STATUS.LOCKED, color: 'var(--green)' },
                  { label: 'GYROSCOPE',     on: orientAvailable,          color: 'var(--blue)'  },
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

            {/* Stats */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatBadge label="STATUS"  value={status}                              color={statusColor}            />
              <StatBadge label="FRAMES"  value={String(frameCount).padStart(4,'0')}  color="var(--green)"           />
              <StatBadge label="QUALITY" value={`${guidance.quality}%`}              color={guidance.phase.color}   />
              <StatBadge label="PHASE"   value={`P${guidance.phaseIndex + 1}`}        color="var(--blue)"            />
            </div>

            {/* Scan phase */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 10 }}>SCAN PHASE</div>
              {guidance.phases.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: i <= guidance.phaseIndex ? p.color : 'var(--muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: i === guidance.phaseIndex ? p.color : 'var(--text-dim)' }}>{p.label}</div>
                    {i === guidance.phaseIndex && (
                      <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--text-dim)', marginTop: 2 }}>{p.instruction}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Coverage map */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>COVERAGE MAP</div>
              <div style={{ border: '1px solid var(--muted)', background: '#020810' }}>
                <CoverageMap frameCount={frameCount} orientationHistory={orientHistory} />
              </div>
              {!orientPermitted && (
                <button onClick={requestOrientation} style={{ width: '100%', marginTop: 8, padding: '8px 0', background: 'rgba(0,170,255,0.06)', border: '1px solid var(--blue-dim)', color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 3, cursor: 'pointer' }}>
                  ⊕ ENABLE GYROSCOPE
                </button>
              )}
            </div>

            {/* Controls */}
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
                <button onClick={handleStop} style={{ padding: '10px 0', background: 'transparent', border: '1px solid var(--muted)', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 3, cursor: 'pointer', transition: 'all 0.15s' }}
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

            {/* Pipeline status — appears after upload */}
            {reconstructionId && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--muted)' }}>
                <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>PIPELINE</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, letterSpacing: 2, color: reconStatus === 'COMPLETE' ? 'var(--green)' : reconStatus === 'FAILED' ? 'var(--red)' : '#f59e0b' }}>
                    {reconStatus || 'QUEUED'}
                  </span>
                  <Dot on={reconConnected} color="var(--green)" />
                </div>
                <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--text-dim)', wordBreak: 'break-all', marginBottom: meshUrl ? 10 : 0 }}>
                  {reconstructionId}
                </div>
                {meshUrl && (
                  <button onClick={() => setViewerOpen(true)} style={{
                    width: '100%', padding: '8px 0',
                    background: 'rgba(57,232,62,0.1)',
                    border: '1px solid var(--green)',
                    color: 'var(--green)',
                    fontFamily: 'var(--mono)', fontSize: 11,
                    letterSpacing: 3, cursor: 'pointer'
                  }}>▶ VIEW 3D MESH</button>
                )}
              </div>
            )}

            {/* Level progress */}
            <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid var(--muted)' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 10 }}>LEVEL PROGRESS</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, background: i < 3 ? 'var(--green)' : 'var(--muted)', opacity: i < 3 ? 1 : 0.4 }} />
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>3 / 20</div>
            </div>
          </div>
        )}
      </div>

      {/* Frame strip — desktop */}
      {!isMobile && (
        <FrameStrip
          frames={frames}
          onDelete={deleteFrame}
          onExport={exportZip}
          onUpload={handleUpload}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          reconStatus={reconStatus}
          reconConnected={reconConnected}
        />
      )}

      {/* Bottom status bar — desktop */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 20px', borderTop: '1px solid var(--muted)', background: 'var(--bg-panel)', fontSize: 10, letterSpacing: 2, color: 'var(--text-dim)', flexShrink: 0 }}>
          <span style={{ color: 'var(--green)' }}>DIGI</span>
          <span style={{ color: 'var(--blue)', marginLeft: -18 }}>ARCH</span>
          <span style={{ marginLeft: -12 }}>424</span>
          <span style={{ color: 'var(--muted)' }}>|</span>
          <span>DESIGN — BUILD — ITERATE</span>
          <span style={{ color: 'var(--muted)' }}>|</span>
          <span>LAYER: BROWSER / L03</span>
          <span style={{ marginLeft: 'auto', color: statusColor }}>● {status}</span>
        </div>
      )}

      {/* Mesh viewer — full screen overlay */}
      {viewerOpen && meshUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <MeshViewer
            meshUrl={meshUrl}
            sessionId={sessionId.current}
            onClose={() => setViewerOpen(false)}
          />
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
