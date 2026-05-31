import { useState } from 'react'
import { Dot, StatBadge }   from './Primitives'
import { FrameStrip }       from './FrameStrip'
import { CoverageMap }      from './CoverageMap'

const STATUS = { IDLE: 'IDLE', ACQUIRING: 'ACQUIRING', LOCKED: 'LOCKED', CAPTURED: 'CAPTURED', ERROR: 'ERROR' }

export function MobilePanel({
  status, frameCount, frames, statusColor, isLive,
  guidance, orientationHistory, orientPermitted,
  onStart, onCapture, onStop, onRetry,
  onDeleteFrame, onExport, onRequestOrientation
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
      background: 'rgba(7,21,38,0.96)',
      borderTop: '1px solid var(--muted)',
      backdropFilter: 'blur(8px)'
    }}>

      {/* Handle + status strip */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Dot on={isLive} color="var(--green)" />
          <span style={{ fontSize: 11, letterSpacing: 3, color: statusColor }}>{status}</span>
          {guidance && (
            <span style={{ fontSize: 10, letterSpacing: 2, color: guidance.phase.color }}>
              {guidance.phase.short}
            </span>
          )}
          <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)' }}>
            {String(frameCount).padStart(4, '0')} / 30
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>
          {expanded ? '▼ CLOSE' : '▲ EXPAND'}
        </span>
      </div>

      {/* Primary action — always visible */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 10 }}>
        {status === STATUS.IDLE && (
          <button onClick={onStart} style={{ flex: 1, padding: '16px 0', background: 'rgba(57,232,62,0.1)', border: '1px solid var(--green)', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 14, letterSpacing: 3, cursor: 'pointer' }}>
            ▶ INITIALIZE CAMERA
          </button>
        )}
        {status === STATUS.ACQUIRING && (
          <div style={{ flex: 1, padding: '16px 0', textAlign: 'center', fontSize: 13, letterSpacing: 3, color: 'var(--green)' }}>
            ◌ ACQUIRING SIGNAL...
          </div>
        )}
        {status === STATUS.LOCKED && (
          <>
            <button onClick={onCapture} style={{ flex: 2, padding: '16px 0', background: 'rgba(57,232,62,0.12)', border: '1px solid var(--green)', color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 14, letterSpacing: 3, cursor: 'pointer' }}>
              ◉ CAPTURE
            </button>
            <button onClick={onStop} style={{ flex: 1, padding: '16px 0', background: 'transparent', border: '1px solid var(--muted)', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: 2, cursor: 'pointer' }}>
              ■ STOP
            </button>
          </>
        )}
        {status === STATUS.ERROR && (
          <button onClick={onRetry} style={{ flex: 1, padding: '16px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: 3, cursor: 'pointer' }}>
            ↺ RETRY
          </button>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--muted)' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '16px 20px 12px' }}>
            <StatBadge label="STATUS"  value={status.slice(0, 4)}              color={statusColor}   />
            <StatBadge label="FRAMES"  value={String(frameCount).padStart(4,'0')} color="var(--green)" />
            <StatBadge label="QUALITY" value={guidance ? `${guidance.quality}%` : '--'} color={guidance?.phase.color || 'var(--text-dim)'} />
            <StatBadge label="LAYER"   value="L03"                             color="var(--blue)"  />
          </div>

          {/* Orientation permission button — iOS only, before permission granted */}
          {isLive && !orientPermitted && (
            <div style={{ padding: '0 20px 12px' }}>
              <button onClick={onRequestOrientation} style={{ width: '100%', padding: '10px 0', background: 'rgba(0,170,255,0.08)', border: '1px solid var(--blue-dim)', color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 3, cursor: 'pointer' }}>
                ⊕ ENABLE GYROSCOPE
              </button>
            </div>
          )}

          {/* Phase instruction */}
          {guidance && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 6 }}>INSTRUCTION</div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: guidance.phase.color }}>
                {guidance.phase.instruction}
              </div>
            </div>
          )}

          {/* Coverage map */}
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>COVERAGE MAP</div>
            <div style={{ border: '1px solid var(--muted)', background: '#020810' }}>
              <CoverageMap frameCount={frameCount} orientationHistory={orientationHistory} />
            </div>
          </div>

          {/* Frame strip */}
          <FrameStrip frames={frames} onDelete={onDeleteFrame} onExport={onExport} />

          {/* Level progress */}
          <div style={{ padding: '12px 20px 16px' }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--text-dim)', marginBottom: 8 }}>LEVEL PROGRESS</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 4, background: i < 3 ? 'var(--green)' : 'var(--muted)', opacity: i < 3 ? 1 : 0.4 }} />
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2 }}>3 / 20</div>
          </div>
        </div>
      )}
    </div>
  )
}
