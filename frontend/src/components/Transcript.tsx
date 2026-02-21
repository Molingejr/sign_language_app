interface TranscriptProps {
  items: string[]
  onClear: () => void
  /** When true, always render the panel (e.g. for side layout with empty state). */
  alwaysShow?: boolean
}

export function Transcript({ items, onClear, alwaysShow }: TranscriptProps) {
  if (!alwaysShow && items.length === 0) return null

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[10px] border border-border bg-card px-5 py-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Transcript
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
            {items.map((phrase, i) => (
              <span key={`${i}-${phrase}`} className="inline-flex items-baseline gap-1.5">
                <span className="rounded-md border border-border bg-[var(--color-page)] px-2 py-1 text-sm font-medium text-text">
                  {phrase}
                </span>
                {i < items.length - 1 && (
                  <span className="text-muted/60" aria-hidden>·</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <img
              src="/svgs/undraw_creative-flow_t3kz.svg"
              alt=""
              className="mx-auto h-28 w-auto max-w-full object-contain opacity-90"
              aria-hidden
            />
            <p className="mt-3 m-0 text-sm leading-relaxed text-muted">
              No interpretation yet. Record a clip to see the transcript here.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
