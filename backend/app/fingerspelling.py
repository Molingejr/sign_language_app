"""ASL fingerspelling from 21 MediaPipe hand landmarks using sid220/asl-now-fingerspelling."""
from __future__ import annotations

import logging
import numpy as np

logger = logging.getLogger(__name__)

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
NUM_LANDMARKS = 21
LANDMARK_DIM = 3

_model = None


def _build_model():
    """Build the ASL fingerspelling architecture (matches sid220/asl-now-fingerspelling)."""
    import tensorflow as tf
    return tf.keras.Sequential([
        tf.keras.layers.InputLayer(input_shape=(21, 3), name="flatten_input"),
        tf.keras.layers.Flatten(name="flatten"),
        tf.keras.layers.Dense(128, activation="relu", name="dense"),
        tf.keras.layers.Dense(26, activation="linear", name="dense_1"),
    ])


def get_model():
    """Load model: build architecture in code and load weights from HF (avoids Keras 3 deserialization bug on .keras)."""
    global _model
    if _model is not None:
        return _model
    try:
        from huggingface_hub import hf_hub_download
        import tensorflow as tf
    except ImportError as e:
        raise RuntimeError(
            "Fingerspelling requires tensorflow and huggingface_hub. "
            "Install with: pip install tensorflow huggingface_hub"
        ) from e
    # .keras file has incompatible Flatten config with Keras 3; use weights-only .h5 and build architecture here
    weights_path = hf_hub_download(
        repo_id="sid220/asl-now-fingerspelling",
        filename="asl-now-weights.h5",
    )
    _model = _build_model()
    _model.load_weights(weights_path)
    return _model


def predict_letter(landmarks: list[list[float]]) -> dict:
    """
    Predict one letter from 21 hand landmarks (MediaPipe format).

    landmarks: list of 21 [x, y, z] (normalized x,y; z depth from wrist).
    Returns: { "letter": "A", "confidence": 0.95, "top_k": ["A", "B", ...] }
    """
    if not landmarks or len(landmarks) != NUM_LANDMARKS:
        return {
            "letter": "",
            "confidence": 0.0,
            "top_k": [],
        }
    model = get_model()
    arr = np.array(landmarks, dtype=np.float32)
    if arr.shape != (NUM_LANDMARKS, LANDMARK_DIM):
        return {"letter": "", "confidence": 0.0, "top_k": []}

    batch = arr[np.newaxis, ...]  # (1, 21, 3)
    try:
        logits = model(batch, training=False)
    except Exception as e:
        logger.exception("Fingerspelling model inference failed: %s", e)
        raise
    if hasattr(logits, "numpy"):
        logits = logits.numpy()
    logits = np.asarray(logits)
    if logits.ndim > 1:
        logits = logits[0]
    probs = np.exp(logits - logits.max()) / np.exp(logits - logits.max()).sum()
    top_indices = np.argsort(probs)[::-1]
    top1_idx = int(top_indices[0])
    confidence = float(probs[top1_idx])
    letter = LETTERS[top1_idx] if top1_idx < len(LETTERS) else ""
    top_k = [LETTERS[i] for i in top_indices[:5] if i < len(LETTERS)]
    return {
        "letter": letter,
        "confidence": round(confidence, 4),
        "top_k": top_k,
    }
