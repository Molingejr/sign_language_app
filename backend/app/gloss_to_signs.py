"""
Gloss sequence → sign playback sequence for voice-to-avatar.
- Known gloss → sign (one item; optional video_id from WLASL dataset).
- Unknown (?WORD) or single letters → fingerspell sequence.
Uses same glossary as text_to_gloss and WLASL_v0.3.json + dataset/videos for lookup.
"""
from __future__ import annotations

from backend.app.text_to_gloss import _load_glossary
from backend.app.wlasl_videos import get_video_id_for_gloss


def _known_glosses() -> set[str]:
    """Set of canonical glosses we have in the glossary (sign vocabulary)."""
    glossary = _load_glossary()
    return set(glossary.values())


def glosses_to_sign_sequence(glosses: list[str]) -> list[dict]:
    """
    Convert a list of glosses to a playback sequence.
    Each item is either:
      {"type": "sign", "gloss": str, "video_id": str | None}  — known sign (video_id if we have local WLASL clip)
      {"type": "fingerspell", "letters": list[str]}  — spell out (e.g. unknown word)
    """
    known = _known_glosses()
    result: list[dict] = []

    for g in glosses:
        if not g:
            continue
        # Unknown word from text_to_gloss (e.g. ?JOHN)
        if g.startswith("?"):
            letters = [c.upper() for c in g[1:] if c.isalpha()]
            if letters:
                result.append({"type": "fingerspell", "letters": letters})
            continue
        # Single letter A–Z: we have a sign for it
        if len(g) == 1 and g.upper() in known:
            canon = g.upper()
            video_id = get_video_id_for_gloss(canon)
            result.append({"type": "sign", "gloss": canon, "video_id": video_id})
            continue
        # Multi-character gloss: known → sign, else fingerspell
        if g.upper() in known or g in known:
            canon = g.upper() if g.upper() in known else g
            video_id = get_video_id_for_gloss(canon)
            result.append({"type": "sign", "gloss": canon, "video_id": video_id})
        else:
            letters = [c.upper() for c in g if c.isalpha()]
            if letters:
                result.append({"type": "fingerspell", "letters": letters})

    return result
