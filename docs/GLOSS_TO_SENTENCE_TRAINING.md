# Gloss → sentence: pretrained model and optional fine-tuning

The app uses a **pretrained text-to-text model** (default: `google/flan-t5-small`) to convert gloss sequences to natural English. No phrase table or hand-written rules.

## Current behaviour

- **Backend** (`backend/app/gloss_to_sentence.py`): On first request, loads the HuggingFace model given by `GLOSS_MODEL_NAME` (default `google/flan-t5-small`). Prompt: *"Convert these sign language glosses into one natural English sentence: book, want, pizza"* → model generates e.g. *"I want pizza."*
- **Fallback**: If `GLOSS_USE_MODEL=false` or loading fails, a minimal fallback joins glosses with spaces and adds a period.
- **Env**: `GLOSS_USE_MODEL` (default true), `GLOSS_MODEL_NAME` (default `google/flan-t5-small`), `GLOSS_DEVICE` (default `cpu`; use `cuda` to run the gloss model on GPU).

## Optional fine-tuning

To improve output for sign-language glosses specifically, you can **fine-tune** the same model (or a larger one) on parallel data:

- **Data**: (gloss sequence, English sentence) pairs, e.g. from [How2Sign](https://how2sign.github.io/).
- **Approach**: Fine-tune FLAN-T5 (or T5/BART) with input = gloss sequence (or the same prompt format), target = English sentence. Then save the model and set `GLOSS_MODEL_NAME` to the path of your checkpoint (or push to HuggingFace and use the model id).
- **API**: Unchanged; the backend just uses the new model name/path.

See the rest of this doc for data format and training outline.

## Data

You need **parallel data**: (gloss sequence, English sentence) pairs.

- **How2Sign**: Gloss sequences and English captions for sign language videos.
- **WLASL**: Word-level only; pair with another corpus or synthetic templates if needed.

## Training outline

```python
# Fine-tune FLAN-T5 on (gloss_seq, sentence) pairs
# 1. Load How2Sign or your (gloss_seq, en_sentence) data
# 2. Format: input = "Convert these sign language glosses into one natural English sentence: g1, g2, g3"
#           target = "I want pizza."
# 3. Use HuggingFace Trainer with Seq2SeqTrainingArguments
# 4. Save model; set GLOSS_MODEL_NAME to your saved path or HuggingFace id
```

No change to the frontend or `POST /gloss-to-sentence` API.
