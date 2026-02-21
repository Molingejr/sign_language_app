import { useCallback, useRef, useState } from 'react'

import { predictFromVideoBlob } from '../api/client'
import { Transcript } from '../components/Transcript'
import { WebcamCapture } from '../components/WebcamCapture'

const CAPTURE_MS = 2600

export function SignInterpretation() {
  const [transcript, setTranscript] = useState<string[]>([])
  const [status, setStatus] = useState<string>('')
  const [lastResult, setLastResult] = useState<{
    gloss: string
    top_k: string[]
    confidence: number
  } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const onStreamReady = useCallback((stream: MediaStream) => {
    streamRef.current = stream
  }, [])

  const onCapture = useCallback(async (blob: Blob) => {
    setStatus('Interpreting…')
    setLastResult(null)
    try {
      const result = await predictFromVideoBlob(blob)
      setLastResult(result)
      if (result.gloss !== '(no sign)') {
        setTranscript((prev) => [...prev, result.gloss])
      }
      setStatus('')
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    setLastResult(null)
    setStatus('')
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        {/* Main: large live view + result */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border-2 border-border bg-card p-3 shadow-card md:p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Live view
            </h2>
            <p className="mb-3 text-xs text-muted">
              Ensure good lighting and keep hands visible in frame.
            </p>
            <WebcamCapture
              captureDurationMs={CAPTURE_MS}
              onStreamReady={onStreamReady}
              onCapture={onCapture}
              disabled={!!status}
            />
            {status && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                {!status.startsWith('Error') && (
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
                    aria-hidden
                  />
                )}
                <p
                  className={`m-0 ${status.startsWith('Error') ? 'text-red-600' : 'text-muted'}`}
                >
                  {status}
                </p>
              </div>
            )}
          </section>

          {lastResult && (
            <section className="rounded-xl border border-border bg-card px-4 py-4 shadow-card md:px-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Last result
              </h2>
              <p className="text-xl font-semibold tracking-tight text-text">
                {lastResult.gloss}
              </p>
              <div className="mt-3">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>Confidence</span>
                  <span>{(lastResult.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${Math.min(100, lastResult.confidence * 100)}%` }}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">
                Top 5
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {lastResult.top_k.map((gloss, i) => (
                  <span
                    key={`${gloss}-${i}`}
                    className={`rounded-md border px-2 py-0.5 text-[0.8125rem] ${
                      i === 0
                        ? 'border-accent bg-accent/10 font-medium text-text'
                        : 'border-border bg-card text-muted'
                    }`}
                  >
                    {gloss}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Side panel: transcript */}
        <aside className="flex min-h-[200px] flex-col xl:min-h-[520px]">
          <Transcript
            items={transcript}
            onClear={clearTranscript}
            alwaysShow
          />
        </aside>
      </div>
    </div>
  )
}
