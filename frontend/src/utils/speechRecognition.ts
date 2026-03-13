/**
 * Speech recognition (microphone → text) using the Web Speech API.
 * Uses continuous mode with interim results for real-time transcription.
 */

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  return typeof Ctor !== 'undefined'
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor()
}

export type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
