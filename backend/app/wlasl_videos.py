"""
Gloss → local video lookup using dataset/WLASL_v0.3.json and dataset/videos/.
WLASL_v0.3.json: array of { "gloss": str, "instances": [ { "video_id": str }, ... ] }.
Local files: dataset/videos/{video_id}.mp4. missing.txt lists video_ids not available locally.
"""
from __future__ import annotations

import json
from pathlib import Path

from backend.app.config import (
    WLASL_JSON_PATH,
    WLASL_MISSING_PATH,
    WLASL_VIDEOS_DIR,
)

# gloss (lowercase) -> list of video_ids that exist locally (first is preferred)
_gloss_to_video_ids_cache: list[dict[str, list[str]] | None] = [None]


def _load_missing_ids() -> set[str]:
    if not WLASL_MISSING_PATH.exists():
        return set()
    out: set[str] = set()
    with open(WLASL_MISSING_PATH, "r", encoding="utf-8") as f:
        for line in f:
            vid = line.strip()
            if vid:
                out.add(vid)
    return out


def _load_gloss_to_video_ids() -> dict[str, list[str]]:
    if _gloss_to_video_ids_cache[0] is not None:
        return _gloss_to_video_ids_cache[0]

    missing = _load_missing_ids()
    result: dict[str, list[str]] = {}

    if WLASL_JSON_PATH.exists():
        with open(WLASL_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        for entry in data:
            gloss = (entry.get("gloss") or "").strip()
            if not gloss:
                continue
            key = gloss.lower()
            instances = entry.get("instances") or []
            available: list[str] = []
            for inst in instances:
                vid = inst.get("video_id")
                if vid is None:
                    continue
                vid_str = str(vid).strip()
                if vid_str in missing:
                    continue
                path = WLASL_VIDEOS_DIR / f"{vid_str}.mp4"
                if path.is_file():
                    available.append(vid_str)
            if available:
                result[key] = available

    _gloss_to_video_ids_cache[0] = result
    return result


def get_video_id_for_gloss(gloss: str) -> str | None:
    """
    Return one video_id that has a local file for this gloss, or None.
    Prefers the first available instance in WLASL_v0.3.json.
    """
    if not gloss:
        return None
    mapping = _load_gloss_to_video_ids()
    ids = mapping.get(gloss.lower())
    if ids:
        return ids[0]
    # try uppercase (class list uses lowercase gloss names)
    ids = mapping.get(gloss.upper().lower())
    return ids[0] if ids else None


def get_video_path_for_gloss(gloss: str) -> Path | None:
    """Return path to local video file for this gloss, or None."""
    vid = get_video_id_for_gloss(gloss)
    if vid is None:
        return None
    p = WLASL_VIDEOS_DIR / f"{vid}.mp4"
    return p if p.is_file() else None
