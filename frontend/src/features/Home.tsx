import {
  HandRaisedIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { FEATURES } from './index'

const FEATURE_META: Record<string, { icon: typeof VideoCameraIcon; description: string }> = {
  '/interpret': {
    icon: VideoCameraIcon,
    description: 'Sign in front of your camera and see the meaning appear as text — then hear it spoken.',
  },
  '/fingerspelling': {
    icon: HandRaisedIcon,
    description: 'Spell words letter by letter with ASL hand shapes. Hold each letter briefly to build your word.',
  },
  '/voice-to-avatar': {
    icon: SpeakerWaveIcon,
    description: 'Turn speech into an animated signing avatar. Great for practice and accessibility.',
  },
}

export function Home() {
  return (
    <div className="relative min-h-[80vh] w-full overflow-hidden">
      {/* Soft gradient background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-[#f0f9ff]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(6, 78, 59, 0.06) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-20 sm:pb-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          CareSign
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl">
          Sign language for
          <br />
          <span className="text-accent">healthcare</span>
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-lg leading-relaxed text-muted">
          Use your camera to interpret signs into text, spell with your hands, or turn your voice
          into a signing avatar. Built for hospitals and care settings.
        </p>
      </section>

      {/* Feature cards — full width of main for wider cards */}
      <section className="w-full px-0 pb-20 sm:px-2">
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map(({ path, label }) => {
            const { icon: Icon, description } = FEATURE_META[path] ?? {
              icon: VideoCameraIcon,
              description: 'Explore this feature.',
            }
            return (
              <Link
                key={path}
                to={path}
                className="group relative flex flex-col rounded-2xl border border-border bg-card/95 p-8 shadow-sm backdrop-blur-sm transition-colors duration-300 hover:border-accent/50 hover:bg-card hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent/20">
                  <Icon className="h-7 w-7" aria-hidden />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-text">
                  {label}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-transform duration-300 group-hover:translate-x-0.5">
                  Get started
                  <span aria-hidden>→</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Footer note */}
      <section className="mx-auto max-w-3xl px-4 pb-16 text-center">
        <p className="rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted shadow-card">
          Allow camera access when prompted for Sign Interpretation and Finger Spelling.
        </p>
      </section>
    </div>
  )
}
