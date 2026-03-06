import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { predictFingerspelling } from '../api/client'

const HAND_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
/** How often we send landmarks to the backend (ms). */
const SEND_INTERVAL_MS = 380
/** Same letter must be predicted this many times in a row before we add it to the word. */
const STABLE_COUNT_REQUIRED = 2
/** Minimum confidence to add a letter (lower = easier to add letters like L). */
const MIN_CONFIDENCE_TO_ADD = 0.35

// MediaPipe hand landmark connections (index pairs) for drawing the skeleton
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // index
  [0, 9], [9, 10], [10, 11], [11, 12],      // middle
  [0, 13], [13, 14], [14, 15], [15, 16],    // ring
  [0, 17], [17, 18], [18, 19], [19, 20],    // pinky
  [5, 9], [9, 13], [13, 17],                 // palm
]

function landmarksToArray(hand: NormalizedLandmark[]): number[][] {
  return hand.map((p) => [p.x, p.y, p.z])
}

function drawLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mirror: boolean
) {
  if (landmarks.length < 21) return
  const scaleX = (x: number) => (mirror ? (1 - x) * width : x * width)
  const scaleY = (y: number) => y * height

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)'
  ctx.fillStyle = 'rgba(0, 255, 136, 0.8)'
  ctx.lineWidth = 2

  for (const [a, b] of HAND_CONNECTIONS) {
    const p1 = landmarks[a]
    const p2 = landmarks[b]
    if (!p1 || !p2) continue
    ctx.beginPath()
    ctx.moveTo(scaleX(p1.x), scaleY(p1.y))
    ctx.lineTo(scaleX(p2.x), scaleY(p2.y))
    ctx.stroke()
  }

  const r = 4
  for (const p of landmarks) {
    ctx.beginPath()
    ctx.arc(scaleX(p.x), scaleY(p.y), r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function FingerSpelling() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const lastSendRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const [letter, setLetter] = useState<string>('')
  const [confidence, setConfidence] = useState<number>(0)
  const [topK, setTopK] = useState<string[]>([])
  const [word, setWord] = useState<string>('') // accumulated translation (spelled word)
  const [status, setStatus] = useState<string>('Loading…')
  const [error, setError] = useState<string | null>(null)
  const [handVisible, setHandVisible] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const lastAddedLetterRef = useRef<string>('')
  const lastPredictedLetterRef = useRef<string>('')
  const stableCountRef = useRef<number>(0)

  const sendLandmarks = useCallback(async (landmarks: number[][]) => {
    if (landmarks.length !== 21) return
    try {
      const result = await predictFingerspelling(landmarks)
      setLetter(result.letter)
      setConfidence(result.confidence)
      setTopK(result.top_k ?? [])
      if (!result.letter) {
        lastAddedLetterRef.current = ''
        lastPredictedLetterRef.current = ''
        stableCountRef.current = 0
        return
      }
      if (result.letter === lastPredictedLetterRef.current) {
        stableCountRef.current += 1
      } else {
        lastPredictedLetterRef.current = result.letter
        stableCountRef.current = 1
      }
      const isStable = stableCountRef.current >= STABLE_COUNT_REQUIRED
      const confidentEnough = result.confidence >= MIN_CONFIDENCE_TO_ADD
      if (isStable && confidentEnough && result.letter !== lastAddedLetterRef.current) {
        lastAddedLetterRef.current = result.letter
        setWord((prev) => prev + result.letter)
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  // Init: load MediaPipe model + get webcam stream
  useEffect(() => {
    let cancelled = false
    const video = videoRef.current
    if (!video) return

    const init = async () => {
      try {
        setStatus('Loading hand model…')
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL_PATH },
          numHands: 1,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        })
        if (cancelled) return
        handLandmarkerRef.current = handLandmarker

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        setStatus('')
        setError(null)
        setModelReady(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Camera or model failed')
          setStatus('')
        }
      }
    }
    init()
    return () => {
      cancelled = true
      setModelReady(false)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      handLandmarkerRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Detection loop: only runs when model + stream are ready
  useEffect(() => {
    if (!modelReady) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const handLandmarker = handLandmarkerRef.current
    if (!video || !canvas || !handLandmarker || !video.srcObject) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      if (video.readyState < 2) return

      const w = video.clientWidth
      const h = video.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      const now = performance.now()
      try {
        const result = handLandmarker.detectForVideo(video, now)
        const hands = result?.landmarks ?? []
        if (hands.length === 0) {
          setHandVisible(false)
          lastAddedLetterRef.current = ''
          lastPredictedLetterRef.current = ''
          stableCountRef.current = 0
          ctx.clearRect(0, 0, w, h)
          return
        }
        setHandVisible(true)
        const hand = hands[0]
        if (hand.length === 21) {
          drawLandmarksOnCanvas(ctx, hand, w, h, false)
          if (now - lastSendRef.current >= SEND_INTERVAL_MS) {
            lastSendRef.current = now
            sendLandmarks(landmarksToArray(hand))
          }
        } else {
          ctx.clearRect(0, 0, w, h)
        }
      } catch (err) {
        console.error('Hand detection error:', err)
        setHandVisible(false)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [modelReady, sendLandmarks])

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Spell words letter by letter using hand shapes. Show one hand to the
        camera and hold each letter briefly — the letter is added after it’s
        recognized twice in a row.
      </p>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <section className="flex flex-col gap-4">
        <div className="relative w-full overflow-hidden rounded-xl border-2 border-border bg-slate-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="block w-full min-h-[320px] aspect-video object-cover scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
            style={{ left: 0, top: 0 }}
            aria-hidden
          />
          {status && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-white"
              aria-hidden
            >
              {status}
            </div>
          )}
          {!status && !handVisible && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-sm text-white"
              aria-hidden
            >
              Show your hand in frame — green overlay appears when detected
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/50 px-6 py-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Translation
          </p>
          <p className="mt-2 min-h-[3rem] break-all text-2xl font-semibold tracking-wide text-foreground">
            {word || <span className="text-muted">Spell letters — word appears here</span>}
          </p>
          {word && (
            <button
              type="button"
              onClick={() => {
                setWord('')
                lastAddedLetterRef.current = ''
                lastPredictedLetterRef.current = ''
                stableCountRef.current = 0
              }}
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              Clear word
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/50 px-6 py-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Current letter
          </p>
          <p className="mt-2 text-4xl font-bold tracking-wider text-foreground">
            {letter || '—'}
          </p>
          {letter && (
            <p className="mt-1 text-sm text-muted">
              Confidence: {(confidence * 100).toFixed(0)}%
            </p>
          )}
          {topK.length > 1 && (
            <p className="mt-2 text-xs text-muted">
              Top: {topK.join(', ')}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
