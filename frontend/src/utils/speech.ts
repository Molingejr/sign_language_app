/**
 * Text-to-speech using the Web Speech API (sign → speech, per JETIR paper).
 * Cancels any ongoing utterance before speaking.
 */
export function speak(text: string): void {
  if (typeof window === 'undefined' || !text?.trim()) return
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text.trim())
  u.lang = 'en-US'
  u.rate = 0.9
  synth.speak(u)
}

/** Stop any current speech. */
export function stopSpeaking(): void {
  if (typeof window === 'undefined') return
  window.speechSynthesis?.cancel()
}
