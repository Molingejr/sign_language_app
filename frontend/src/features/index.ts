export { SignInterpretation } from './SignInterpretation'
export { FingerSpelling } from './FingerSpelling'
export { VoiceToAvatar } from './VoiceToAvatar'
export { Home } from './Home'

export type FeatureId = 'interpretation' | 'fingerspelling' | 'voice-to-avatar'

export const FEATURES: { id: FeatureId; label: string; path: string }[] = [
  { id: 'interpretation', label: 'Sign Interpretation', path: '/interpret' },
  { id: 'fingerspelling', label: 'Finger Spelling', path: '/fingerspelling' },
  { id: 'voice-to-avatar', label: 'Voice to Avatar', path: '/voice-to-avatar' },
]

export const FEATURE_BY_PATH: Record<string, FeatureId> = Object.fromEntries(
  FEATURES.map((f) => [f.path, f.id])
)
