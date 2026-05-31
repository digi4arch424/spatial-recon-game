import { useMemo } from 'react'

const FRAME_TARGET = 30

export const PHASES = [
  {
    id:          'BASELINE',
    range:       [0, 7],
    label:       'PHASE 1 — BASELINE',
    instruction: 'WALK SLOWLY AROUND SUBJECT AT EYE LEVEL',
    short:       'ORBIT SUBJECT',
    color:       '#ef4444'
  },
  {
    id:          'ELEVATION',
    range:       [8, 15],
    label:       'PHASE 2 — ELEVATION',
    instruction: 'MOVE HIGHER — AIM CAMERA DOWNWARD',
    short:       'MOVE HIGHER',
    color:       '#f59e0b'
  },
  {
    id:          'DETAIL',
    range:       [16, 23],
    label:       'PHASE 3 — DETAIL',
    instruction: 'MOVE CLOSE — CAPTURE SURFACE DETAILS',
    short:       'CLOSE DETAIL',
    color:       '#f59e0b'
  },
  {
    id:          'COMPLETE',
    range:       [24, 30],
    label:       'PHASE 4 — COMPLETE',
    instruction: 'COVERAGE COMPLETE — READY TO EXPORT',
    short:       'COMPLETE',
    color:       '#39e83e'
  }
]

// ── Orientation-aware directional prompt ──────────────────────────────────────
// When gyroscope data is available, give specific movement hints.

function getOrientationPrompt(phase, orientation) {
  if (!orientation || orientation.alpha === null) return null
  const { beta } = orientation

  if (phase.id === 'BASELINE' && Math.abs(beta) > 30) return 'LEVEL CAMERA — FACE SUBJECT'
  if (phase.id === 'ELEVATION' && beta > -20)         return 'TILT CAMERA DOWN MORE'
  if (phase.id === 'DETAIL'    && Math.abs(beta) > 45) return 'HOLD CAMERA STEADIER'
  return null
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useScanGuidance(frameCount, orientation) {
  return useMemo(() => {
    const phase = PHASES.find(
      p => frameCount >= p.range[0] && frameCount <= p.range[1]
    ) || PHASES[PHASES.length - 1]

    const phaseIndex    = PHASES.indexOf(phase)
    const [min, max]    = phase.range
    const phaseProgress = Math.min((frameCount - min) / (max - min + 1), 1)
    const quality       = Math.min(Math.round((frameCount / FRAME_TARGET) * 100), 100)
    const orientPrompt  = getOrientationPrompt(phase, orientation)

    return {
      phase,
      phaseIndex,
      phaseProgress,
      quality,
      phases: PHASES,
      prompt: orientPrompt || phase.short
    }
  }, [frameCount, orientation])
}
