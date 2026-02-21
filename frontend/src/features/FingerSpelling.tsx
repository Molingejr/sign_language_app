export function FingerSpelling() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Spell words letter by letter using hand shapes. The camera will recognize
        fingerspelled letters and show the text.
      </p>
      <section className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center shadow-card">
        <img
          src="/svgs/undraw_doctors_djoj.svg"
          alt=""
          className="mx-auto h-48 w-auto max-w-full object-contain opacity-90"
          aria-hidden
        />
        <p className="mt-4 font-medium text-muted">Finger spelling recognition — coming soon.</p>
        <p className="mt-1 text-sm text-muted">
          Camera and real-time letter detection will be available here.
        </p>
      </section>
    </div>
  )
}
