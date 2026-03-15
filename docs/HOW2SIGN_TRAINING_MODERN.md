# How2Sign Holistic training: current vs modern research

## What `train.py` uses today

| Component | Current | Typical in recent research |
|-----------|--------|----------------------------|
| **Encoder** | Single BiLSTM, one vector per sequence (no per-frame representation) | Transformer or temporal Transformer over keypoints; or multi-stream keypoint attention |
| **Decoder** | LSTM with only *initial state* from encoder (no attention over encoder) | Transformer decoder with **cross-attention** over encoder outputs |
| **Encoder–decoder link** | Encoder → (h, c) → decoder LSTM initial state | Encoder sequence → **cross-attention** in decoder (attend to all encoder frames) |
| **Tokenization** | Word-level `TextVectorization` (whitespace, lower) | Subword (e.g. SentencePiece, BPE) for better OOV and length |
| **Optimizer / schedule** | Adam, fixed LR | Adam/AdamW + **warmup + decay** (linear or cosine) |
| **Training tricks** | Dropout only | **Label smoothing**, **gradient clipping**, optional CTC auxiliary |
| **Inference** | Argmax per step (greedy) | **Beam search** for better sequences |
| **Pipeline** | Direct keypoints → sentence | Often **Sign→Gloss→Text** (gloss as intermediate); or direct with much larger models |

So the current script is a **solid, minimal baseline** (BiLSTM encoder + LSTM decoder, teacher forcing), but it does **not** use the architectures or training practices that dominate recent sign-language translation papers (transformers, cross-attention, LR schedules, beam search).

## References (keypoint + transformer / attention)

- **Keypoints + transformer**: e.g. “Automatic sign language to text translation using MediaPipe and transformer architectures” (ScienceDirect 2025), “Multi-Stream Keypoint Attention Network for Sign Language Recognition and Translation” (arXiv 2024).
- **Pipeline**: Sign2Gloss2Text is common; gloss-free end-to-end keypoint→text is also used with large transformer encoder–decoders.
- **How2Sign**: Often used with transformer or LSTM-based models; keypoint (e.g. MediaPipe holistic) input is standard.

## Recommended next steps (without rewriting everything)

1. **Low effort, high impact**
   - **Learning rate schedule**: Add warmup + decay (e.g. 1k warmup steps, then linear decay). Keras: `tf.keras.optimizers.schedules` or a callback that updates LR.
   - **Gradient clipping**: `model.compile(..., clipnorm=1.0)` or pass to optimizer.
   - **Label smoothing**: `SparseCategoricalCrossentropy(..., label_smoothing=0.1)`.

2. **Medium effort**
   - **Cross-attention**: Replace “encoder → single vector → decoder” with “encoder returns full sequence” and a decoder that attends to it (e.g. one or two Transformer decoder layers with cross-attention, rest LSTM if you want to keep the rest of the code).
   - **Subword tokenization**: Export vocab from training text, train SentencePiece (or use a pretrained tokenizer); replace `TextVectorization` so the model sees subwords and handles OOV better.

3. **Larger change (research-style)**
   - **Full transformer**: Encoder = stack of temporal Transformer layers over keypoints (with positional encoding); decoder = Transformer decoder with cross-attention. Train with warmup + decay, label smoothing, beam search at inference. This aligns with “modern” keypoint-to-text papers.

If you want to keep the current script as the **baseline** and add a **modern** variant, the natural place is a second model builder (e.g. `build_model_transformer` or a separate `train_transformer.py`) plus the same data pipeline, with the improvements above applied there.
