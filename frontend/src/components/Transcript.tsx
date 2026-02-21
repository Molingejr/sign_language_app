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
        <p className="m-0 text-base leading-relaxed text-text">
          {items.length > 0 ? items.join(' ') : 'No interpretation yet. Record a clip to see the transcript here.'}
        </p>
      </div>
    </section>
  )
}
