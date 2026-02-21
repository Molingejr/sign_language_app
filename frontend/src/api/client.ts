export interface PredictResponse {
  gloss: string
  top_k: string[]
  confidence: number
}

export async function predictFromVideoBlob(blob: Blob): Promise<PredictResponse> {
  const form = new FormData()
  form.append('video', blob, 'clip.webm')
  const res = await fetch('/predict', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}
