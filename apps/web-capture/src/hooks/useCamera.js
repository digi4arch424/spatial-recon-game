import { useState, useRef, useCallback, useEffect } from 'react'
import { detectBlur, isDuplicate, getPixelSnapshot } from '../utils/imageAnalysis'

export const STATUS = {
  IDLE:      'IDLE',
  ACQUIRING: 'ACQUIRING',
  LOCKED:    'LOCKED',
  CAPTURED:  'CAPTURED',
  ERROR:     'ERROR'
}

// useCamera owns all camera hardware interaction:
// refs, stream lifecycle, capture logic, blur/dup detection.
// App.jsx wires the output to layout — nothing else.

export function useCamera({ onFrameCaptured }) {
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const streamRef     = useRef(null)
  const lastPixelsRef = useRef(null)

  const [status,     setStatus]     = useState(STATUS.IDLE)
  const [frameCount, setFrameCount] = useState(0)
  const [error,      setError]      = useState(null)
  const [flash,      setFlash]      = useState(false)
  const [dupAlert,   setDupAlert]   = useState(false)

  // ── Start camera stream ───────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus(STATUS.ACQUIRING)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720  }
        },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setStatus(STATUS.LOCKED)
        }
      }
    } catch (err) {
      setError(err.message || 'Camera access denied')
      setStatus(STATUS.ERROR)
    }
  }, [])

  // ── Capture a single frame ────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || status !== STATUS.LOCKED) return

    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    // Near-duplicate suppression
    if (isDuplicate(canvas, lastPixelsRef.current)) {
      setDupAlert(true)
      setTimeout(() => setDupAlert(false), 1200)
      return
    }

    const isBlurry = detectBlur(canvas)
    lastPixelsRef.current = getPixelSnapshot(canvas)

    const dataUrl   = canvas.toDataURL('image/jpeg', 0.92)
    const nextCount = frameCount + 1

    setFrameCount(nextCount)
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    setStatus(STATUS.CAPTURED)
    setTimeout(() => setStatus(STATUS.LOCKED), 800)

    // Delegate storage to caller (App.jsx → useFrameStore)
    await onFrameCaptured(dataUrl, nextCount, isBlurry)
  }, [status, frameCount, onFrameCaptured])

  // ── Stop camera stream ────────────────────────────────────────────────────
  // Only handles hardware — session clearing is App.jsx's responsibility
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    lastPixelsRef.current = null
    setStatus(STATUS.IDLE)
    setFrameCount(0)
    setError(null)
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  return {
    videoRef,
    canvasRef,
    status,
    frameCount,
    error,
    flash,
    dupAlert,
    isLive: status === STATUS.LOCKED || status === STATUS.CAPTURED,
    startCamera,
    captureFrame,
    stopCamera
  }
}
