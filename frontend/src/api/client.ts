export interface PredictResponse {
  gloss: string
  top_k: string[]
  confidence: number
}

export async function predictFromVideoBlob(
  blob: Blob,
  filename?: string
): Promise<PredictResponse> {
  const form = new FormData()
  const name = filename ?? (blob instanceof File ? blob.name : 'clip.webm')
  form.append('video', blob, name)
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

export interface PredictSentenceResponse {
  glosses: string[]
  sentence: string
}

export async function predictSentenceFromVideoBlob(
  blob: Blob,
  filename?: string
): Promise<PredictSentenceResponse> {
  const form = new FormData()
  const name = filename ?? (blob instanceof File ? blob.name : 'clip.webm')
  form.append('video', blob, name)
  const res = await fetch('/predict-sentence', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface GlossToSentenceResponse {
  sentence: string
}

export async function glossToSentence(glosses: string[]): Promise<GlossToSentenceResponse> {
  const res = await fetch('/gloss-to-sentence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ glosses }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 21 MediaPipe hand landmarks: [ [x,y,z], ... ] */
export interface FingerspellingResponse {
  letter: string
  confidence: number
  top_k: string[]
}

export async function predictFingerspelling(
  landmarks: number[][]
): Promise<FingerspellingResponse> {
  const res = await fetch('/predict-fingerspelling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ landmarks }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}
