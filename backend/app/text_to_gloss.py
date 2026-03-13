"""
Rule-based text → gloss sequence for voice-to-avatar.
- Glossary: WLASL class list, optional extra file. Known words → explicit gloss.
- English vocabulary (english-words): any known English word → single gloss (no fingerspelling).
- Lemmatization (simplemma): word forms → base form for lookup.
- Fingerspelling: only for tokens not in the English word list (e.g. names, typos).
"""
from pathlib import Path
import re

import simplemma

from backend.app.config import CLASS_LIST_PATH, NUM_CLASSES, TEXT_TO_GLOSS_EXTRA_PATH

# Lazy-loaded English word set (so we don't fingerspell simple words like "job", "computer").
_english_words: set[str] | None = None


def _get_english_words() -> set[str]:
    """Known English words (lowercase). Used to treat unknown-but-English tokens as one gloss."""
    global _english_words
    if _english_words is None:
        try:
            from english_words import get_english_words_set
            _english_words = get_english_words_set(["web2"], lower=True)
        except ImportError:
            _english_words = set()  # no package: fall back to fingerspelling for unknown words
    return _english_words

# When CLASS_LIST_PATH is missing: only A–Z so we can fingerspell. English words come from english-words.
_FALLBACK_GLOSSES = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
]

# Cache: [None] until loaded, then [dict]
_glossary_cache: list[dict[str, str] | None] = [None]


def _load_glossary() -> dict[str, str]:
    """Build map: lowercase token/phrase -> canonical gloss. Lazy load once."""
    if _glossary_cache[0] is not None:
        return _glossary_cache[0]

    out: dict[str, str] = {}

    # 1) Class list from file (same as inference) or fallback
    if isinstance(CLASS_LIST_PATH, Path) and CLASS_LIST_PATH.exists():
        with open(CLASS_LIST_PATH, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= NUM_CLASSES:
                    break
                parts = line.strip().split("\t")
                gloss = parts[1] if len(parts) > 1 else line.strip()
                if gloss and gloss != "(no sign)":
                    out[gloss.lower()] = gloss
    else:
        for g in _FALLBACK_GLOSSES:
            if g and g != "(no sign)":
                out[g.lower()] = g

    # 2) Optional extra glossary (e.g. healthcare terms, How2Sign vocab)
    if isinstance(TEXT_TO_GLOSS_EXTRA_PATH, Path) and TEXT_TO_GLOSS_EXTRA_PATH.exists():
        with open(TEXT_TO_GLOSS_EXTRA_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t", 1)
                if len(parts) == 2:
                    word_or_phrase, gloss = parts[0].strip().lower(), parts[1].strip()
                else:
                    gloss = line
                    word_or_phrase = gloss.lower()
                if gloss and gloss != "(no sign)":
                    out[word_or_phrase] = gloss

    _glossary_cache[0] = out
    return out


def _tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric, drop empty."""
    text = (text or "").strip().lower()
    if not text:
        return []
    tokens = re.split(r"[^a-z0-9']+", text)
    return [t for t in tokens if t]


def text_to_glosses(text: str) -> list[str]:
    """
    Convert English text to a sequence of glosses.
    - Glossary: known words → explicit gloss.
    - English vocabulary: other known English words → one gloss (no fingerspelling).
    - Fingerspelling: only for tokens not in the English word list (e.g. names, typos).
    """
    glossary = _load_glossary()
    tokens = _tokenize(text)
    if not tokens:
        return []

    result: list[str] = []
    for i in range(len(tokens)):
        word = tokens[i]
        lemma = simplemma.lemmatize(word, lang="en") if word.isalpha() else word
        for candidate in (word, lemma):
            if candidate and candidate in glossary:
                result.append(glossary[candidate])
                break
        else:
            # Not in our glossary: if it's a known English word, output as one gloss (no fingerspelling)
            english_words = _get_english_words()
            if word in english_words or (lemma and lemma in english_words):
                result.append((lemma if lemma else word).upper())
            else:
                # Fingerspell: names, typos, non-English
                letters_in_vocab = all(c in glossary for c in word if c.isalpha())
                if letters_in_vocab:
                    for c in word:
                        if c.isalpha():
                            result.append(glossary[c])
                else:
                    result.append(f"?{word.upper()}")

    return result
