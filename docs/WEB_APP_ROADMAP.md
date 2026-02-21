# Web app roadmap: sign language interpretation (without training)

You can ship a working web app **without training** by running the **pretrained WLASL I3D model on a backend** and building a thin frontend that streams video to it. Training can come later.

---

## High-level architecture

```
[Browser]  webcam → send frames/clips → [Backend]  I3D inference → gloss(es) → [Browser]  show text (+ optional TTS)
```

- **Frontend**: Capture webcam, optionally use MediaPipe for preview or future landmark-based models. Send video chunks to the backend.
- **Backend**: Load the pretrained WLASL I3D checkpoint once. On each request (e.g. a 64-frame clip), run inference and return top-1 or top-5 glosses.
- **No training required**: Use your current checkpoint and `wlasl_class_list.txt`.

---

## Process (step-by-step)

### Phase 1: Backend API (1–2 days)

1. **Create a small Python API** (FastAPI or Flask) that:
   - Loads the I3D model + WLASL checkpoint + class list at startup (once).
   - Exposes one endpoint, e.g. `POST /predict`:
     - Input: video file (e.g. `.mp4`) or a sequence of frames (e.g. base64 or multipart). Keep it simple: e.g. **upload a short video file** (a few seconds, 64 frames at 25 fps ≈ 2.5 s).
     - Backend decodes the video, samples 64 frames (same logic as `run_wlasl_inference.py`), runs I3D, returns `{ "gloss": "book", "top_k": ["book", "all", ...], "confidence": 0.42 }`.
   - Reuse your existing code: `wlasl_i3d` (dataset frame loading + transforms) and the inference loop from `run_wlasl_inference.py`. No new model, no training.

2. **Test the API** with `curl` or Postman: upload a short clip, check that the JSON response matches what you see when you run `run_wlasl_inference.py --video_id ...` for the same content.

### Phase 2: Minimal frontend (1–2 days)

3. **Simple web page** (plain HTML/JS or a small React/Vite app) that:
   - Requests camera access and shows the webcam stream.
   - Every N seconds (e.g. 2–3 s), grabs a short clip (e.g. 64 frames via `MediaRecorder` or canvas capture), sends it to `POST /predict` (e.g. as a Blob or FormData).
   - Displays the returned gloss(es) on the page (e.g. “Sign: book”). Optionally show top-3 and a simple “confidence” bar.

4. **CORS**: Enable CORS on the backend so the browser can call it (e.g. from `http://localhost:5173` during dev).

5. **Deploy locally**: Run backend (e.g. `uvicorn` on port 8000) and frontend (e.g. `npm run dev` on 5173). Use the app from your machine first.

### Phase 3: Make it feel “real-time” (optional, same week)

6. **Buffering strategy**: To avoid sending a 2.5 s clip and waiting 2.5 s before the next prediction, you can:
   - Send overlapping windows (e.g. every 1 s, send last 2.5 s of frames), or
   - Send one clip per “segment” when the user pauses (e.g. detect motion start/stop with a simple threshold on frame diff).  
   Both can be done without training; they only change how you chunk the stream.

7. **Gloss → sentence (optional)**: If you want to show a sentence instead of a single word:
   - **Simple**: Append each new gloss to a line of text (e.g. “book | want | pizza”). No model.
   - **Better later**: Add a small “gloss-to-English” step (e.g. rule-based reordering or a tiny LM/API) once you have data or are ready to integrate How2Sign.

### Phase 4: Later (when you’re ready)

8. **Training**: When you want better accuracy or sentence-level output:
   - Fine-tune or train on WLASL (or How2Sign) and replace the backend’s checkpoint with your own.
   - Or add a second model (e.g. landmark-based) and switch the backend to use it; the frontend can stay the same (still “send clip → get gloss”).

9. **Deployment**: Put backend on a cloud VM or serverless (e.g. modal.com, Railway, or a small GPU instance), frontend on Vercel/Netlify/Cloudflare. Use HTTPS and, if needed, a single backend URL in the frontend env.

---

## Why this is doable without training

- You **already have** a working inference pipeline (`run_wlasl_inference.py`) and pretrained weights.
- The backend is just “load model once + run the same inference on uploaded clips.”
- The frontend is “webcam → capture clip → POST → show result.” No model in the browser required.
- Training can stay as a later step to improve accuracy or add sentence translation; the web app structure doesn’t depend on it.

---

## Suggested stack (concrete)

| Layer    | Choice              | Reason |
|----------|---------------------|--------|
| Backend  | FastAPI             | Async, easy file upload, auto OpenAPI docs |
| Model    | Your current I3D + WLASL checkpoint | No training; reuse existing code |
| Frontend | React + Vite or plain HTML/JS | Simple; add MediaRecorder or canvas for clips |
| Comms    | REST `POST /predict` with video Blob | Simple; WebSockets optional later for streaming |

---

## Next step

A practical next step is to add a **minimal FastAPI app** in this repo (e.g. `app/main.py`) that loads the WLASL model and exposes `POST /predict` with the same 64-frame logic you use in `run_wlasl_inference.py`. Once that works, you can build the frontend against it. If you want, we can sketch that `main.py` and the exact request/response format next.
