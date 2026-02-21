import { useCallback, useEffect, useRef, useState } from 'react'

interface WebcamCaptureProps {
  captureDurationMs: number
  onStreamReady: (stream: MediaStream) => void
  onCapture: (blob: Blob) => void
  disabled?: boolean
}

export function WebcamCapture({
  captureDurationMs,
  onStreamReady,
  onCapture,
  disabled,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    const video = videoRef.current
    if (!video) return
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        })
        streamRef.current = stream
        video.srcObject = stream
        onStreamReady(stream)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera access failed')
      }
    }
    start()
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [onStreamReady])

  const startCapture = useCallback(() => {
    const stream = streamRef.current
    if (!stream || disabled || recording) return
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 1_500_000,
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.onstop = () => {
      if (chunks.length) {
        const blob = new Blob(chunks, { type: mime })
        onCapture(blob)
      }
      setRecording(false)
    }
    recorder.start(200)
    mediaRecorderRef.current = recorder
    setRecording(true)
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, captureDurationMs)
  }, [captureDurationMs, disabled, recording, onCapture])

  if (error) {
    return (
      <div className="py-2">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-border bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block w-full min-h-[320px] aspect-video object-cover scale-x-[-1] sm:min-h-[400px] md:min-h-[480px]"
        />
        {recording && (
          <div
            className="pointer-events-none absolute inset-0 flex items-start justify-start gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 py-3 text-[0.8125rem] font-medium text-white"
            aria-hidden
          >
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse-dot" />
            <span>Recording… {(captureDurationMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="w-fit cursor-pointer rounded-lg border-0 bg-accent px-5 py-2.5 text-[0.9375rem] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={startCapture}
        disabled={disabled || recording}
      >
        {recording
          ? `Recording… (${(captureDurationMs / 1000).toFixed(1)}s)`
          : 'Capture & interpret'}
      </button>
    </div>
  )
}
