# Voice-to-Avatar Roadmap

Turn the doctor’s voice (or typed text) into sign language performed by an avatar so deaf users can read the message in ASL. This doc outlines the **process**, **best methods**, **research and pretrained options**, and a **phased implementation plan** for CareSign.

---

## Process overview (4 steps)

| Step | Name | Input → Output | Notes |
|------|------|----------------|-------|
| **1** | Voice acquisition | Microphone → text | Real-time speech-to-text (e.g. Google STT). |
| **2** | Text preprocessing | Raw text → normalized tokens / phrases | Tokenization, lemmatization, multi-word phrases (“good morning” → one sign), optional context (BERT only if needed). |
| **3** | Sign lookup | Words/phrases → sign representation | Dictionary: gloss → video clip **or** gloss → pose sequence. Fallback: fingerspell unknown words. |
| **4** | Sign sequencing & playback | Gloss/pose sequence → video | Order by ASL syntax (or gloss order first). Play clips sequentially or render avatar from poses on the web. |

---

## Research and pretrained options

### Step 1: Speech-to-text

| Option | Notes |
|--------|--------|
| **Google Cloud Speech-to-Text** | Robust, real-time streaming, good for doctor speech. |
| **Web Speech API** (browser) | Free, no backend; quality and latency vary by browser. |
| **Whisper** (OpenAI, open-source) | Strong accuracy; can run self-hosted for privacy. |

Use **Google STT** or **Whisper** for production; **Web Speech API** for a quick frontend-only prototype.

---

### Step 2: Text → gloss (English to sign-language gloss)

Most public work is **gloss → text**; **text → gloss** is less common but supported by these directions:

