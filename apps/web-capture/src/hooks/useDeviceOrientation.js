import { useState, useEffect, useCallback } from 'react'

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState({ alpha: null, beta: null, gamma: null })
  const [permitted,   setPermitted]   = useState(false)
  const [available,   setAvailable]   = useState(false)

  // ── Request permission (required on iOS 13+) ──────────────────────────────
  const requestPermission = useCallback(async () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result === 'granted') setPermitted(true)
      } catch {
        // User denied or gesture requirement not met
      }
    } else {
      // Android / desktop — no permission needed
      setPermitted(true)
    }
  }, [])

  // ── Listen for orientation events once permitted ───────────────────────────
  useEffect(() => {
    if (!permitted) return
    const handler = (e) => {
      if (e.alpha !== null) {
        setAvailable(true)
        setOrientation({ alpha: e.alpha, beta: e.beta, gamma: e.gamma })
      }
    }
    window.addEventListener('deviceorientation', handler, true)
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [permitted])

  return { orientation, available, permitted, requestPermission }
}
