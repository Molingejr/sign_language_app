"""Backend config: paths and model settings."""
import os
from pathlib import Path

# Backend package root (backend/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
# Repo root (for optional dataset/frontend paths)
ROOT = _BACKEND_ROOT.parent

# Model: weights live in backend/pretrained_weights/
NUM_CLASSES = int(os.environ.get("NUM_CLASSES", "2000"))
MAX_FRAMES = int(os.environ.get("MAX_FRAMES", "64"))
# Below this confidence, return "(no sign)" instead of top class (avoids e.g. always "BOOK" on empty video)
MIN_CONFIDENCE_THRESHOLD = float(os.environ.get("MIN_CONFIDENCE_THRESHOLD", "0.08"))
# Optional: per-frame CLAHE (contrast) to improve robustness to lighting (JETIR-style preprocessing)
PREPROCESS_VIDEO = os.environ.get("PREPROCESS_VIDEO", "false").lower() in ("true", "1", "yes")
WEIGHTS_DIR = Path(os.environ.get("WEIGHTS_DIR", str(_BACKEND_ROOT / "pretrained_weights")))
CHECKPOINT_PATH = Path(
    os.environ.get(
        "CHECKPOINT_PATH",
        str(_BACKEND_ROOT / "pretrained_weights/archived/asl2000/FINAL_nslt_2000_iters=5104_top1=32.48_top5=57.31_top10=66.31.pt"),
    )
)
CLASS_LIST_PATH = Path(
    os.environ.get("CLASS_LIST_PATH", str(ROOT / "dataset" / "wlasl_class_list.txt"))
)
# Optional: extra word→gloss list for text-to-gloss (one gloss per line, or word\tgloss). Merged with class list.
TEXT_TO_GLOSS_EXTRA_PATH = Path(
    os.environ.get("TEXT_TO_GLOSS_EXTRA_PATH", str(ROOT / "dataset" / "text_to_gloss_extra.txt"))
)
# WLASL gloss→video lookup for voice-to-avatar (optional)
WLASL_JSON_PATH = Path(
    os.environ.get("WLASL_JSON_PATH", str(ROOT / "dataset" / "WLASL_v0.3.json"))
)
WLASL_VIDEOS_DIR = Path(
    os.environ.get("WLASL_VIDEOS_DIR", str(ROOT / "dataset" / "videos"))
)
WLASL_MISSING_PATH = Path(
    os.environ.get("WLASL_MISSING_PATH", str(ROOT / "dataset" / "missing.txt"))
)
RGB_BACKBONE_PATH = WEIGHTS_DIR / "rgb_imagenet.pt"

# Static frontend (after npm run build)
FRONTEND_DIST = ROOT / "frontend" / "dist"

# Gloss→sentence: use pretrained text-to-text model (e.g. FLAN-T5). If unset or "false", use minimal fallback.
GLOSS_USE_MODEL = os.environ.get("GLOSS_USE_MODEL", "true").lower() in ("true", "1", "yes")
GLOSS_MODEL_NAME = os.environ.get("GLOSS_MODEL_NAME", "google/flan-t5-small")
GLOSS_DEVICE = os.environ.get("GLOSS_DEVICE", "cpu").lower()
