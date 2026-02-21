export function VoiceToAvatar() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Speak or type text and see it performed by a signing avatar, so deaf
        users can read the message in sign language.
      </p>
      <section className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center shadow-card">
        <img
          src="/svgs/undraw_doctor_aum1.svg"
          alt=""
          className="mx-auto h-48 w-auto max-w-full object-contain opacity-90"
          aria-hidden
        />
        <p className="mt-4 font-medium text-muted">Voice to signing avatar — coming soon.</p>
        <p className="mt-1 text-sm text-muted">
          Speech-to-text and avatar synthesis will be available here.
        </p>
      </section>
    </div>
  )
}
