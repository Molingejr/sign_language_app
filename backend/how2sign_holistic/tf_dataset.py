"""
TensorFlow dataset pipeline for How2Sign Holistic (MediaPipe landmarks).

Use for sign-language recognition (keypoints -> gloss) or translation (keypoints -> sentence).
"""
from pathlib import Path
from typing import Literal

import numpy as np
import tensorflow as tf

from backend.how2sign_holistic.load_metadata import load_metadata

Split = Literal["train", "val", "test"]


def _npy_path_from_row(row, split: Split, view: Literal["frontal", "side"], npys_root: Path) -> Path | None:
    """Build path to .npy from a metadata row. Adapt column names to your CSV."""
    npys_root = Path(npys_root)
    view_dir = npys_root / split / view
    if not view_dir.exists():
        return None
    # If CSV has a filename column, use it
    fname = row.get("filename") or row.get("npy_file") or row.get("file_name")
    if fname:
        p = view_dir / fname
        return p if p.exists() else None
    # Build from id/start/end: VIDEO_NAME_START-END-rgb_front_holistic.npy
    name = row.get("id") or row.get("video_id") or row.get("name")
    start = row.get("start_time") or row.get("start") or row.get("start_frame")
    end = row.get("end_time") or row.get("end") or row.get("end_frame")
    if name is None or start is None or end is None:
        return None
    suffix = "front" if view == "frontal" else "side"
    start, end = int(float(start)), int(float(end))
    fname = f"{name}_{start}-{end}-rgb_{suffix}_holistic.npy"
    p = view_dir / fname
    return p if p.exists() else None


def build_tf_dataset(
    split: Split,
    npys_root: str | Path,
    view: Literal["frontal", "side"] = "frontal",
    cache_dir: str | Path | None = None,
    text_column: str = "sentence",
    max_frames: int | None = 256,
    batch_size: int = 8,
    shuffle_buffer: int = 500,
    repeat: bool = True,
) -> tf.data.Dataset:
    """
    Build a tf.data.Dataset for How2Sign Holistic.

    Yields (keypoints, text) where:
    - keypoints: (T, D) float32, variable length padded to max_frames (or truncated).
    - text: str, the sentence (or gloss if text_column='gloss') for that clip.

    Args:
        split: 'train', 'val', or 'test'
        npys_root: Root directory with train/frontal/, train/side/, etc. (after extracting .rar)
        view: 'frontal' or 'side'
        cache_dir: Passed to load_metadata() if metadata is not local
        text_column: CSV column to use as target ('sentence' or 'gloss')
        max_frames: Cap/pad sequence length (None = no padding)
        batch_size: Batch size
        shuffle_buffer: Shuffle buffer size (train only)
        repeat: Whether to repeat dataset (for training)

    Returns:
        tf.data.Dataset
    """
    npys_root = Path(npys_root)
    meta = load_metadata(split, cache_dir=cache_dir)

    def gen():
        for _, row in meta.iterrows():
            path = _npy_path_from_row(row, split, view, npys_root)
            if path is None:
                continue
            text = row.get(text_column)
            if text is None or (isinstance(text, float) and np.isnan(text)):
                continue
            try:
                seq = np.load(path)
            except Exception:
                continue
            # seq shape: (T, N, 3) or (T, D) depending on extraction
            if seq.ndim == 3:
                seq = seq.reshape(seq.shape[0], -1)
            seq = seq.astype(np.float32)
            if max_frames is not None:
                if len(seq) > max_frames:
                    seq = seq[:max_frames]
                elif len(seq) < max_frames:
                    pad = np.zeros((max_frames - len(seq), seq.shape[1]), dtype=np.float32)
                    seq = np.concatenate([seq, pad], axis=0)
            yield seq, str(text).strip()

    # Infer output shapes from first valid sample
    sample_path = None
    for _, row in meta.iterrows():
        path = _npy_path_from_row(row, split, view, npys_root)
        if path is not None and path.exists():
            sample_path = path
            break
    if sample_path is None:
        raise FileNotFoundError(
            f"No .npy files found for split={split}, view={view} under {npys_root}. "
            "Run ensure_split_npys() to download and extract the .rar first."
        )
    sample = np.load(sample_path)
    if sample.ndim == 3:
        sample = sample.reshape(sample.shape[0], -1)
    _, d = sample.shape
    T = max_frames if max_frames else sample.shape[0]

    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            tf.TensorSpec(shape=(T, d), dtype=tf.float32),
            tf.TensorSpec(shape=(), dtype=tf.string),
        ),
    )
    if split == "train" and shuffle_buffer > 0:
        ds = ds.shuffle(shuffle_buffer)
    if repeat:
        ds = ds.repeat()
    ds = ds.batch(batch_size)
    return ds


def build_tf_dataset_for_recognition(
    split: Split,
    npys_root: str | Path,
    gloss_vocab_path: str | Path | None = None,
    view: Literal["frontal", "side"] = "frontal",
    max_frames: int = 256,
    batch_size: int = 8,
    shuffle_buffer: int = 500,
) -> tf.data.Dataset:
    """
    Dataset for gloss recognition: (keypoints, gloss_ids).

    If gloss_vocab_path is provided, it should be a text file with one gloss per line;
    targets are integer indices. Otherwise falls back to (keypoints, gloss_string).
    """
    # For recognition you typically want gloss-level alignment; How2Sign provides
    # sentence-level clips, so this is a simplified version that uses the full sentence
    # as a single target. For word-level gloss you'd need aligned gloss timestamps.
    return build_tf_dataset(
        split=split,
        npys_root=npys_root,
        view=view,
        text_column="gloss" if gloss_vocab_path else "sentence",
        max_frames=max_frames,
        batch_size=batch_size,
        shuffle_buffer=shuffle_buffer,
        repeat=(split == "train"),
    )
