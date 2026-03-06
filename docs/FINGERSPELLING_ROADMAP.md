# ASL Fingerspelling with TensorFlow (Hugging Face) + MediaPipe Landmarks

Yes — you can do ASL fingerspelling using TensorFlow models on Hugging Face and **MediaPipe hand landmarks**. This doc outlines the approach and two concrete model options.

---

## Pipeline overview

```
[Webcam] → MediaPipe Hand Landmarker → 21 landmarks (x,y,z) per frame
                ↓
    Option A: Send landmarks to backend → Keras/TF model → letter (A–Z)
    Option B: Backend runs MediaPipe on video frames, then TF model on landmarks
```

MediaPipe’s hand landmarker outputs **21 landmarks** with `x`, `y` (normalized 0–1), and `z` (depth relative to wrist). Several Hugging Face models take exactly this format.

---

## Option 1: sid220/asl-now-fingerspelling (recommended)

- **Hub**: [sid220/asl-now-fingerspelling](https://huggingface.co/sid220/asl-now-fingerspelling)
- **Framework**: Keras / TensorFlow
- **Input**: 21 hand landmarks, each `[x, y, z]` — matches MediaPipe format
- **Output**: 26 classes (A–Z), probability distribution
- **License**: MIT  
- **Live demo**: [asl-now.vercel.app](https://asl-now.vercel.app)

**Input spec (from model card):**  
`x`, `y` normalized to [0, 1] by image width/height; `z` = depth with wrist as origin (same as [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)).

**Loading (Python backend):**

```python
# requirements: tensorflow, huggingface_hub
from huggingface_hub import hf_hub_download
import tensorflow as tf

path = hf_hub_download(repo_id="sid220/asl-now-fingerspelling", filename="keras_model.h5")
model = tf.keras.models.load_model(path)
# Input shape: (batch, 21, 3) or (batch, 63)
# Output: (batch, 26) logits or probs for A–Z
```

**Integration:**  
- **Frontend:** Use MediaPipe Hands (JS) in the browser → extract 21×3 per frame → send array to backend, or  
- **Backend:** Decode video, run MediaPipe (Python) per frame → stack landmarks → run Keras model.

---

## Option 2: ColdSlim/ASL-TFLite-Edge

- **Hub**: [ColdSlim/ASL-TFLite-Edge](https://huggingface.co/ColdSlim/ASL-TFLite-Edge)
- **Framework**: TensorFlow Lite (edge-friendly)
- **Input**: 64×64 RGB image **generated from** hand landmarks (via MediaPipe)
- **Output**: 59 ASL character classes (includes padding/special)
- **License**: Apache 2.0

You still use MediaPipe to get landmarks; then you render them (or a derived representation) into a 64×64 image and run the TFLite model. Good for on-device/edge; slightly more work to match the exact image generation used in training.

---

## Suggested stack for this app

| Component        | Choice                                      |
|-----------------|---------------------------------------------|
| Landmarks       | MediaPipe Hand Landmarker (Python or JS)    |
| Fingerspelling  | **sid220/asl-now-fingerspelling** (Keras)   |
| Backend         | New endpoint, e.g. `POST /predict-fingerspelling` |
| Input           | Either video (backend runs MediaPipe) or JSON array of landmark frames |

**Backend deps to add:** `tensorflow` (or `tf-keras`), `huggingface_hub`, `mediapipe` (if running landmarker server-side).

**Flow:**

1. **Option A (landmarks from frontend):**  
   Frontend runs MediaPipe Hands in the browser, sends a sequence of 21×3 arrays (e.g. one per frame for a short clip) to `POST /predict-fingerspelling`. Backend runs only the Keras model and returns the predicted letter(s).

2. **Option B (video to backend):**  
   Frontend sends a short video (like current `/predict`). Backend decodes frames, runs MediaPipe on each frame, collects landmarks, runs the fingerspelling model (e.g. per-frame or with a small temporal window), returns letter(s).

Option A keeps heavy work in the browser and minimizes server load; Option B reuses the “upload video” pattern you already have and keeps logic on the server.

---

## Letter mapping (sid220 model)

Classes 0–25 map to A–Z:

```python
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
# pred_class = np.argmax(probs)
# letter = LETTERS[pred_class]
```

---

## Next steps

1. Add `tensorflow`, `huggingface_hub`, and optionally `mediapipe` to `backend/requirements.txt`.
2. Implement a small fingerspelling module: load sid220 model at startup, expose a function `predict_letter(landmarks: np.ndarray)` where `landmarks` is shape `(21, 3)` or `(1, 21, 3)`.
3. Add `POST /predict-fingerspelling`: accept either JSON `{ "landmarks": [[x,y,z], ...] }` (one frame) or a video file; return `{ "letter": "A", "confidence": 0.95, "top_k": [...] }`.
4. In `frontend/src/features/FingerSpelling.tsx`: add webcam capture, run MediaPipe Hands (or call backend with video), display predicted letter(s) and optional feedback (e.g. hand outline).

This gives you ASL fingerspelling using TensorFlow models on Hugging Face and MediaPipe landmarks end-to-end.
