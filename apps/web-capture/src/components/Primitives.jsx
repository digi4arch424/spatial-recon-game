import { useTick } from '../hooks/useTick'

export function Dot({ on, color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: on ? color : 'var(--muted)',
      boxShadow: on ? `0 0 6px ${color}` : 'none',
      transition: 'all 0.2s'
    }} />
  )
}

export function StatBadge({ label, value, color = 'var(--blue)' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '6px 14px',
      border: '1px solid var(--muted)',
      background: 'var(--bg-panel)'
    }}>
      <span style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, letterSpacing: 2, color, fontFamily: 'var(--mono)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

export function Clock() {
  useTick()
  const now = new Date()
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--blue)', letterSpacing: 2 }}>
      {now.toISOString().replace('T', ' ').slice(0, 19)} UTC
    </span>
  )
}
