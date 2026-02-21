export function VoiceToAvatar() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted">
        Speak or type text and see it performed by a signing avatar, so deaf
        users can read the message in sign language.
      </p>
      <section className="rounded-[10px] border border-dashed border-border bg-card/50 px-6 py-12 text-center shadow-card">
        <p className="text-muted">Voice to signing avatar — coming soon.</p>
        <p className="mt-2 text-sm text-muted">
          Speech-to-text and avatar synthesis will be available here.
        </p>
      </section>
    </div>
  )
}
