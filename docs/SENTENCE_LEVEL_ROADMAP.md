# Path to sentence-level sign-to-text

You’re at **word-level**: each 2.5 s clip → one gloss (e.g. "book", "want").  
To get **sentence-level** output (e.g. "I want a book"), you need better **segmentation** and a **gloss→English** step. Optionally later, a model trained on full sentences.

---

## Where you are now

```
[Webcam/upload] → fixed 2.5 s clip → I3D → one gloss → transcript = ["book", "want", "pizza"]
```

- **WLASL I3D**: trained on **isolated signs** (one gloss per clip). No notion of “sentence” in the model.
- **Transcript**: list of glosses; no grammar, no reordering, no punctuation.

So “sentence level” breaks into two parts:

1. **Better gloss sequence**: one chunk per sign (not fixed 2.5 s), so the order and boundaries make sense.
2. **Gloss sequence → English sentence**: reorder/expand glosses into readable text (and optionally train on sentence data later).

---

## Step 1: Smarter segmentation (one chunk ≈ one sign)

**Goal:** Send the backend one clip per sign instead of every fixed 2.5 s, so the transcript is a cleaner gloss sequence.

**Options (no new model):**

| Approach | Where | What to do |
|----------|--------|------------|
| **Motion-based** | Frontend or backend | Detect “sign boundaries”: e.g. when frame-to-frame difference drops below a threshold for ~0.3–0.5 s, treat that as end of sign. Send the clip from previous boundary to now to `POST /predict`. Overlapping or sliding window can still be used. |
| **Confidence-based** | Frontend | When confidence from `POST /predict` dips (e.g. top-1 &lt; 0.2) or changes identity, consider that a boundary; start a new segment. |
| **User-driven** | Frontend | “Sign then press space/button” to commit one sign. Easiest; good for practice mode. |

**Concrete next step:** Add a **segment detector** in the frontend (e.g. in `WebcamCapture` or a small hook): compute simple motion (e.g. mean absolute difference between consecutive frames) over a buffer; when motion is low for N ms, “close” the current segment, send it to `/predict`, append result to transcript, then start the next segment. Tune threshold so one sign ≈ one request. Keep I3D and API unchanged.

---

## Step 2: Gloss sequence → readable sentence (no new training)

**Goal:** Turn `["book", "want", "pizza"]` into something like “I want pizza” or “Want book.” so it feels sentence-level to the user.

**Options:**

| Approach | Effort | Notes |
|----------|--------|--------|
| **Display only** | None | Keep showing glosses; add “Sentence” line: join with spaces and capitalize first word, e.g. “Book want pizza.” Improves readability without logic. |
| **Rule-based** | Low | Simple rules: e.g. insert “I” before “want”/“need”; drop repeated glosses; add period after N glosses or on long pause. Can live in backend (`POST /gloss-to-sentence`) or frontend. |
| **Template / patterns** | Low–medium | Map short gloss sequences to templates: e.g. `["how", "you"]` → “How are you?” Use a small JSON map (gloss sequence → template). |
| **LM / API** | Medium | Send gloss sequence to a small language model or API (e.g. “gloss: book, want, pizza” → “I want a book” or “I want pizza”). Needs a model that knows gloss order vs English order (or train one on gloss–sentence pairs; see Step 3). |

**Concrete next step:** Add a **gloss-to-sentence** step that runs *after* you have a segment of glosses (e.g. when user pauses or clicks “Finish sentence”):

- **Backend:** New endpoint, e.g. `POST /gloss-to-sentence` with body `{ "glosses": ["book", "want", "pizza"] }`. Implement v1 with rules: e.g. join with spaces, capitalize first, add period; optionally add 2–3 rules (“want” → “I want”, “how you” → “How are you?”).
- **Frontend:** When showing the transcript, also show a “Sentence” line that calls this endpoint (or a frontend-only version of the same rules). TTS can speak the sentence line.

No change to I3D; no new training. You get “sentence-level” in the UI and for TTS.

---

## Step 3: Use sentence-level data (training)

**Goal:** Better and more natural sentences by learning from (gloss sequence ↔ English) or (video ↔ sentence) data.

**Data:**

- **WLASL**: isolated signs only; no sentence labels. Good for keeping I3D as-is.
- **How2Sign / similar**: parallel data (sign video or gloss sequence ↔ English sentence). Use for training a **gloss-sequence → English** model or an end-to-end **video → sentence** model.

**Two paths:**

| Path | Input | Output | Training |
|------|--------|--------|----------|
| **A. Gloss sequence → English** | Ordered list of glosses (from I3D + segmentation) | One English sentence | Train a small seq2seq or LM on (gloss sequence, English) pairs (e.g. from How2Sign). Replace or augment the rule-based gloss-to-sentence with this model. |
| **B. Video → sentence** | Full sign video (or long clip) | One English sentence | Train or fine-tune a model (e.g. encoder–decoder) on (video or video features, sentence). Bigger change; needs sentence-level video dataset. |

**Practical order:** Do **Path A** first: keep I3D + segmentation as-is, add a **gloss→sentence** model trained on How2Sign (or similar) gloss–English pairs. Backend: after you have a gloss sequence (from Step 1), call the gloss→sentence model instead of (or in addition to) rules from Step 2. Path B can come later when you want end-to-end video→sentence and have the data.

---

## Summary: next steps in order

1. **Segmentation (Step 1):** Add motion-based (or confidence-based) segment detection so each `/predict` call gets roughly one sign. Transcript becomes a cleaner gloss sequence. No new model.
2. **Gloss → sentence, v1 (Step 2):** Add rules or templates: gloss sequence → one line of readable text (“Book want pizza.” or “I want pizza.”). New endpoint or frontend logic; optional TTS on the sentence.
3. **Gloss → sentence, v2 (Step 3):** Get How2Sign (or similar) gloss–sentence data; train a small gloss-sequence→English model; plug it in behind the same API. Replace or augment rules from Step 2.
4. **Optional later:** Explore end-to-end video→sentence (Path B) or better segmenters (e.g. boundary detection model).

The **immediate next step** that moves you toward sentence-level without new data or training is **Step 1 (segmentation)** plus **Step 2 (simple rules)**. After that, sentence-level data and a gloss→English model (Step 3) will make the output much more natural.
