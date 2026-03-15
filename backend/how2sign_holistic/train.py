"""
Training script for How2Sign Holistic: keypoints -> text (sentence or gloss).

Supports LSTM baseline and Transformer (modern) architectures. Modern training:
LR warmup + cosine decay, label smoothing, gradient clipping.

Run from repo root:
  python -m backend.how2sign_holistic.train --model transformer --npys_root ./data/how2sign_holistic [--epochs 10]
"""
from pathlib import Path

import tensorflow as tf
from tensorflow.keras.layers import (
    LSTM,
    Bidirectional,
    Dense,
    Dropout,
    Embedding,
    Input,
    LayerNormalization,
    Masking,
    MultiHeadAttention,
)
from tensorflow.keras.losses import SparseCategoricalCrossentropy
from tensorflow.keras.models import Model

from backend.how2sign_holistic.download import FEATURES_ROOT, _repo_root
from backend.how2sign_holistic.tf_dataset import build_tf_dataset

# Defaults (override via CLI or env)
MAX_FRAMES = 256
BATCH_SIZE = 16
EMBED_DIM = 128
LSTM_UNITS = 256
DROPOUT = 0.3
MAX_TEXT_LEN = 64
VOCAB_SIZE = 8_000

# Transformer defaults (tuned for sign-to-text)
TRANSFORMER_D_MODEL = 256
TRANSFORMER_NUM_HEADS = 8
TRANSFORMER_FF_DIM = 512
TRANSFORMER_NUM_ENCODER_LAYERS = 3
TRANSFORMER_NUM_DECODER_LAYERS = 3
WARMUP_STEPS_RATIO = 0.1
LABEL_SMOOTHING = 0.1
CLIPNORM = 1.0


class SinusoidalPositionalEncoding(tf.keras.layers.Layer):
    """Sinusoidal positional encoding for sequences."""

    def __init__(self, d_model: int, max_len: int = 5000, **kwargs):
        super().__init__(**kwargs)
        self.d_model = d_model
        self.max_len = max_len

    def call(self, x):
        seq_len = tf.shape(x)[1]
        position = tf.cast(tf.range(seq_len)[:, tf.newaxis], tf.float32)
        half = self.d_model // 2
        div_term = tf.exp(tf.range(half, dtype=tf.float32) * (-tf.math.log(10000.0) / self.d_model))
        angles = position * div_term[tf.newaxis, :]
        pe_sin = tf.sin(angles)
        pe_cos = tf.cos(angles)
        pe = tf.reshape(tf.stack([pe_sin, pe_cos], axis=2), (seq_len, 2 * half))
        if 2 * half < self.d_model:
            pe = tf.pad(pe, [[0, 0], [0, self.d_model - 2 * half]])
        return x + pe[tf.newaxis, :, :]


def _encoder_padding_mask(keypoints: tf.Tensor) -> tf.Tensor:
    """Create mask for keypoint padding: (B, T) True where valid, False where padding (all zeros)."""
    # keypoints (B, T, D); padding frames are all zeros
    norm = tf.reduce_sum(tf.abs(keypoints), axis=-1)  # (B, T)
    return tf.greater(norm, 0.0)  # (B, T), True = valid


