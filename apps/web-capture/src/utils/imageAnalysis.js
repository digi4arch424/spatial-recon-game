// ─── BLUR DETECTION ──────────────────────────────────────────────────────────
// Downsamples the frame to 200x150 then applies a Laplacian filter.
// Low variance across the result means low edge detail = blurry frame.
// Threshold tuned for typical phone camera output.

export function detectBlur(sourceCanvas) {
  const w = 200, h = 150
  const temp = document.createElement('canvas')
  temp.width = w
  temp.height = h
  temp.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h)
  const { data } = temp.getContext('2d').getImageData(0, 0, w, h)

  let sum = 0, count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i    = (y * w + x) * 4
      const top  = ((y - 1) * w + x) * 4
      const bot  = ((y + 1) * w + x) * 4
      const left = (y * w + (x - 1)) * 4
      const rght = (y * w + (x + 1)) * 4

      const gray = (data[i]    + data[i+1]    + data[i+2])    / 3
      const gT   = (data[top]  + data[top+1]  + data[top+2])  / 3
      const gB   = (data[bot]  + data[bot+1]  + data[bot+2])  / 3
      const gL   = (data[left] + data[left+1] + data[left+2]) / 3
      const gR   = (data[rght] + data[rght+1] + data[rght+2]) / 3

      sum += Math.abs(4 * gray - gT - gB - gL - gR)
      count++
    }
  }
  return (sum / count) < 8
}

// ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────
// Downsamples to 16x16 and computes mean pixel difference against
// the last saved frame's snapshot. Low difference = near-identical frame.

export function isDuplicate(sourceCanvas, lastPixels) {
  if (!lastPixels) return false
  const s    = 16
  const temp = document.createElement('canvas')
  temp.width = s
  temp.height = s
  temp.getContext('2d').drawImage(sourceCanvas, 0, 0, s, s)
  const { data } = temp.getContext('2d').getImageData(0, 0, s, s)

  let diff = 0
  for (let i = 0; i < data.length; i += 4) {
    diff += Math.abs(data[i]   - lastPixels[i])
    diff += Math.abs(data[i+1] - lastPixels[i+1])
    diff += Math.abs(data[i+2] - lastPixels[i+2])
  }
  return (diff / (s * s * 3)) < 12
}

// ─── PIXEL SNAPSHOT ──────────────────────────────────────────────────────────
// Returns a 16x16 pixel snapshot of the current frame.
// Stored as the reference for the next duplicate check.

export function getPixelSnapshot(sourceCanvas) {
  const s    = 16
  const temp = document.createElement('canvas')
  temp.width = s
  temp.height = s
  temp.getContext('2d').drawImage(sourceCanvas, 0, 0, s, s)
  return temp.getContext('2d').getImageData(0, 0, s, s).data
}
