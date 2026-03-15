# Video vs avatar, and where to get avatar data

## Best approach: video vs avatar

| | **Video (current)** | **Avatar (one person)** |
|---|---------------------|--------------------------|
| **What it is** | Stitch WLASL (or other) clips: one clip per gloss, different signers. | One consistent character (3D or photoreal) performs every sign. |
| **Pros** | Real signing, no new data if you have WLASL; already implemented. | Feels like one interpreter; better for branding and UX. |
| **Cons** | Different signers per sign; can feel disjointed. | Needs **motion/pose data** (or commercial API), not just images. |
| **Verdict** | **Avatar is better UX** (one consistent “person”), but it depends on having **gloss → motion** data or a paid service. |

So: **avatar is the better goal**; video is the practical fallback until you have avatar-capable data or API.

---

## Do we need “just images”?

For a **signing avatar** you don’t use “just images” of a person. You need one of:

1. **Pose/skeleton sequences** (recommended)  
   - **Gloss → pose sequence** (body + hands + optional face).  
   - Then: drive a 3D avatar (e.g. Mixamo, Three.js) or a pose-to-video model.  
   - Datasets below give **motion**, not static images.

2. **Pre-rendered avatar videos**  
   - Someone else already rendered one character doing each sign (e.g. commercial APIs).

3. **Image sequences / sprites**  
   - Possible but rare; usually you’d derive them from pose → render, not the other way around.

So: **avatar data = motion/pose data** (or a service that hides it). “Just images” alone are not enough for a signing avatar; you need **gloss → motion** (or gloss → video from one character).

---

## Where to get avatar-capable data (motion, not “just images”)

All of these give you **motion** (pose/skeleton or 3D) you can feed into an avatar pipeline. None is “images only.”

### 1. **SignAvatars** (3D holistic motion) — strong option

- **What:** Large-scale 3D sign language motion (SMPL-X body + hands + face).  
- **Scale:** ~70k videos, 153 signers, 8.34M frames with 3D annotations.  
- **Use:** Gloss/word → 3D pose sequence → drive 3D avatar or pose-to-video.  
- **ASL:** Yes (and other languages in some splits).  
- **Get it:** Code on [GitHub (ZhengdiYu/SignAvatars)](https://github.com/ZhengdiYu/SignAvatars); dataset via application (see [SignAvatars project page](https://signavatars.github.io/)).

### 2. **How2Sign (skeleton / landmarks)** — you already use Holistic

- **What:** Continuous ASL with 2D/3D keypoints (body, face, hands).  
- **Use:** Extract **gloss → pose sequence** from aligned segments; drive avatar or pose-to-video.  
- **Get it:** [how2sign.github.io](https://how2sign.github.io/) — download “B-F-H 2D Keypoints” (or 3D) by split. Your repo already has **How2Sign Holistic** (MediaPipe-style landmarks); you can build gloss→pose from that or from official keypoints.

### 3. **SignAvatar / ASL3DWord** (word-level 3D ASL)

- **What:** Word-level 3D joint rotations (body, hands, face) for ASL.  
- **Use:** Gloss → 3D motion → drive 3D avatar.  
- **Get it:** Project page [SignAvatar](https://dongludeeplearning.github.io/SignAvatar.html); code and dataset linked there.

### 4. **Sign Language Mocap Archive** (smaller, open)

- **What:** Collected sign language motion capture (rigs, ASL dictionary resources).  
- **License:** CC0-1.0.  
- **Get it:** [StudioGalt/Sign-Language-Mocap-Archive](https://github.com/StudioGalt/Sign-Language-Mocap-Archive).

### 5. **pose-to-video + spoken-to-signed** (pipeline, not dataset)

- **What:** [pose-to-video](https://github.com/sign-language-processing/pose-to-video) renders a `.pose` sequence as video (Mixamo 3D or photoreal). [spoken-to-signed](https://github.com/sign-language-processing/spoken-to-signed-translation) gives **gloss → pose** but ships **Swiss** lexicons only.  
- **Use:** For ASL you still need an **ASL gloss→pose** lexicon (e.g. from How2Sign or SignAvatars); then this stack gives you one consistent avatar video.

---

## Suggested path for you

1. **Short term:** Keep **video** (WLASL) as now — it works and uses data you have.  
2. **Avatar later:**  
   - **Option A:** Apply for **SignAvatars** and build **gloss → pose** (or use their benchmarks); then drive Mixamo/Three.js or pose-to-video.  
   - **Option B:** Use **How2Sign** keypoints (or your How2Sign Holistic pipeline) to build a **gloss → pose** lexicon for a subset of signs; then same avatar pipeline.  
   - **Option C:** Use **SignAvatar/ASL3DWord** if you want word-level 3D and can use their code.

So: **avatar is the best approach for UX; you don’t get there with “just images” — you get there with motion/pose data** from SignAvatars, How2Sign, SignAvatar/ASL3DWord, or the Mocap Archive, then feed that into an avatar (3D or pose-to-video).