def build_model_transformer(
    seq_len: int,
    feat_dim: int,
    vocab_size: int,
    max_text_len: int,
    d_model: int = TRANSFORMER_D_MODEL,
    num_heads: int = TRANSFORMER_NUM_HEADS,
    ff_dim: int = TRANSFORMER_FF_DIM,
    num_encoder_layers: int = TRANSFORMER_NUM_ENCODER_LAYERS,
    num_decoder_layers: int = TRANSFORMER_NUM_DECODER_LAYERS,
    dropout: float = DROPOUT,
) -> Model:
    """Sign-to-text with Transformer encoder (keypoints) + decoder (cross-attention to encoder)."""
    keypoints_in = Input(shape=(seq_len, feat_dim), dtype=tf.float32, name="keypoints")
    dec_in = Input(shape=(max_text_len,), dtype=tf.int64, name="target_tokens")

    # Encoder: project keypoints -> add pos -> N x (self-attn + FFN)
    x = Dense(d_model, name="enc_proj")(keypoints_in)
    x = Masking(mask_value=0.0)(x)
    x = SinusoidalPositionalEncoding(d_model, max_len=seq_len)(x)
    enc_padding_mask = _encoder_padding_mask(keypoints_in)  # (B, T_enc)

    enc_attn_mask = tf.cast(enc_padding_mask[:, tf.newaxis, tf.newaxis, :], tf.float32)  # (B, 1, 1, T_enc); 1 = keep, 0 = mask out
    for i in range(num_encoder_layers):
        attn_out = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads, dropout=dropout, name=f"enc_attn_{i}")(x, x, attention_mask=enc_attn_mask)
        x = LayerNormalization(name=f"enc_ln1_{i}")(x + Dropout(dropout)(attn_out))
        ffn = Dense(ff_dim, activation="relu", name=f"enc_ffn1_{i}")(x)
        ffn = Dense(d_model, name=f"enc_ffn2_{i}")(Dropout(dropout)(ffn))
        x = LayerNormalization(name=f"enc_ln2_{i}")(x + Dropout(dropout)(ffn))
    enc_out = x  # (B, T_enc, d_model)

    # Decoder: embed + pos -> N x (masked self-attn + cross-attn + FFN)
    dec_emb = Embedding(vocab_size, d_model, mask_zero=True, name="dec_embed")(dec_in)
    dec_emb = SinusoidalPositionalEncoding(d_model, max_len=max_text_len)(dec_emb)

    for i in range(num_decoder_layers):
        self_attn = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads, dropout=dropout, name=f"dec_self_attn_{i}")(
            dec_emb, dec_emb, use_causal_mask=True
        )
        dec_emb = LayerNormalization(name=f"dec_ln1_{i}")(dec_emb + Dropout(dropout)(self_attn))
        # Cross-attention: decoder attends to encoder; 1 = keep, 0 = mask out (encoder padding)
        cross_attn_mask = tf.cast(enc_padding_mask[:, tf.newaxis, tf.newaxis, :], tf.float32)  # (B, 1, 1, T_enc)
        cross_attn = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads, dropout=dropout, name=f"dec_cross_attn_{i}")(
            dec_emb, enc_out, attention_mask=cross_attn_mask
        )
        dec_emb = LayerNormalization(name=f"dec_ln2_{i}")(dec_emb + Dropout(dropout)(cross_attn))
        ffn = Dense(ff_dim, activation="relu", name=f"dec_ffn1_{i}")(dec_emb)
        ffn = Dense(d_model, name=f"dec_ffn2_{i}")(Dropout(dropout)(ffn))
        dec_emb = LayerNormalization(name=f"dec_ln3_{i}")(dec_emb + Dropout(dropout)(ffn))

    logits = Dense(vocab_size, name="logits")(dec_emb)
    return Model(inputs=[keypoints_in, dec_in], outputs=logits)


def build_text_vectorizer(train_ds, max_tokens: int = VOCAB_SIZE, max_len: int = MAX_TEXT_LEN):
    """Build and adapt a TextVectorization layer from training data."""
    vectorizer = tf.keras.layers.TextVectorization(
        max_tokens=max_tokens,
        output_sequence_length=max_len,
        standardize="lower_and_strip_punctuation",
        split="whitespace",
    )
    # Collect all training sentences to build vocab (one pass)
    texts = []
    for _, text in train_ds.take(5000):  # cap for speed
        texts.append(text)
    if not texts:
        raise ValueError("No training samples; check dataset and npys_root.")
    vectorizer.adapt(tf.constant([t.numpy().decode("utf-8") for t in texts]))
    return vectorizer


def build_model(
    seq_len: int,
    feat_dim: int,
    vocab_size: int,
    max_text_len: int,
    embed_dim: int = EMBED_DIM,
    lstm_units: int = LSTM_UNITS,
    dropout: float = DROPOUT,
):
    """Sign-to-text: keypoints sequence -> LSTM encoder -> decoder -> token logits."""
    # Encoder: keypoints (B, T, D) -> (B, lstm_units*2)
    keypoints_in = Input(shape=(seq_len, feat_dim), dtype=tf.float32, name="keypoints")
    x = Masking(mask_value=0.0)(keypoints_in)
    x = Bidirectional(LSTM(lstm_units, return_sequences=False, dropout=dropout))(x)
    enc_out = Dropout(dropout)(x)
    # Project to (h, c) for decoder LSTM: each (B, lstm_units)
    enc_h = Dense(lstm_units, activation="tanh")(enc_out)
    enc_c = Dense(lstm_units, activation="tanh")(enc_out)

    # Decoder: teacher forcing with encoder state
    dec_in = Input(shape=(max_text_len,), dtype=tf.int64, name="target_tokens")
    emb = Embedding(vocab_size, embed_dim, mask_zero=True)(dec_in)
    dec_out = LSTM(
        lstm_units,
        return_sequences=True,
        dropout=dropout,
    )(emb, initial_state=[enc_h, enc_c])
    logits = Dense(vocab_size, name="logits")(dec_out)

    model = Model(inputs=[keypoints_in, dec_in], outputs=logits)
    return model


