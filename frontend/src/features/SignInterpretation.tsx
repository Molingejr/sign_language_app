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
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Live view
            </h2>
            <WebcamCapture
              captureDurationMs={CAPTURE_MS}
              onStreamReady={onStreamReady}
              onCapture={onCapture}
              disabled={!!status}
            />
            {status && (
              <p
                className={`mt-2 text-sm ${status.startsWith('Error') ? 'text-red-600' : 'text-muted'}`}
              >
                {status}
              </p>
            )}
          </section>

          {lastResult && (
            <section className="rounded-xl border border-border bg-card px-4 py-3 shadow-card md:px-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                Last result
              </h2>
              <p className="text-lg font-semibold text-text">{lastResult.gloss}</p>
              <p className="mt-0.5 text-sm text-muted">
                Confidence: {(lastResult.confidence * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted">
                <span className="font-medium text-text">Top 5:</span>{' '}
                {lastResult.top_k.join(', ')}
              </p>
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
