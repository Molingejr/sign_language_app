export function FingerSpelling() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Spell words letter by letter using hand shapes. The camera will recognize
        fingerspelled letters and show the text.
      </p>
      <section className="rounded-[10px] border border-dashed border-border bg-card/50 px-6 py-12 text-center shadow-card">
        <p className="text-muted">Finger spelling recognition — coming soon.</p>
        <p className="mt-2 text-sm text-muted">
          Camera and real-time letter detection will be available here.
        </p>
      </section>
    </div>
  )
}
