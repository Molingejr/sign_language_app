"""Gloss sequence → English sentence using a pretrained text-to-text model (e.g. FLAN-T5).

Set GLOSS_USE_MODEL=false to use minimal fallback (join glosses, capitalize, period).
Set GLOSS_MODEL_NAME to use a different HuggingFace model (e.g. google/flan-t5-base).
"""
from __future__ import annotations

_gloss_model = None
_tokenizer = None
_device = None


def _get_model():
    global _gloss_model, _tokenizer, _device
    if _gloss_model is not None:
        return _gloss_model, _tokenizer, _device
    try:
        from backend.app.config import GLOSS_DEVICE, GLOSS_MODEL_NAME, GLOSS_USE_MODEL

        if not GLOSS_USE_MODEL:
            return None, None, None
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        _tokenizer = AutoTokenizer.from_pretrained(GLOSS_MODEL_NAME)
        _gloss_model = AutoModelForSeq2SeqLM.from_pretrained(GLOSS_MODEL_NAME)
        _gloss_model.eval()
        _device = torch.device("cuda" if GLOSS_DEVICE == "cuda" else "cpu")
        _gloss_model = _gloss_model.to(_device)
        return _gloss_model, _tokenizer, _device
    except Exception:
        return None, None, None


def glosses_to_sentence(glosses: list[str]) -> str:
    """Convert a list of glosses to a natural English sentence using a pretrained model or minimal fallback."""
    words = [g.strip().lower() for g in glosses if g.strip() and g.strip().lower() != "(no sign)"]
    if not words:
        return ""

    model, tokenizer, dev = _get_model()
    if model is not None and tokenizer is not None and dev is not None:
        try:
            import torch

            prompt = "Convert these sign language glosses into one natural English sentence: " + ", ".join(words)
            inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            inputs = {k: v.to(dev) for k, v in inputs.items()}
            with torch.no_grad():
                out = model.generate(
                    **inputs,
                    max_new_tokens=64,
                    do_sample=False,
                    num_beams=2,
                )
            sentence = tokenizer.decode(out[0], skip_special_tokens=True).strip()
            if sentence:
                if not sentence.endswith((".", "!", "?")):
                    sentence += "."
                return sentence
        except Exception:
            pass

    return _minimal_fallback(words)


def _minimal_fallback(words: list[str]) -> str:
    """No phrase table: just join, capitalize, period."""
    if not words:
        return ""
    s = " ".join(words)
    return s[0].upper() + s[1:] + "." if s else ""
