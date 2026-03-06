/**
 * Motion-based segmentation: sample video frames, compute frame diff.
 * When motion is low for STILL_MS after MIN_RECORD_MS, treat as end of sign.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SAMPLE_INTERVAL_MS = 100
const MOTION_HIGH_THRESHOLD = 12
const MOTION_LOW_THRESHOLD = 4
const STILL_MS = 400
const MIN_RECORD_MS = 1200
const MAX_RECORD_MS = 4000
const CANVAS_SIZE = 32

export interface SegmentConfig {
  minRecordMs: number
  maxRecordMs: number
  stillMs: number
  motionHigh: number
  motionLow: number
}

export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  minRecordMs: MIN_RECORD_MS,
  maxRecordMs: MAX_RECORD_MS,
  stillMs: STILL_MS,
  motionHigh: MOTION_HIGH_THRESHOLD,
  motionLow: MOTION_LOW_THRESHOLD,
}

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) sum += Math.abs(a[i] - b[i])
  return len ? sum / len : 0
}

export interface UseMotionSegmentOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled: boolean
  onSegmentReady: (blob: Blob) => void
  config?: Partial<SegmentConfig>
}

export function useMotionSegment({
  videoRef,
  enabled,
  onSegmentReady,
  config = {},
}: UseMotionSegmentOptions): {
  recording: boolean
  error: string | null
  startRecording: () => void
  stopRecording: () => void
} {
  const cfg: SegmentConfig = { ...DEFAULT_SEGMENT_CONFIG, ...config }
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const prevDataRef = useRef<Uint8ClampedArray | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stillSinceRef = useRef<number | null>(null)
  const recordingStartRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(() => {
    const video = videoRef.current
    const stream = video?.srcObject as MediaStream | null
    if (!stream || recording) return
    if (recorderRef.current?.state === 'recording') return
    streamRef.current = stream
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      if (chunksRef.current.length) {
        const blob = new Blob(chunksRef.current, { type: mime })
        onSegmentReady(blob)
      }
      setRecording(false)
    }
    recorder.start(200)
    recorderRef.current = recorder
    recordingStartRef.current = Date.now()
    stillSinceRef.current = null
    setRecording(true)
  }, [videoRef, recording, onSegmentReady])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      recorderRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !videoRef.current) return
    const video = videoRef.current
    if (video.readyState < 2) return
    let canvas = canvasRef.current
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = CANVAS_SIZE
      canvas.height = CANVAS_SIZE
      canvasRef.current = canvas
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    const run = () => {
      if (video.readyState < 2) return
      ctx.drawImage(video, 0, 0, width, height, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      const img = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      const data = img.data
      const prev = prevDataRef.current
      prevDataRef.current = data.slice(0)

      let motion = 0
      if (prev) motion = meanAbsDiff(prev, data)

      const now = Date.now()
      const isRecording = recorderRef.current?.state === 'recording'
      if (isRecording) {
        const elapsed = now - recordingStartRef.current
        if (elapsed >= cfg.maxRecordMs) {
          stopRecording()
          return
        }
        if (motion < cfg.motionLow) {
          if (stillSinceRef.current === null) stillSinceRef.current = now
          const stillDuration = now - stillSinceRef.current
          if (elapsed >= cfg.minRecordMs && stillDuration >= cfg.stillMs) {
            stopRecording()
            return
          }
        } else {
          stillSinceRef.current = null
        }
      } else {
        if (motion >= cfg.motionHigh) startRecording()
      }
    }

    intervalId = setInterval(run, SAMPLE_INTERVAL_MS)
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [enabled, videoRef, cfg.minRecordMs, cfg.maxRecordMs, cfg.stillMs, cfg.motionHigh, cfg.motionLow, startRecording, stopRecording])

  return { recording, error, startRecording, stopRecording }
}
