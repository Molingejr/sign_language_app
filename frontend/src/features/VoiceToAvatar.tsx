import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MicrophoneIcon,
  StopIcon,
  ArrowRightIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
} from '@heroicons/react/24/outline'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { textToGloss, glossToSigns, apiUrl, type SignSequenceItem } from '../api/client'

export function VoiceToAvatar() {
  const {
    transcript,
    interimTranscript,
    isListening,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition()

  const displayText = [transcript, interimTranscript].filter(Boolean).join(' ')
  const [sourceText, setSourceText] = useState('')
  const [glosses, setGlosses] = useState<string[]>([])
  const [glossLoading, setGlossLoading] = useState(false)
  const [glossError, setGlossError] = useState<string | null>(null)

  const [signSequence, setSignSequence] = useState<SignSequenceItem[]>([])
  const [sequenceLoading, setSequenceLoading] = useState(false)
  const [sequenceError, setSequenceError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When transcript (final) changes, update source text so user can edit or convert
  useEffect(() => {
    if (transcript) setSourceText(transcript)
  }, [transcript])

  // When glosses change, fetch sign playback sequence
  useEffect(() => {
    if (glosses.length === 0) {
      setSignSequence([])
      setCurrentIndex(0)
      setIsPlaying(false)
      return
    }
    let cancelled = false
    setSequenceError(null)
    setSequenceLoading(true)
    glossToSigns(glosses)
      .then(({ sequence }) => {
        if (!cancelled) {
          setSignSequence(sequence)
          setCurrentIndex(0)
          setIsPlaying(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSequenceError(e instanceof Error ? e.message : String(e))
          setSignSequence([])
        }
      })
      .finally(() => {
        if (!cancelled) setSequenceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [glosses])

  const stopPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const advancePlayback = useCallback(() => {
    setCurrentIndex((i) => {
      if (i >= signSequence.length - 1) {
        stopPlayback()
        return i
      }
      return i + 1
    })
  }, [signSequence.length, stopPlayback])

  useEffect(() => {
    if (!isPlaying || signSequence.length === 0) return
    const item = signSequence[currentIndex]
    if (!item) return
    const isFingerspell = item.type === 'fingerspell'
    const durationMs = isFingerspell
      ? Math.max(800, item.letters.length * 400)
      : 2200
    playTimerRef.current = setTimeout(advancePlayback, durationMs)
    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [isPlaying, currentIndex, signSequence, advancePlayback])

  const handleConvertToGlosses = async () => {
    const text = sourceText.trim()
    if (!text) return
    setGlossError(null)
    setGlossLoading(true)
    try {
      const { glosses: next } = await textToGloss(text)
      setGlosses(next)
    } catch (e) {
      setGlossError(e instanceof Error ? e.message : String(e))
      setGlosses([])
    } finally {
      setGlossLoading(false)
    }
  }

  const clearAll = () => {
    stopPlayback()
    resetTranscript()
    setSourceText('')
    setGlosses([])
    setSignSequence([])
    setCurrentIndex(0)
    setGlossError(null)
    setSequenceError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Speak or type text and see it performed by a signing avatar, so deaf
        users can read the message in sign language.
      </p>

      {/* Microphone → text */}
      <section className="rounded-xl border-2 border-border bg-card p-4 shadow-card md:p-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Voice to text
        </h2>
        {!isSupported ? (
          <p className="text-sm text-muted">
            Speech recognition is not supported in this browser. Try Chrome or
            Edge, or use the text field below to type.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  isListening
                    ? 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400'
                    : 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
                }`}
                title={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? (
                  <>
                    <StopIcon className="size-5" aria-hidden />
                    Stop
                  </>
                ) : (
                  <>
                    <MicrophoneIcon className="size-5" aria-hidden />
                    Start microphone
                  </>
                )}
              </button>
              {(transcript || error) && (
                <button
                  type="button"
                  onClick={resetTranscript}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  Clear
                </button>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="min-h-[4rem] rounded-lg border border-border bg-[var(--color-page)] px-3 py-3">
              {displayText ? (
                <p className="text-base text-text">
                  {transcript && <span>{transcript}</span>}
                  {interimTranscript && (
                    <span className="text-muted">{interimTranscript}</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {isListening
                    ? 'Listening… speak now.'
                    : 'Click "Start microphone" and speak, or type below.'}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Text → gloss */}
      <section className="rounded-xl border-2 border-border bg-card p-4 shadow-card md:p-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Text to glosses
        </h2>
        <p className="mb-3 text-sm text-muted">
          Edit the text below (or type) then convert to sign glosses. Unknown
          words become fingerspelling.
        </p>
        <div className="flex flex-col gap-3">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="e.g. Hello, how are you? I need water."
            rows={3}
            className="w-full rounded-lg border border-border bg-[var(--color-page)] px-3 py-2 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleConvertToGlosses}
              disabled={!sourceText.trim() || glossLoading}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <ArrowRightIcon className="size-4" aria-hidden />
              {glossLoading ? 'Converting…' : 'Convert to glosses'}
            </button>
            {(sourceText || glosses.length > 0) && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Clear all
              </button>
            )}
          </div>
          {glossError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {glossError}
            </p>
          )}
          {glosses.length > 0 && (
            <div className="rounded-lg border border-border bg-[var(--color-page)] px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Glosses
              </p>
              <div className="flex flex-wrap gap-1.5">
                {glosses.map((g, i) => (
                  <span
                    key={`${g}-${i}`}
                    className={`rounded-md border px-2 py-0.5 text-sm font-medium ${
                      g.startsWith('?')
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'border-border bg-card text-text'
                    }`}
                  >
                    {g.startsWith('?') ? g.slice(1) + ' (?)' : g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sign playback */}
      <section className="rounded-xl border-2 border-border bg-card p-4 shadow-card md:p-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Sign playback
        </h2>
        {signSequence.length === 0 && !sequenceLoading && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
            <img
              src="/svgs/undraw_doctor_aum1.svg"
              alt=""
              className="mx-auto h-40 w-auto max-w-full object-contain opacity-90"
              aria-hidden
            />
            <p className="mt-4 font-medium text-muted">
              Convert text to glosses above to see the sign sequence here.
            </p>
          </div>
        )}
        {sequenceLoading && (
          <p className="py-6 text-center text-sm text-muted">Loading sign sequence…</p>
        )}
        {sequenceError && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {sequenceError}
          </p>
        )}
        {signSequence.length > 0 && !sequenceLoading && (
          <div className="flex flex-col gap-4">
            <div className="flex min-h-[12rem] items-center justify-center rounded-xl border-2 border-border bg-[var(--color-page)] p-6">
              {(() => {
                const item = signSequence[currentIndex]
                if (!item) return null
                if (item.type === 'sign') {
                  const videoSrc = item.video_id
                    ? apiUrl(`/sign-video/${encodeURIComponent(item.video_id)}`)
                    : null
                  return (
                    <div className="flex w-full flex-col items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Sign: {item.gloss}
                      </p>
                      {videoSrc ? (
                        <video
                          key={item.video_id}
                          src={videoSrc}
                          className="max-h-[280px] w-full max-w-md rounded-lg border border-border bg-black object-contain"
                          controls
                          playsInline
                          muted
                          autoPlay
                          aria-label={`Sign for ${item.gloss}`}
                        />
                      ) : (
                        <p className="text-sm text-muted">
                          No video for this sign in dataset.
                        </p>
                      )}
                    </div>
                  )
                }
                return (
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Fingerspell
                    </p>
                    <p className="mt-2 flex justify-center gap-2 font-mono text-2xl font-bold tracking-widest text-foreground">
                      {item.letters.map((l, i) => (
                        <span key={`${l}-${i}`}>{l}</span>
                      ))}
                    </p>
                  </div>
                )
              })()}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopPlayback()
                  setCurrentIndex((i) => (i > 0 ? i - 1 : 0))
                }}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                title="Previous"
              >
                <BackwardIcon className="size-5" aria-hidden />
                Prev
              </button>
              <button
                type="button"
                onClick={() => (isPlaying ? stopPlayback() : setIsPlaying(true))}
                disabled={signSequence.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <>
                    <PauseIcon className="size-5" aria-hidden />
                    Pause
                  </>
                ) : (
                  <>
                    <PlayIcon className="size-5" aria-hidden />
                    Play
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPlayback()
                  setCurrentIndex((i) =>
                    i < signSequence.length - 1 ? i + 1 : signSequence.length - 1
                  )
                }}
                disabled={currentIndex >= signSequence.length - 1}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                title="Next"
              >
                Next
                <ForwardIcon className="size-5" aria-hidden />
              </button>
            </div>
            <p className="text-center text-sm text-muted">
              {currentIndex + 1} of {signSequence.length}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
