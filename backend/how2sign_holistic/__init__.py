"""
How2Sign Holistic: MediaPipe landmark data from the How2Sign ASL dataset.

Use with TensorFlow for sign-language recognition or translation.
Dataset: https://huggingface.co/datasets/PSewmuthu/How2Sign_Holistic
"""

from backend.how2sign_holistic.load_metadata import load_metadata, get_split_paths
from backend.how2sign_holistic.download import ensure_metadata, ensure_split_npys
from backend.how2sign_holistic.tf_dataset import build_tf_dataset

__all__ = [
    "load_metadata",
    "get_split_paths",
    "ensure_metadata",
    "ensure_split_npys",
    "build_tf_dataset",
]
