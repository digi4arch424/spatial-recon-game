import { useState } from 'react'
import { CornerBrackets } from './HudOverlays'
import { Dot, StatBadge } from './Primitives'

const STATUS = { IDLE: 'IDLE', ACQUIRING: 'ACQUIRING', LOCKED: 'LOCKED', CAPTURED: 'CAPTURED', ERROR: 'ERROR' }

export function MobilePanel({
  status, frameCount, captured, statusColor, isLive,
  onStart, onCapture, onStop, onRetry, onClear
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
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', cursor: 'pointer', userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Dot on={isLive} color="var(--green)" />
          <span style={{ fontSize: 11, letterSpacing: 3, color: statusColor }}>{status}</span>
          <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)' }}>
            FRAMES: {String(frameCount).padStart(4, '0')}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>
          {expanded ? '▼ CLOSE' : '▲ EXPAND'}
        </span>
      </div>

      {/* Primary action — always visible */}
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
        <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--muted)' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <StatBadge label="STATUS" value={status.slice(0, 4)} color={statusColor} />
            <StatBadge label="FRAMES" value={String(frameCount).padStart(4, '0')} color="var(--green)" />
            <StatBadge label="LAYER"  value="L01" color="var(--blue)" />
            <StatBadge label="MODULE" value="CAM"  color="var(--text)" />
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