| Source | What it does | ASL? | Open / usable |
|--------|----------------|------|----------------|
| **Fine-tuned LMs (T5, mBART, etc.)** | Bidirectional gloss↔text; can be used for text→gloss. | PHOENIX (German), ASLG-PC12 (ASL) | Papers/code (e.g. [ACL 2025](https://aclanthology.org/2025.wslp-main.11/)); need to train or adapt for ASL. |
| **Rule-based + lemmatizer** | Tokenize, lemmatize, phrase mapping, reorder/drop words (e.g. [spoken-to-signed](https://github.com/sign-language-processing/spoken-to-signed-translation)). | No (Swiss DE/FR/IT) | Yes; **architecture directly reusable** for ASL with an ASL phrase list and rules. |
| **SignGPT / SignLLM** | LLM for sign translation/generation from text. | SignLLM: ASL + 7 others | SignGPT: demo at [signgpt.org](https://signgpt.org); code “coming”. SignLLM: not open-sourced. |
| **How2Sign** | Large ASL dataset (gloss + English); train or use for phrase tables. | Yes | Dataset and some code (e.g. [Text2Sign](https://github.com/finngregg/Text2Sign)) for text→sign. |
| **Scaling Sign Language Translation (NeurIPS 2024)** | Multilingual STL with (m)T5; zero-shot. | One of 5 languages | Research; check for released models. |

**Recommendation:** Start with **rule-based text→gloss** (phrase list + lemmatization + simple ASL reordering), aligned with the [spoken-to-signed](https://github.com/sign-language-processing/spoken-to-signed-translation) pipeline. Add **fine-tuned text→gloss** (T5/mBART on How2Sign or ASL data) when you need better coverage or disambiguation.

#### Vocabulary expansion (implemented and options)

| Approach | What it does | When to use |
|----------|----------------|-------------|
| **Lemmatization** (simplemma) | Maps word forms to base form: "feeling"→FEEL, "running"→RUN. Same glossary, more coverage. | **Done.** No extra data; add base forms (RUN, EAT, etc.) to fallback or class list. |
| **Larger static glossary** | Use full WLASL class list (`CLASS_LIST_PATH`); add `dataset/text_to_gloss_extra.txt` (one gloss per line or `word\tgloss`). | **Done.** Drop in extra file or set env; merge at load time. |
| **How2Sign / ASL-LEX word lists** | Export vocab from datasets into `text_to_gloss_extra.txt` or merge into class list. | When you need 1k+ terms without training. |
| **Fine-tuned T5/mBART** | Train on (English sentence, gloss sequence) pairs (e.g. How2Sign). One model for text→gloss. | When you need open-vocabulary or disambiguation (e.g. "right" = direction vs correct). |
| **BERT** | Use for **disambiguation** when one word maps to multiple glosses (e.g. embed context, pick best gloss). Does not add new words. | After you have multiple glosses per word and need context. |

---

### Step 3: Gloss → sign representation (for playback)

| Approach | Description | ASL | Notes |
|----------|-------------|-----|--------|
| **Video lookup** | One video clip per gloss (e.g. from WLASL, How2Sign, or custom). | WLASL: ~2k glosses, 21k+ clips; How2Sign: continuous sentences | WLASL is research license; check terms. Easiest for “avatar” = playback. |
| **Pose lookup + pose-to-video** | Lexicon: gloss → pose sequence; then pose-to-video (e.g. [pose-to-video](https://github.com/sign-language-processing/pose-to-video), pix2pix). | Need ASL pose lexicon (e.g. from How2Sign skeletons) | [spoken-to-signed](https://github.com/sign-language-processing/spoken-to-signed-translation) uses this; Swiss lexicons only. |
| **Diffusion / end-to-end** | SignGen etc.: text/gloss → full sign video (latent diffusion). | Benchmarks include WLASL/How2Sign | Research; heavier compute; not yet plug-and-play. |
| **Fingerspelling fallback** | No sign for word → spell letters (we already have Finger Spelling). | Yes | Required for out-of-vocabulary words. |

**Recommendation:** **Video lookup** first (WLASL or subset + healthcare terms; clarify license). Reuse existing **WLASL class list** and, where possible, one clip per gloss. Add **pose-based** pipeline later if you adopt a pose lexicon and pose-to-video for a single “avatar” look.

#### Avatar-first (one consistent character, not stitched clips)

To make it feel “real” with a single on-screen signer instead of separate video clips:

| Option | What it is | ASL? | Effort / notes |
|--------|------------|------|-----------------|
| **AWS GenASL / ASL 3D Avatar** | AWS solution: text/speech → ASL avatar (MetaHuman). Real-time or async video. | Yes | Commercial; AWS (Transcribe, Bedrock, etc.). Good quality, managed. |
| **Sign-Speak API** | REST API for ASL production (and recognition). | Yes | Commercial; check if output is avatar video or clips. |
| **Pose → avatar in browser** | Gloss → pose sequence (from lexicon or model); drive a 3D avatar (e.g. Three.js) in the frontend from poses. One character, real-time. | Need ASL pose data | Open; need ASL pose lexicon (How2Sign skeletons, SignAvatar ASL3DWord, or custom). |
| **Pose-to-video (backend)** | [pose-to-video](https://github.com/sign-language-processing/pose-to-video): pose sequence → photorealistic video. Same signer every time. | Need pose lexicon | Open (Swiss lexicons); would need ASL pose lexicon + pipeline. |
| **SignAvatar (research)** | 3D sign motion from text; ASL3DWord dataset. | Yes | Research; 3D joint rotations; could drive a 3D avatar if integrated. |
| **Sign-Kit, signlanguageavatar** | Web 3D avatars (e.g. Three.js) for sign language. | ISL / generic | Open; adapt for ASL and plug in gloss→pose or gloss→animation. |

**Practical path for avatar:** (1) **Commercial:** Sign-Speak or AWS GenASL if you have budget — text/gloss in, avatar video out. (2) **Open:** Get or build an **ASL gloss→pose** lexicon (e.g. from How2Sign skeleton data or SignAvatar), then either render with pose-to-video (backend) or drive a **browser 3D avatar** (Three.js + skeleton) from pose frames so one character signs in real time.

#### Run locally: open-source avatar and models

All of these run on your machine (no commercial API). You need **gloss (or text) → pose** then **pose → avatar**.

| Component | Option | What it does | Install / link |
|-----------|--------|--------------|----------------|
| **Pose → avatar/video** | **pose-to-video** (sign-language-processing) | Renders a `.pose` sequence as **video**. Supports **Mixamo** (3D avatar), pix2pix (photorealistic), or ControlNet. Same character every time. | `pip install 'pose-to-video[mixamo]'` or clone [pose-to-video](https://github.com/sign-language-processing/pose-to-video). Input: `.pose` file. |
| **Gloss/text → pose** | **spoken-to-signed** | Gloss → pose via a **lexicon** (gloss → pose sequence). They ship Swiss sign lexicons; for ASL you’d need an ASL pose lexicon (e.g. from How2Sign skeletons or custom). | `pip install spoken-to-signed`; [repo](https://github.com/sign-language-processing/spoken-to-signed-translation). |
| **Gloss/text → pose** | **transcription** (text_to_pose) | **SignWriting** text → pose. Pipeline: text → SignWriting (e.g. `text_to_text`) → `text_to_pose` → `.pose`. Repo is deprecated but usable. | `pip install git+https://github.com/sign-language-processing/transcription`. |
| **Text → 3D motion** | **SignAvatar (research)** | 3D sign motion from text; uses ASL3DWord. Good for driving a 3D avatar if you integrate their output (joint rotations). | [SignAvatar](https://dongludeeplearning.github.io/SignAvatar.html); check GitHub for code/weights. |
| **Video lookup (no avatar)** | **signavatar** (PyPI) | Looks up per-word “gesture” (video URL or path) from ASLLVD/WLASL CSV/JSON. You supply the data; it returns animation sequence. Not true avatar generation. | `pip install signavatar`; needs ASLLVD/WLASL files locally. |

**Suggested local pipeline for CareSign**

1. **Backend:** Keep your **text → gloss** (current). Add a **gloss → pose** step: either (a) use **spoken-to-signed** with an ASL pose lexicon (you’d need to build or obtain gloss→pose data, e.g. from How2Sign skeleton extractions), or (b) add **SignWriting** in between and use **transcription**’s `text_to_pose` (text → SignWriting → pose).
2. **Backend:** Run **pose-to-video** with **Mixamo** on the pose sequence to get a single video (one 3D avatar). Example:  
   `pose_to_video --type=mixamo --pose=output.pose --video=output.mp4`
3. **Frontend:** Send glosses to backend; backend returns the generated avatar video (or a URL to it); frontend plays it on the Voice-to-Avatar page.

**Data gap:** For **gloss → pose** in ASL you need either (i) an ASL pose lexicon (gloss → pose sequence per sign), or (ii) a model that outputs pose from gloss/text. How2Sign and SignAvatar (ASL3DWord) are potential data sources; spoken-to-signed gives the pipeline pattern but not ASL data out of the box.

---

### Step 4: Sequencing and playback

| Aspect | Options |
|--------|--------|
| **Ordering** | Start with **gloss order** (or English order); later add **ASL syntax** (topic-first, time–subject–object–verb, drop/rewrite function words) via rules or small model. |
| **Playback** | Web: play video segments in sequence (e.g. `<video>` or canvas); or drive an on-screen avatar from pose stream. |
| **UX** | Real-time: stream STT → show text → queue signs and play as soon as segments are ready. |

---

## Recommended architecture for CareSign

- **Language:** ASL (American Sign Language).  
- **Domain:** Healthcare (doctor speech, common phrases).  
- **Stack:** Reuse existing backend (FastAPI), frontend (React), and WLASL/Finger Spelling where possible.

High-level pipeline:

```
[Browser] Mic → (optional: backend) STT → text
         → Backend: text → preprocessing → gloss sequence
         → Backend: gloss → sign lookup (video IDs or pose IDs)
         → Browser: play sign videos in order (or render avatar from poses)
         Unknown word → fingerspell (existing Finger Spelling)
```

- **Best methods to implement first:**  
  1. **Voice:** Google Speech-to-Text (or Web Speech API for MVP).  
  2. **Text→gloss:** Rule-based (tokenize, lemmatize, phrase list, simple ASL rules); optionally fine-tuned T5/mBART for text→gloss later.  
  3. **Sign lookup:** Dictionary (gloss → video clip ID or path); fallback to fingerspelling.  
  4. **Playback:** Sequential video playback on the Voice-to-Avatar page; later consider pose-to-video or avatar SDK if you need a single character.

---

## Phased implementation plan

### Phase 1: Input + text → gloss (no avatar yet)

- **Frontend (Voice-to-Avatar page)**  
  - Mic button → capture audio; send to backend or use Web Speech API.  
  - Textarea: type/paste text.  
  - Display transcribed/typed text and “gloss sequence” (list of glosses).

- **Backend**  
  - Optional: `POST /speech-to-text` (e.g. Google STT) or rely on browser.  
  - `POST /text-to-gloss`: input text → list of glosses (rule-based: tokenization, lemmatization, phrase map, stop-word/ASL rules).  
  - Gloss vocabulary = WLASL class list + healthcare phrases (e.g. “good morning”, “how are you”, “pain”, “medicine”).

- **Deliverable:** User speaks or types → sees text and gloss sequence (e.g. `["HELLO", "HOW", "YOU", "TODAY"]`). No sign video yet.

### Phase 2: Gloss → video lookup and playback

- **Sign dictionary**  
  - Build or license a **gloss → video** map (one representative clip per gloss).  
  - Source: WLASL (license permitting), How2Sign, or curated healthcare clips.  
  - Store as manifest (e.g. `gloss -> video URL or path`).

- **Backend**  
  - `POST /gloss-to-signs`: gloss list → list of sign identifiers (video IDs or URLs).  
  - Unknown gloss → return fingerspelling sequence (e.g. `["FINGERSPELL", "H","E","L","L","O"]`).

- **Frontend**  
  - Request sign sequence from backend; play videos in order (or show fingerspelling UI reusing Finger Spelling).  
  - Queue and play next while current is playing for smoother real-time feel.

- **Deliverable:** Voice or text → gloss sequence → sequential sign video playback (and fingerspelling when needed).

### Phase 3: Better text→gloss and ASL ordering

- **Text→gloss**  
  - Add or integrate a **pretrained text→gloss** model (e.g. T5/mBART fine-tuned on How2Sign or ASL data) behind `POST /text-to-gloss`; keep rule-based as fallback.  
  - Expand phrase list and synonym mapping for healthcare.

- **ASL ordering**  
  - Add a **reordering** step: gloss sequence → ASL-order sequence (rules or small model).  
  - Optional: use BERT (or similar) only where you need disambiguation (e.g. “right” vs “correct”).

- **Deliverable:** More accurate glosses and more natural sign order.

### Phase 4: Smoother avatar experience (optional)

- **Unified avatar**  
  - If desired: replace per-gloss videos with **pose-to-video** (e.g. pose lexicon + [pose-to-video](https://github.com/sign-language-processing/pose-to-video)) or a signing-avatar API/SDK.  
  - Requires ASL pose lexicon (e.g. from How2Sign skeletons or custom).

- **Latency and streaming**  
  - Stream STT (partial results) → incremental text→gloss → start playback before full sentence.

---

## References and links

| Topic | Link |
|--------|-----|
| Spoken-to-signed pipeline (text→gloss→pose→video) | [GitHub: spoken-to-signed-translation](https://github.com/sign-language-processing/spoken-to-signed-translation) |
| Paper (gloss-based baseline) | [arXiv:2305.17714](https://arxiv.org/abs/2305.17714) |
| How2Sign (ASL, gloss + English) | [how2sign.github.io](https://how2sign.github.io/) |
| Text2Sign (English → sign, How2Sign) | [GitHub: finngregg/Text2Sign](https://github.com/finngregg/Text2Sign) |
| WLASL (word-level ASL videos) | [WLASL homepage](https://dxli94.github.io/WLASL/) |
| SignGPT (LLM for sign translation/generation) | [signgpt.org](https://signgpt.org), [SignGPT project](https://signgpt26.github.io/) |
| SignLLM (text → sign, 8 languages) | [SignLLM](https://signllm.github.io/) (models not open) |
| Fine-tuned LMs for gloss↔text | [ACL 2025 WSLP](https://aclanthology.org/2025.wslp-main.11/) |
| Gloss2Text (gloss→text with LLMs) | [ACL 2024 Findings EMNLP](https://aclanthology.org/2024.findings-emnlp.947/) |
| Scaling Sign Language Translation | [NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/ced76a666704e381c3039871ffe558ee-Abstract-Conference.html) |

---

## Summary

- **Process:** Voice → STT → text → preprocessing → gloss sequence → sign lookup (video or pose) → sequencing → playback (and fingerspelling fallback).  
- **Best methods for CareSign:** Google STT (or Web Speech API for MVP), rule-based text→gloss with phrase list and ASL rules, gloss→video dictionary (WLASL subset / healthcare), sequential video playback, optional later: fine-tuned text→gloss model and pose-to-video avatar.  
- **Research:** Use the **spoken-to-signed** pipeline as the architectural template; combine with **How2Sign** and **WLASL** for ASL; track **SignGPT/SignLLM** and **fine-tuned LMs** for better text→gloss when you need it.