def prepare_batched(train_ds, vectorizer, max_text_len: int, batch_size: int = BATCH_SIZE):
    """Map (keypoints, text) -> (keypoints, target_tokens, target_next_token)."""

    def _map_fn(keypoints, text):
        text_str = text.numpy().decode("utf-8")
        tokens = vectorizer(tf.constant([text_str]))[0]
        # Input to decoder: [0, t0, t1, ...]; target: [t0, t1, t2, ..., 0] (0 = padding)
        target_in = tf.concat([[0], tokens[:-1]], axis=0)
        target_out = tokens
        return keypoints, target_in, target_out

    def gen():
        for keypoints, text in train_ds.unbatch():
            yield _map_fn(keypoints, text)

    sample_kp, sample_txt = next(iter(train_ds.unbatch().take(1)))
    T, D = sample_kp.shape[0], sample_kp.shape[1]
    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            tf.TensorSpec(shape=(T, D), dtype=tf.float32),
            tf.TensorSpec(shape=(max_text_len,), dtype=tf.int64),
            tf.TensorSpec(shape=(max_text_len,), dtype=tf.int64),
        ),
    )
    return ds.repeat().shuffle(1000).batch(batch_size)


class WarmupCosineDecay(tf.keras.optimizers.schedules.LearningRateSchedule):
    """Linear warmup then cosine decay to min_lr."""

    def __init__(self, total_steps: int, warmup_ratio: float = WARMUP_STEPS_RATIO, initial_lr: float = 1e-4, min_lr: float = 1e-6):
        super().__init__()
        self.total_steps = total_steps
        self.warmup_steps = max(1, int(total_steps * warmup_ratio))
        self.initial_lr = initial_lr
        self.min_lr = min_lr

    def get_config(self) -> dict:
        return {
            "total_steps": self.total_steps,
            "warmup_ratio": self.warmup_steps / max(self.total_steps, 1),
            "initial_lr": self.initial_lr,
            "min_lr": self.min_lr,
        }

    def __call__(self, step):
        step = tf.cast(step, tf.float32)
        warmup_lr = self.initial_lr * step / tf.cast(self.warmup_steps, tf.float32)
        progress = (step - tf.cast(self.warmup_steps, tf.float32)) / tf.maximum(tf.cast(self.total_steps - self.warmup_steps, tf.float32), 1.0)
        progress = tf.clip_by_value(progress, 0.0, 1.0)
        decay = 0.5 * (1.0 + tf.cos(tf.constant(3.14159265, dtype=tf.float32) * progress))
        decay_lr = self.initial_lr * decay * (1.0 - self.min_lr / self.initial_lr) + self.min_lr
        return tf.where(step < self.warmup_steps, warmup_lr, decay_lr)


