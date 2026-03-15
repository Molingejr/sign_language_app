"""Load How2Sign Holistic metadata (CSV) from disk or Hugging Face cache."""
from pathlib import Path
from typing import Literal

import pandas as pd

from backend.how2sign_holistic.download import FEATURES_ROOT, REPO_ID, _repo_root

Split = Literal["train", "val", "test"]
METADATA_DIR = f"{FEATURES_ROOT}/metadata"


def _metadata_filename(split: Split, realigned: bool = True) -> str:
    name = "how2sign_realigned" if realigned else "how2sign"
    return f"{name}_{split}.csv"


def load_metadata(
    split: Split,
    cache_dir: str | Path | None = None,
    realigned: bool = True,
) -> pd.DataFrame:
    """
    Load metadata CSV for a split (train/val/test).

    Args:
        split: 'train', 'val', or 'test'
        cache_dir: Directory where HF has been downloaded (e.g. ~/.cache/huggingface/hub).
                   If None, uses huggingface_hub default cache and you must have
                   run ensure_metadata() first.
        realigned: Use realigned CSVs (recommended).

    Returns:
        DataFrame with tab-separated columns. Typical columns include
        sentence, gloss (or similar), and identifiers to match .npy clips.
    """
    if cache_dir is not None:
        cache_dir = Path(cache_dir)
        root = _repo_root(cache_dir)
        if root is not None:
            path = root / FEATURES_ROOT / "metadata"
        else:
            path = cache_dir / FEATURES_ROOT / "metadata"  # cache_dir is repo root
        if not path.exists():
            raise FileNotFoundError(
                f"Metadata not found under {cache_dir}. Run ensure_metadata(cache_dir) first."
            )
        csv_path = path / _metadata_filename(split, realigned)
        if not csv_path.exists():
            raise FileNotFoundError(f"Metadata file not found: {csv_path}")
        df = pd.read_csv(csv_path, sep="\t", low_memory=False)
    else:
        from huggingface_hub import hf_hub_download
        csv_path = hf_hub_download(
            repo_id=REPO_ID,
            repo_type="dataset",
            filename=f"{METADATA_DIR}/{_metadata_filename(split, realigned)}",
        )
        df = pd.read_csv(csv_path, sep="\t", low_memory=False)
    return df


def get_split_paths(
    split: Split,
    view: Literal["frontal", "side"] = "frontal",
    npys_root: str | Path | None = None,
) -> list[tuple[str, Path]]:
    """
    List (clip_id, path_to_npy) for a split from an extracted dataset.

    Use after ensure_split_npys() has extracted the .rar files so that
    npys_root contains e.g. train/frontal/*.npy.

    Args:
        split: 'train', 'val', or 'test'
        view: 'frontal' or 'side'
        npys_root: Root directory containing train/, val/, test/ with frontal/ and side/ subdirs.

    Returns:
        List of (clip_id, path). clip_id can be used to join with metadata.
    """
    npys_root = Path(npys_root) if npys_root else Path()
    view_dir = npys_root / split / view
    if not view_dir.is_dir():
        return []
    out = []
    for p in sorted(view_dir.glob("*.npy")):
        clip_id = p.stem.replace("_holistic", "").replace("-rgb_front", "").replace("-rgb_side", "")
        out.append((clip_id, p))
    return out
