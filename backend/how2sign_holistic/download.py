"""Download How2Sign Holistic metadata and (optionally) extract .npy from .rar archives."""
from pathlib import Path
from typing import Literal

from huggingface_hub import hf_hub_download, snapshot_download

REPO_ID = "PSewmuthu/How2Sign_Holistic"
# Folder name: repo_id with "/" → "--" (e.g. PSewmuthu--How2Sign_Holistic/how2sign_holistic_features)
HF_REPO_SLUG = REPO_ID.replace("/", "--")
FEATURES_ROOT = "how2sign_holistic_features"
Split = Literal["train", "val", "test"]


def _repo_root(cache_dir: Path) -> Path | None:
    """Return path to repo content (under slug, possibly under snapshots/<rev>/)."""
    for slug_dir in (cache_dir / HF_REPO_SLUG, cache_dir / "datasets" / HF_REPO_SLUG):
        if not slug_dir.is_dir():
            continue
        snapshots = slug_dir / "snapshots"
        if snapshots.is_dir():
            revs = sorted(snapshots.iterdir())
            if revs:
                return revs[-1]  # latest revision
        return slug_dir
    return None


def ensure_metadata(cache_dir: str | Path | None = None) -> Path:
    """
    Download only metadata CSVs from How2Sign_Holistic (lightweight).

    Returns:
        Path to the metadata directory inside the HF cache.
    """
    cache_dir = Path(cache_dir) if cache_dir else None
    for split in ("train", "val", "test"):
        for realigned in (True, False):
            name = "how2sign_realigned" if realigned else "how2sign"
            filename = f"{FEATURES_ROOT}/metadata/{name}_{split}.csv"
            hf_hub_download(
                repo_id=REPO_ID,
                repo_type="dataset",
                filename=filename,
                cache_dir=str(cache_dir) if cache_dir else None,
            )
    # Return metadata dir (official HF cache: cache_dir/<slug>/snapshots/<rev>/ or <slug>/)
    if cache_dir:
        root = _repo_root(cache_dir)
        if root is not None:
            md = root / FEATURES_ROOT / "metadata"
            if md.exists():
                return md
    # Default cache: ~/.cache/huggingface/hub/datasets--PSewmuthu--How2Sign_Holistic
    local = hf_hub_download(
        repo_id=REPO_ID,
        repo_type="dataset",
        filename=f"{FEATURES_ROOT}/metadata/how2sign_realigned_train.csv",
        cache_dir=str(cache_dir) if cache_dir else None,
    )
    return Path(local).parent


def ensure_split_npys(
    split: Split,
    view: Literal["frontal", "side"] = "frontal",
    cache_dir: str | Path | None = None,
    out_dir: str | Path | None = None,
    extract_rar: bool = True,
) -> Path:
    """
    Download .rar for a split/view and optionally extract to out_dir.

    The dataset stores .npy files inside .rar archives. This downloads the .rar
    and, if extract_rar is True, extracts it so you get a directory of .npy files.
    Requires system `unrar` or Python `patoolib`/`rarfile` for extraction.

    Args:
        split: 'train', 'val', or 'test'
        view: 'frontal' or 'side'
        cache_dir: HF cache directory.
        out_dir: Where to extract .npy files (e.g. ./data/how2sign_holistic).
                 Default: next to the downloaded .rar in the HF cache.
        extract_rar: If True, extract the .rar to out_dir. If False, only download .rar.

    Returns:
        Path to the directory containing .npy files (after extract), or the .rar file's directory.
    """
    cache_dir = Path(cache_dir) if cache_dir else None
    rar_name = f"{view}.rar"
    filename = f"{FEATURES_ROOT}/{split}/{rar_name}"
    local_rar = hf_hub_download(
        repo_id=REPO_ID,
        repo_type="dataset",
        filename=filename,
        cache_dir=str(cache_dir) if cache_dir else None,
    )
    rar_path = Path(local_rar)
    if not extract_rar:
        return rar_path.parent
    target = Path(out_dir) if out_dir else rar_path.parent
    target.mkdir(parents=True, exist_ok=True)
    try:
        import patoolib
        patoolib.extract_archive(str(rar_path), outdir=str(target))
    except (ImportError, OSError, Exception) as e:
        try:
            import rarfile
            rf = rarfile.RarFile(rar_path)
            rf.extractall(target)
        except (ImportError, OSError, Exception) as extract_err:
            raise RuntimeError(
                "Extract .rar manually: install 'unrar' or 'patool' (pip install patool rarfile). "
                f"RAR path: {rar_path}. Error: {extract_err}"
            ) from extract_err
    return target


def download_full_repo(cache_dir: str | Path | None = None) -> Path:
    """
    Snapshot-download the entire How2Sign_Holistic repo (metadata + all .rar files).

    Does not extract .rar files; use ensure_split_npys(..., extract_rar=True) per split/view.
    """
    local = snapshot_download(
        repo_id=REPO_ID,
        repo_type="dataset",
        cache_dir=str(cache_dir) if cache_dir else None,
    )
    return Path(local)
