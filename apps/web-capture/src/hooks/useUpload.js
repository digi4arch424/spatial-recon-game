import { useState, useCallback } from 'react'
import { apiPost, apiGet } from '../api/client'

// Upload state machine
export const UPLOAD_STATUS = {
  IDLE:             'IDLE',
  REGISTERING:      'REGISTERING',
  UPLOADING_FRAMES: 'UPLOADING_FRAMES',
  SUBMITTING:       'SUBMITTING',
  QUEUED:           'QUEUED',
  ERROR:            'ERROR'
}

export function useUpload() {
  const [uploadStatus,     setUploadStatus]     = useState(UPLOAD_STATUS.IDLE)
  const [reconstructionId, setReconstructionId] = useState(null)
  const [progress,         setProgress]         = useState(0)
  const [progressLabel,    setProgressLabel]    = useState('')
  const [error,            setError]            = useState(null)

  // ── Main upload function ──────────────────────────────────────────────────
  // frames: array from useFrameStore — each frame has dataUrl, frameNumber,
  //         timestamp, isBlurry. Uploaded one at a time directly to S3
  //         via presigned PUT URLs. No ZIP, no memory explosion.

  const upload = useCallback(async (sessionId, frames) => {
    if (!frames || frames.length === 0) {
      setError('No frames to upload')
      setUploadStatus(UPLOAD_STATUS.ERROR)
      return null
    }

    setError(null)
    setProgress(0)

    try {
      // ── Step 1: Register session ──────────────────────────────────────────
      setUploadStatus(UPLOAD_STATUS.REGISTERING)
      setProgressLabel('Registering session...')

      await apiPost('/sessions', {
        id:          sessionId,
        frame_count: frames.length
      })
      setProgress(5)

      // ── Step 2: Upload each frame directly to S3 ──────────────────────────
      setUploadStatus(UPLOAD_STATUS.UPLOADING_FRAMES)
      const uploadedFrames = []

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]
        setProgressLabel(`Uploading frame ${i + 1} of ${frames.length}`)

        // Get presigned PUT URL from API
        const { url, s3_key } = await apiGet(
          `/sessions/${sessionId}/frames/${frame.frameNumber}/presign`
        )

        // Convert dataUrl to Blob — one frame at a time, no memory buildup
        const res  = await fetch(frame.dataUrl)
        const blob = await res.blob()

        // Upload directly from browser to S3 — API never touches the bytes
        await fetch(url, {
          method:  'PUT',
          body:    blob,
          headers: { 'Content-Type': 'image/jpeg' }
        })

        uploadedFrames.push({
          frame_number: frame.frameNumber,
          s3_key,
          timestamp:    frame.timestamp,
          is_blurry:    frame.isBlurry || false
        })

        // Progress: 5% register + 85% frames + 10% submit
        setProgress(5 + Math.round(((i + 1) / frames.length) * 85))
      }

      // ── Step 3: Submit manifest — triggers reconstruction job ─────────────
      setUploadStatus(UPLOAD_STATUS.SUBMITTING)
      setProgressLabel('Starting reconstruction...')

      const result = await apiPost(`/sessions/${sessionId}/manifest`, {
        frames: uploadedFrames
      })
      setProgress(100)

      setReconstructionId(result.reconstruction_id)
      setUploadStatus(UPLOAD_STATUS.QUEUED)
      setProgressLabel('')
      return result.reconstruction_id

    } catch (err) {
      setError(err.message)
      setUploadStatus(UPLOAD_STATUS.ERROR)
      setProgressLabel('')
      return null
    }
  }, [])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetUpload = useCallback(() => {
    setUploadStatus(UPLOAD_STATUS.IDLE)
    setReconstructionId(null)
    setProgress(0)
    setProgressLabel('')
    setError(null)
  }, [])

  return {
    uploadStatus,
    reconstructionId,
    progress,
    progressLabel,
    error,
    upload,
    resetUpload
  }
}
