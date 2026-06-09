import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { openDB, STORE } from '../db/frameDB'

export function useFrameStore(sessionId) {
  const [frames, setFrames] = useState([])

  // ── Save a single frame ───────────────────────────────────────────────────
  const saveFrame = useCallback(async (dataUrl, frameNumber, isBlurry) => {
    const db    = await openDB()
    const frame = {
      sessionId,
      frameNumber,
      timestamp: Date.now(),
      dataUrl,
      isBlurry,
      name: `session-${sessionId}/frame-${String(frameNumber).padStart(3, '0')}-${Date.now()}.jpg`
    }
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).add(frame)
      request.onsuccess = () => {
        const saved = { ...frame, id: request.result }
        setFrames(f => [...f, saved])
        resolve(saved)
      }
      request.onerror = () => reject(request.error)
    })
  }, [sessionId])

  // ── Load all frames for this session ─────────────────────────────────────
  const loadSession = useCallback(async () => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE, 'readonly')
      const index   = tx.objectStore(STORE).index('sessionId')
      const request = index.getAll(sessionId)
      request.onsuccess = () => {
        setFrames(request.result)
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })
  }, [sessionId])

  // ── Delete a single frame by id ───────────────────────────────────────────
  const deleteFrame = useCallback(async (id) => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).delete(id)
      request.onsuccess = () => {
        setFrames(f => f.filter(frame => frame.id !== id))
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }, [])

  // ── Clear all frames for this session ────────────────────────────────────
  const clearSession = useCallback(async () => {
    const db       = await openDB()
    const allFrames = await new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).index('sessionId').getAll(sessionId)
      request.onsuccess = () => resolve(request.result)
      request.onerror  = () => reject(request.error)
    })
    const db2 = await openDB()
    await Promise.all(allFrames.map(frame =>
      new Promise((resolve, reject) => {
        const tx      = db2.transaction(STORE, 'readwrite')
        const request = tx.objectStore(STORE).delete(frame.id)
        request.onsuccess = () => resolve()
        request.onerror   = () => reject(request.error)
      })
    ))
    setFrames([])
  }, [sessionId])

  // ── Export all session frames as a ZIP download (local save only) ───────────
  // Not used for pipeline upload — frames upload directly to S3 per frame.
  const exportZip = useCallback(async () => {
    if (frames.length === 0) return
    const zip    = new JSZip()
    const folder = zip.folder(`session-${sessionId}`)
    frames.forEach(frame => {
      const base64 = frame.dataUrl.split(',')[1]
      folder.file(
        `frame-${String(frame.frameNumber).padStart(3, '0')}-${frame.timestamp}.jpg`,
        base64,
        { base64: true }
      )
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `session-${sessionId}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }, [frames, sessionId])

  return { frames, saveFrame, loadSession, deleteFrame, clearSession, exportZip }
}
