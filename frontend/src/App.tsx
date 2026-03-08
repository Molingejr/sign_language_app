import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { Header } from './components/Header'
import {
  FEATURES,
  FEATURE_BY_PATH,
  FingerSpelling,
  Home,
  SignInterpretation,
  VoiceToAvatar,
} from './features'

export default function App() {
  const location = useLocation()
  const activeFeature = FEATURE_BY_PATH[location.pathname] ?? null
  const isInterpretation = activeFeature === 'interpretation'
  const isHome = activeFeature === null

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main
        className={`mx-auto flex flex-1 flex-col px-4 sm:px-6 lg:px-8 ${
          isHome || isInterpretation ? 'max-w-7xl w-full py-8' : 'max-w-[720px] py-8'
        }`}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/interpret"
            element={
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-text">
                    {FEATURES[0].label}
                  </h1>
                  <p className="text-xs text-muted">Position person in frame, then record.</p>
                </div>
                <SignInterpretation />
              </div>
            }
          />
          <Route
            path="/fingerspelling"
            element={
              <>
                <h1 className="mb-4 text-lg font-semibold tracking-tight text-text">
                  {FEATURES[1].label}
                </h1>
                <FingerSpelling />
              </>
            }
          />
          <Route
            path="/voice-to-avatar"
            element={
              <>
                <h1 className="mb-4 text-lg font-semibold tracking-tight text-text">
                  {FEATURES[2].label}
                </h1>
                <VoiceToAvatar />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