def run_train(
    npys_root: str | Path,
    view: str = "frontal",
    max_frames: int = MAX_FRAMES,
    batch_size: int = BATCH_SIZE,
    epochs: int = 5,
    max_text_len: int = MAX_TEXT_LEN,
    vocab_size: int = VOCAB_SIZE,
    save_dir: str | Path | None = None,
    cache_dir: str | Path | None = None,
    model_type: str = "transformer",
    learning_rate: float = 1e-4,
):
    npys_root = Path(npys_root)
    cache_dir = Path(cache_dir) if cache_dir else None
    # If npys_root does not exist but cache_dir is set, try derived path (datasets/PSewmuthu--How2Sign_Holistic/how2sign_holistic_features)
    if not npys_root.exists() and cache_dir is not None and cache_dir.exists():
        root = _repo_root(cache_dir)
        if root is not None:
            derived = root / FEATURES_ROOT
            if derived.exists():
                npys_root = derived
    if not npys_root.exists():
        raise FileNotFoundError(f"npys_root not found: {npys_root}. Extract How2Sign Holistic .rar first.")

    # Datasets (no repeat so we can count steps and adapt vectorizer)
    train_ds_raw = build_tf_dataset(
        split="train",
        npys_root=npys_root,
        view=view,
        cache_dir=cache_dir,
        text_column="sentence",
        max_frames=max_frames,
        batch_size=batch_size,
        shuffle_buffer=500,
        repeat=False,
    )
    val_ds_raw = build_tf_dataset(
        split="val",
        npys_root=npys_root,
        view=view,
        cache_dir=cache_dir,
        text_column="sentence",
        max_frames=max_frames,
        batch_size=batch_size,
        shuffle_buffer=0,
        repeat=False,
    )

    # Vectorizer from training text
    vectorizer = build_text_vectorizer(train_ds_raw, max_tokens=vocab_size, max_len=max_text_len)
    vocab_size_actual = len(vectorizer.get_vocabulary())

    # Batched datasets with (keypoints, target_in, target_out)
    train_ds = prepare_batched(train_ds_raw, vectorizer, max_text_len, batch_size)
    val_ds = prepare_batched(val_ds_raw, vectorizer, max_text_len, batch_size)

    # Sample shapes
    sample_kp, sample_in, sample_out = next(iter(train_ds.take(1)))
    T, D = sample_kp.shape[1], sample_kp.shape[2]

    train_steps = sum(1 for _ in train_ds_raw) // batch_size or 1
    val_steps = sum(1 for _ in val_ds_raw) // batch_size or 1
    total_steps = train_steps * epochs

    if model_type == "transformer":
        keras_model = build_model_transformer(
            seq_len=T,
            feat_dim=D,
            vocab_size=vocab_size_actual,
            max_text_len=max_text_len,
        )
        lr_schedule = WarmupCosineDecay(
            total_steps=total_steps,
            warmup_ratio=WARMUP_STEPS_RATIO,
            initial_lr=learning_rate,
            min_lr=1e-6,
        )
        optimizer = tf.keras.optimizers.Adam(learning_rate=lr_schedule, clipnorm=CLIPNORM)
        checkpoint_name = "how2sign_holistic_transformer.keras"
    else:
        keras_model = build_model(
            seq_len=T,
            feat_dim=D,
            vocab_size=vocab_size_actual,
            max_text_len=max_text_len,
        )
        optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate, clipnorm=CLIPNORM)
        checkpoint_name = "how2sign_holistic.keras"

    keras_model.compile(
        optimizer=optimizer,
        loss=SparseCategoricalCrossentropy(from_logits=True, label_smoothing=LABEL_SMOOTHING),
        metrics=["accuracy"],
    )

    callbacks = []
    if save_dir:
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)
        callbacks.append(
            tf.keras.callbacks.ModelCheckpoint(
                str(save_dir / checkpoint_name),
                save_best_only=True,
                monitor="val_loss",
            )
        )

    keras_model.fit(
        train_ds,
        steps_per_epoch=train_steps,
        validation_data=val_ds,
        validation_steps=min(100, val_steps),
        epochs=epochs,
        callbacks=callbacks,
    )
    return keras_model, vectorizer


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Train sign-to-text on How2Sign Holistic")
    parser.add_argument("--npys_root", type=str, default="./data/how2sign_holistic", help="Path to how2sign_holistic_features (contains train/val/test with frontal/ side/)")
    parser.add_argument("--cache_dir", type=str, default=None, help="Root where metadata/npys live (e.g. parent of datasets/). If set, npys_root can be derived from cache_dir/datasets/PSewmuthu--How2Sign_Holistic/how2sign_holistic_features")
    parser.add_argument("--view", type=str, default="frontal")
    parser.add_argument("--model", type=str, default="transformer", choices=("transformer", "lstm"), help="Model architecture: transformer (modern) or lstm (baseline)")
    parser.add_argument("--learning_rate", type=float, default=1e-4, help="Peak learning rate (transformer uses warmup+cosine decay)")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=BATCH_SIZE)
    parser.add_argument("--max_frames", type=int, default=MAX_FRAMES)
    parser.add_argument("--save_dir", type=str, default="./checkpoints/how2sign_holistic")
    args = parser.parse_args()
    run_train(
        npys_root=args.npys_root,
        view=args.view,
        epochs=args.epochs,
        batch_size=args.batch_size,
        max_frames=args.max_frames,
        save_dir=args.save_dir,
        cache_dir=args.cache_dir,
        model_type=args.model,
        learning_rate=args.learning_rate,
    )


if __name__ == "__main__":
    main()
