/**
 * Hook for live speech recognition (microphone → text).
 * Start/stop with toggle; transcript updates in real time (interim + final).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionErrorCode,
} from '../utils/speechRecognition'

export interface UseSpeechRecognitionResult {
  /** Current full transcript (final results only). */
  transcript: string
  /** Live interim text while speaking (cleared when final). */
  interimTranscript: string
  /** Whether the recognizer is currently listening. */
  isListening: boolean
  /** User-facing error message, e.g. "Microphone access denied". */
  error: string | null
  /** Browser supports SpeechRecognition. */
  isSupported: boolean
  /** Start listening (no-op if already listening or unsupported). */
  startListening: () => void
  /** Stop listening and keep current transcript. */
  stopListening: () => void
  /** Clear transcript and interim. */
  resetTranscript: () => void
}

const ERROR_MESSAGES: Record<SpeechRecognitionErrorCode, string> = {
  aborted: 'Recognition was aborted.',
  'audio-capture': 'No microphone was found.',
  'bad-grammar': 'Grammar error.',
  'language-not-supported': 'Language not supported.',
  network: 'Network error.',
  'no-speech': 'No speech detected. Try again.',
  'not-allowed': 'Microphone access was denied.',
  'service-not-allowed': 'Speech recognition is not allowed.',
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognizerRef = useRef<ReturnType<typeof createSpeechRecognition>>(null)

  const isSupported = isSpeechRecognitionSupported()

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser.')
      return
    }
    setError(null)
    let rec = recognizerRef.current
    if (!rec) {
      rec = createSpeechRecognition()
      if (!rec) {
        setError('Could not create speech recognizer.')
        return
      }
      recognizerRef.current = rec
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let final = ''
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0]?.transcript ?? ''
          if (result.isFinal) {
            final += text
          } else {
            interim += text
          }
        }
        if (final) {
          setTranscript((prev) => (prev ? `${prev} ${final}` : final).trim())
          setInterimTranscript('')
        }
        if (interim) setInterimTranscript(interim)
      }
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = event.error as SpeechRecognitionErrorCode
        const message = ERROR_MESSAGES[code] ?? event.message ?? 'Recognition error.'
        setError(message)
      }
      rec.onend = () => {
        setIsListening(false)
      }
    }
    if (rec && !isListening) {
      setInterimTranscript('')
      rec.start()
      setIsListening(true)
    }
  }, [isSupported, isListening])

  const stopListening = useCallback(() => {
    const rec = recognizerRef.current
    if (rec && isListening) {
      rec.stop()
    }
    setIsListening(false)
  }, [isListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      const rec = recognizerRef.current
      if (rec) {
        try {
          rec.abort()
        } catch {
          // ignore
        }
        recognizerRef.current = null
      }
    }
  }, [])

  return {
    transcript,
    interimTranscript,
    isListening,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  }
}
