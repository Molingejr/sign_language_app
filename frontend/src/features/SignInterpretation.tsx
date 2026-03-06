import { useCallback, useEffect, useRef, useState } from 'react'

import { glossToSentence, predictFromVideoBlob, predictSentenceFromVideoBlob } from '../api/client'
import { Transcript } from '../components/Transcript'
import { WebcamCapture } from '../components/WebcamCapture'
import { speak } from '../utils/speech'

const CAPTURE_MS = 2600

export function SignInterpretation() {
  const [transcript, setTranscript] = useState<string[]>([])
  const [sentence, setSentence] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [segmentMode, setSegmentMode] = useState(true)
  const [lastResult, setLastResult] = useState<{
    gloss: string
    top_k: string[]
    confidence: number
  } | null>(null)
  const [uploadMode, setUploadMode] = useState<'single' | 'sentence'>('single')
  const [sentenceUploadResult, setSentenceUploadResult] = useState<{
    glosses: string[]
    sentence: string
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
    setSentence('')
    setLastResult(null)
    setSentenceUploadResult(null)
    setStatus('')
  }, [])

  const updateSentence = useCallback(async (glosses: string[]) => {
    if (glosses.length === 0) {
      setSentence('')
      return
    }
    try {
      const { sentence: s } = await glossToSentence(glosses)
      setSentence(s)
    } catch {
      setSentence(glosses.map((g) => g.toLowerCase()).join(' ') + '.')
    }
  }, [])

  useEffect(() => {
    updateSentence(transcript)
  }, [transcript, updateSentence])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        {/* Main: large live view + result */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border-2 border-border bg-card p-3 shadow-card md:p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Live view
            </h2>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Capture:</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="captureMode"
                  checked={segmentMode}
                  onChange={() => setSegmentMode(true)}
                  className="border-border"
                />
                Auto (sign then pause)
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="captureMode"
                  checked={!segmentMode}
                  onChange={() => setSegmentMode(false)}
                  className="border-border"
                />
                Manual (2.5s)
              </label>
            </div>
            <p className="mb-3 text-xs text-muted">
              Ensure good lighting and keep hands visible in frame.
            </p>
            <WebcamCapture
              captureDurationMs={CAPTURE_MS}
              onStreamReady={onStreamReady}
              onCapture={onCapture}
              disabled={!!status}
              segmentMode={segmentMode}
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

          <section className="rounded-xl border-2 border-border bg-card p-3 shadow-card md:p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Upload video
            </h2>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted">Interpret as:</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="uploadMode"
                  checked={uploadMode === 'single'}
                  onChange={() => setUploadMode('single')}
                  className="border-border"
                />
                Single sign
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="uploadMode"
                  checked={uploadMode === 'sentence'}
                  onChange={() => setUploadMode('sentence')}
                  className="border-border"
                />
                Sentence (full video)
              </label>
            </div>
            <p className="mb-3 text-xs text-muted">
              {uploadMode === 'single'
                ? 'Short clip (a few seconds). One gloss returned.'
                : 'Longer video of someone signing a sentence. Video is segmented into signs and converted to one sentence.'}
            </p>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/mpeg,.mp4,.webm,.mpg,.mpeg"
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-[var(--color-page)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-text hover:file:border-muted file:cursor-pointer"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setStatus(uploadMode === 'sentence' ? 'Interpreting sentence…' : 'Interpreting…')
                setLastResult(null)
                setSentenceUploadResult(null)
                try {
                  if (uploadMode === 'sentence') {
                    const result = await predictSentenceFromVideoBlob(file, file.name)
                    setSentenceUploadResult(result)
                  } else {
                    const result = await predictFromVideoBlob(file, file.name)
                    setLastResult(result)
                    if (result.gloss !== '(no sign)') {
                      setTranscript((prev) => [...prev, result.gloss])
                    }
                  }
                  setStatus('')
                } catch (err) {
                  setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
                }
                e.target.value = ''
              }}
              disabled={!!status}
            />
            {status && (
              <p className="mt-3 m-0 text-sm text-muted">
                {status}
              </p>
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
              {lastResult.gloss !== '(no sign)' && (
                <button
                  type="button"
                  className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  onClick={() => speak(lastResult!.gloss)}
                  title="Speak this sign"
                >
                  <span aria-hidden>🔊</span>
                  Speak
                </button>
              )}
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

          {sentenceUploadResult && (
            <section className="rounded-xl border border-border bg-card px-4 py-4 shadow-card md:px-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Sentence from video
              </h2>
              <p className="text-xl font-semibold tracking-tight text-text">
                {sentenceUploadResult.sentence || '(no sentence)'}
              </p>
              {sentenceUploadResult.sentence && (
                <button
                  type="button"
                  className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  onClick={() => speak(sentenceUploadResult!.sentence)}
                  title="Speak sentence"
                >
                  <span aria-hidden>🔊</span>
                  Speak sentence
                </button>
              )}
              {sentenceUploadResult.glosses.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">
                    Glosses
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sentenceUploadResult.glosses.map((g, i) => (
                      <span
                        key={`${g}-${i}`}
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-[0.8125rem] text-muted"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {/* Side panel: transcript */}
        <aside className="flex min-h-[200px] flex-col xl:min-h-[520px]">
          {sentence && (
            <section className="mb-4 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                Sentence
              </h2>
              <p className="text-base font-medium text-text">{sentence}</p>
              <button
                type="button"
                className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                onClick={() => speak(sentence)}
                title="Speak sentence"
              >
                <span aria-hidden>🔊</span>
                Speak sentence
              </button>
            </section>
          )}
          <Transcript
            items={transcript}
            onClear={clearTranscript}
            onSpeakItem={speak}
            alwaysShow
          />
        </aside>
      </div>
    </div>
  )
}
