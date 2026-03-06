"""Load WLASL I3D once and run inference on uploaded video bytes."""
import tempfile
from pathlib import Path

import cv2
import numpy as np
import torch
from torchvision import transforms

from backend.wlasl_i3d.pytorch_i3d import InceptionI3d
from backend.wlasl_i3d.videotransforms import CenterCrop

from backend.app.config import (
    CHECKPOINT_PATH,
    CLASS_LIST_PATH,
    MAX_FRAMES,
    MIN_CONFIDENCE_THRESHOLD,
    NUM_CLASSES,
    PREPROCESS_VIDEO,
    RGB_BACKBONE_PATH,
)


def _video_to_tensor(pic: np.ndarray) -> torch.Tensor:
    """(T,H,W,C) -> (C,T,H,W)"""
    return torch.from_numpy(pic.transpose([3, 0, 1, 2])).float()


def _preprocess_frame(img: np.ndarray) -> np.ndarray:
    """Per-frame CLAHE on luminance for robustness to lighting (paper: image processing). BGR uint8 -> BGR uint8."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    lab = cv2.merge([l_ch, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def _load_frames_from_video_bytes(
    video_bytes: bytes,
    max_frames: int = MAX_FRAMES,
    *,
    filename: str | None = None,
) -> np.ndarray:
    """Decode video bytes to RGB frames; return array of shape (T, H, W, 3) normalized to [-1,1], min 226."""
    # Use correct extension so OpenCV picks the right demuxer.
    suffix = ".mp4"
    if filename:
        lower = filename.lower()
        if lower.endswith(".webm"):
            suffix = ".webm"
        elif lower.endswith((".mpg", ".mpeg")):
            suffix = ".mpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(video_bytes)
        path = f.name
    try:
        vidcap = cv2.VideoCapture(path)
        total = int(vidcap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        frames = []
        # Some codecs (e.g. WebM) don't report frame count; read sequentially if so.
        if total >= 2:
            indices = np.linspace(0, total - 1, min(max_frames, total), dtype=int)
            for i in indices:
                vidcap.set(cv2.CAP_PROP_POS_FRAMES, i)
                ok, img = vidcap.read()
                if not ok:
                    continue
                h, w = img.shape[:2]
                if w < 226 or h < 226:
                    d = 226.0 - min(w, h)
                    sc = 1 + d / min(w, h)
                    img = cv2.resize(img, dsize=(0, 0), fx=sc, fy=sc)
                if PREPROCESS_VIDEO:
                    img = _preprocess_frame(img)
                img = (img.astype(np.float32) / 255.0) * 2.0 - 1.0
                frames.append(img)
        else:
            # Read until we have enough frames or stream ends (handles missing frame count).
            while len(frames) < max_frames:
                ok, img = vidcap.read()
                if not ok:
                    break
                h, w = img.shape[:2]
                if w < 226 or h < 226:
                    d = 226.0 - min(w, h)
                    sc = 1 + d / min(w, h)
                    img = cv2.resize(img, dsize=(0, 0), fx=sc, fy=sc)
                if PREPROCESS_VIDEO:
                    img = _preprocess_frame(img)
                img = (img.astype(np.float32) / 255.0) * 2.0 - 1.0
                frames.append(img)
        vidcap.release()
        if not frames:
            return np.zeros((max_frames, 224, 224, 3), dtype=np.float32)
        out = np.stack(frames, axis=0)
        # Pad or trim to max_frames
        if out.shape[0] < max_frames:
            pad = np.tile(out[-1:], (max_frames - out.shape[0], 1, 1, 1))
            out = np.concatenate([out, pad], axis=0)
        elif out.shape[0] > max_frames:
            out = out[:max_frames]
        return out
    finally:
        Path(path).unlink(missing_ok=True)


def load_class_list(path: Path, num_classes: int) -> list[str]:
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= num_classes:
                break
            parts = line.strip().split("\t")
            out.append(parts[1] if len(parts) > 1 else str(i))
    return out


_model = None
_class_names = None
_device = None
_transform = None


def get_model():
    """Load model and class list once; reuse."""
    global _model, _class_names, _device, _transform
    if _model is not None:
        return _model, _class_names, _device, _transform
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _class_names = load_class_list(CLASS_LIST_PATH, NUM_CLASSES)
    _transform = transforms.Compose([CenterCrop(224)])
    i3d = InceptionI3d(400, in_channels=3)
    i3d.load_state_dict(
        torch.load(str(RGB_BACKBONE_PATH), map_location=_device, weights_only=True)
    )
    i3d.replace_logits(NUM_CLASSES)
    state = torch.load(
        str(CHECKPOINT_PATH), map_location=_device, weights_only=True
    )
    if state and list(state.keys())[0].startswith("module."):
        state = {k.replace("module.", ""): v for k, v in state.items()}
    i3d.load_state_dict(state, strict=False)
    i3d = i3d.to(_device)
    i3d.eval()
    _model = i3d
    return _model, _class_names, _device, _transform


def _is_empty_frames(frames: np.ndarray) -> bool:
    """True if frames are all zeros (no real video decoded)."""
    return bool(np.all(frames == 0))


def predict(video_bytes: bytes, *, filename: str | None = None) -> dict:
    """Run inference on video bytes. Returns { gloss, top_k, confidence }."""
    model, class_names, device, transform = get_model()
    frames = _load_frames_from_video_bytes(video_bytes, MAX_FRAMES, filename=filename)
    if _is_empty_frames(frames):
        return {
            "gloss": "(no sign)",
            "top_k": [],
            "confidence": 0.0,
        }
    if transform is not None:
        frames = transform(frames)
    tensor = _video_to_tensor(frames).unsqueeze(0).to(device)  # (1, C, T, H, W)
    with torch.no_grad():
        logits = model(tensor)
    pred = torch.max(logits, dim=2)[0][0].cpu().numpy()
    top_indices = pred.argsort()[::-1]
    top1_idx = int(top_indices[0])
    top_k = [class_names[i] for i in top_indices[:5] if i < len(class_names)]
    gloss = class_names[top1_idx] if top1_idx < len(class_names) else str(top1_idx)
    # confidence as softmax prob of top-1
    exp = np.exp(pred - pred.max())
    prob = float(exp[top1_idx] / exp.sum())
    if prob < MIN_CONFIDENCE_THRESHOLD:
        return {
            "gloss": "(no sign)",
            "top_k": top_k,
            "confidence": 0.0,
        }
    return {"gloss": gloss, "top_k": top_k, "confidence": round(prob, 4)}


# Sentence-level: segment long video into 64-frame chunks, run I3D on each, return gloss list.
SENTENCE_MAX_FRAMES = 640  # ~20s at 32fps
SENTENCE_STRIDE = 32  # overlap by half


def predict_sentence(video_bytes: bytes, *, filename: str | None = None) -> dict:
    """Segment video into 64-frame windows, run I3D on each, return glosses + sentence."""
    from backend.app.gloss_to_sentence import glosses_to_sentence

    model, class_names, device, transform = get_model()
    frames = _load_frames_from_video_bytes(
        video_bytes, max_frames=SENTENCE_MAX_FRAMES, filename=filename
    )
    T = frames.shape[0]
    if _is_empty_frames(frames) or T < MAX_FRAMES:
        single = predict(video_bytes, filename=filename)
        glosses = [single["gloss"]] if single["gloss"] != "(no sign)" else []
        sentence = glosses_to_sentence(glosses) if glosses else ""
        return {"glosses": glosses, "sentence": sentence}

    glosses = []
    for start in range(0, T - MAX_FRAMES + 1, SENTENCE_STRIDE):
        seg = frames[start : start + MAX_FRAMES]
        if transform is not None:
            seg = transform(seg)
        tensor = _video_to_tensor(seg).unsqueeze(0).to(device)
        with torch.no_grad():
            logits = model(tensor)
        pred = torch.max(logits, dim=2)[0][0].cpu().numpy()
        top1_idx = int(pred.argsort()[::-1][0])
        exp = np.exp(pred - pred.max())
        prob = float(exp[top1_idx] / exp.sum())
        if prob >= MIN_CONFIDENCE_THRESHOLD and top1_idx < len(class_names):
            g = class_names[top1_idx]
            if g != "(no sign)" and (not glosses or glosses[-1] != g):
                glosses.append(g)
    sentence = glosses_to_sentence(glosses) if glosses else ""
    return {"glosses": glosses, "sentence": sentence}
