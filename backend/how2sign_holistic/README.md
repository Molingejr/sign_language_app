# How2Sign Holistic (Option A) — MediaPipe + TensorFlow

Load the [How2Sign Holistic](https://huggingface.co/datasets/PSewmuthu/How2Sign_Holistic) dataset (MediaPipe landmark features from How2Sign ASL) and build TensorFlow datasets for sign recognition or translation.

## Folder structure

The code expects either:

- **Custom root** (e.g. after manual download): a root directory containing  
  `datasets/PSewmuthu--How2Sign_Holistic/how2sign_holistic_features/` with `metadata/`, `train/`, `val/`, `test/` underneath. Pass this root as `cache_dir`.
- **Explicit npys path**: a path to the folder that directly contains `train/`, `val/`, `test/` (i.e. `how2sign_holistic_features`). Pass as `npys_root`; use `cache_dir` as well if metadata lives under the same root.

## 1. Download metadata (lightweight)

```python
from backend.how2sign_holistic import ensure_metadata

# Downloads only CSV files to HF cache
meta_dir = ensure_metadata()
print(meta_dir)
```

## 2. Download and extract .npy for a split

Data is stored as `.rar` archives. Extract once so you have `train/frontal/*.npy`, etc.

```python
from backend.how2sign_holistic import ensure_split_npys

# Install extract deps: pip install patool rarfile (or system unrar)
out = ensure_split_npys("train", view="frontal", out_dir="./data/how2sign_holistic", extract_rar=True)
# out = Path("./data/how2sign_holistic") with train/frontal/*.npy
```

Or download the RAR manually from Hugging Face and extract with `unrar x train/frontal.rar`.

## 3. Build TensorFlow dataset

```python
import tensorflow as tf
from backend.how2sign_holistic import load_metadata, build_tf_dataset

# Inspect metadata columns (adapt _npy_path_from_row in tf_dataset.py if needed)
meta = load_metadata("train")
print(meta.columns.tolist())

# Build dataset: (keypoints, sentence)
ds = build_tf_dataset(
    split="train",
    npys_root="./data/how2sign_holistic",
    view="frontal",
    text_column="sentence",
    max_frames=256,
    batch_size=8,
    shuffle_buffer=500,
)
for keypoints, text in ds.take(1):
    print(keypoints.shape, text.numpy())
```

## 4. Use with a Keras model

```python
# Example: simple LSTM for sequence -> sentence (use tokenizer in practice)
model = tf.keras.Sequential([
    tf.keras.layers.Masking(mask_value=0.0),
    tf.keras.layers.LSTM(256, return_sequences=False),
    tf.keras.layers.Dense(128, activation="relu"),
    tf.keras.layers.Dense(vocab_size),  # or use Embedding + decoder for seq2seq
])
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy")
# model.fit(ds, steps_per_epoch=..., epochs=...)
```

## 5. Training script (sign-to-text)

Training supports two architectures and modern training practices:

- **`--model transformer`** (default): Transformer encoder (keypoints with positional encoding + self-attention) and decoder with **cross-attention** over the encoder. Matches modern sign-to-text research. Uses LR warmup + cosine decay, label smoothing, and gradient clipping. Saves to `how2sign_holistic_transformer.keras`.
- **`--model lstm`**: Baseline BiLSTM encoder + LSTM decoder (initial state only). Same modern training tricks (label smoothing, clipnorm). Saves to `how2sign_holistic.keras`.

From repo root:

```bash
# Transformer (recommended for best accuracy):
python -m backend.how2sign_holistic.train --model transformer --cache_dir /path/to/parent/of/datasets --epochs 10 --save_dir ./checkpoints/how2sign_holistic

# Or with explicit paths:
python -m backend.how2sign_holistic.train --model transformer --npys_root ./data/how2sign_holistic [--cache_dir /path/to/cache] --epochs 10
```

Options: `--model transformer|lstm`, `--learning_rate` (default 1e-4; transformer uses warmup+cosine decay), `--cache_dir`, `--npys_root`, `--view`, `--batch_size`, `--max_frames`, `--epochs`, `--save_dir`.

## CSV columns

How2Sign realigned metadata is tab-separated. Typical columns include sentence, gloss, and clip identifiers. If your CSV uses different names for id/start/end, edit `_npy_path_from_row()` in `tf_dataset.py` or add a `filename` column to the CSV.

## Dependencies

- `tensorflow`, `pandas`, `numpy`, `huggingface_hub` (in `backend/requirements.txt`)
- Optional: `patool`, `rarfile` (and system `unrar`) to extract `.rar` files from Python
