import { useState, useEffect } from 'react'

export function CornerBrackets({ color = 'var(--green)', size = 24, thickness = 2, gap = 14 }) {
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

export function Crosshair({ active }) {
  const c = active ? 'var(--green)' : 'var(--muted)'
  return (
    <svg
      style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 60, height: 60,
        opacity: active ? 1 : 0.4,
        transition: 'opacity 0.3s'
      }}
      viewBox="0 0 60 60"
      fill="none"
    >
      <circle cx="30" cy="30" r="10" stroke={c} strokeWidth="1" />
      <line x1="30" y1="0"  x2="30" y2="16" stroke={c} strokeWidth="1" />
      <line x1="30" y1="44" x2="30" y2="60" stroke={c} strokeWidth="1" />
      <line x1="0"  y1="30" x2="16" y2="30" stroke={c} strokeWidth="1" />
      <line x1="44" y1="30" x2="60" y2="30" stroke={c} strokeWidth="1" />
    </svg>
  )
}

export function ScanLine({ scanning }) {
  const [pos, setPos] = useState(0)

  useEffect(() => {
    if (!scanning) return
    let frame, p = 0
    const animate = () => {
      p = (p + 0.4) % 100
      setPos(p)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [scanning])

  if (!scanning) return null

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      top: `${pos}%`, height: 2,
      background: 'linear-gradient(90deg, transparent, rgba(57,232,62,0.6), transparent)',
      pointerEvents: 'none', zIndex: 4
    }} />
  )
}
