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
RGB_BACKBONE_PATH = WEIGHTS_DIR / "rgb_imagenet.pt"

# Static frontend (after npm run build)
FRONTEND_DIST = ROOT / "frontend" / "dist"
