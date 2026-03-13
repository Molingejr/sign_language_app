export interface PredictResponse {
  gloss: string
  top_k: string[]
  confidence: number
}

const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? 'http://127.0.0.1:8000'
    : ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export async function predictFromVideoBlob(
  blob: Blob,
  filename?: string
): Promise<PredictResponse> {
  const form = new FormData()
  const name = filename ?? (blob instanceof File ? blob.name : 'clip.webm')
  form.append('video', blob, name)
  const res = await fetch(apiUrl('/predict'), {
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
  const res = await fetch(apiUrl('/predict-sentence'), {
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
  const res = await fetch(apiUrl('/gloss-to-sentence'), {
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

export interface TextToGlossResponse {
  glosses: string[]
}

export async function textToGloss(text: string): Promise<TextToGlossResponse> {
  const res = await fetch(apiUrl('/text-to-gloss'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim() }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

/** One item in the sign playback sequence */
export type SignSequenceItem =
  | { type: 'sign'; gloss: string; video_id?: string | null }
  | { type: 'fingerspell'; letters: string[] }

export interface GlossToSignsResponse {
  sequence: SignSequenceItem[]
}

export async function glossToSigns(glosses: string[]): Promise<GlossToSignsResponse> {
  const res = await fetch(apiUrl('/gloss-to-signs'), {
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
  const res = await fetch(apiUrl('/predict-fingerspelling'), {
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
