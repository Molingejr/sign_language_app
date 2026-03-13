"""FastAPI app: /predict for video inference, serves frontend static files."""
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.config import FRONTEND_DIST, WLASL_VIDEOS_DIR
from backend.app.fingerspelling import predict_letter
from backend.app.gloss_to_sentence import glosses_to_sentence
from backend.app.gloss_to_signs import glosses_to_sign_sequence
from backend.app.inference import predict, predict_sentence
from backend.app.text_to_gloss import text_to_glosses

logger = logging.getLogger(__name__)

app = FastAPI(title="CareSign API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict_endpoint(video: UploadFile = File(...)):
    # Accept any upload; inference will fail if not valid video
    try:
        body = await video.read()
    except Exception as e:
        raise HTTPException(400, f"Failed to read upload: {e}") from e
    if len(body) == 0:
        raise HTTPException(400, "Empty file")
    try:
        result = predict(body, filename=video.filename)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {e}") from e
    return result


@app.post("/predict-sentence")
async def predict_sentence_endpoint(video: UploadFile = File(...)):
    """Upload a longer video of sentence-level signing; returns segmented glosses + sentence."""
    try:
        body = await video.read()
    except Exception as e:
        raise HTTPException(400, f"Failed to read upload: {e}") from e
    if len(body) == 0:
        raise HTTPException(400, "Empty file")
    try:
        result = predict_sentence(body, filename=video.filename)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {e}") from e
    return result


class GlossToSentenceRequest(BaseModel):
    glosses: list[str]


class GlossToSentenceResponse(BaseModel):
    sentence: str


class TextToGlossRequest(BaseModel):
    text: str


class TextToGlossResponse(BaseModel):
    glosses: list[str]


class GlossToSignsRequest(BaseModel):
    glosses: list[str]


# Sign item: {"type": "sign", "gloss": str} | {"type": "fingerspell", "letters": list[str]}
class GlossToSignsResponse(BaseModel):
    sequence: list[dict]


class FingerspellingRequest(BaseModel):
    """21 MediaPipe hand landmarks: [ [x,y,z], ... ] (x,y normalized 0-1; z depth from wrist)."""
    landmarks: list[list[float]]


@app.post("/predict-fingerspelling")
async def predict_fingerspelling_endpoint(body: FingerspellingRequest):
    """Predict one ASL letter from 21 hand landmarks (MediaPipe format)."""
    if len(body.landmarks) != 21:
        raise HTTPException(
            400,
            f"Expected 21 landmarks, got {len(body.landmarks)}",
        )
    try:
        result = predict_letter(body.landmarks)
    except Exception as e:
        logger.exception("Fingerspelling failed")
        raise HTTPException(500, f"Fingerspelling failed: {e}") from e
    return result


@app.post("/gloss-to-sentence", response_model=GlossToSentenceResponse)
async def gloss_to_sentence_endpoint(body: GlossToSentenceRequest):
    sentence = glosses_to_sentence(body.glosses)
    return GlossToSentenceResponse(sentence=sentence)


@app.post("/text-to-gloss", response_model=TextToGlossResponse)
async def text_to_gloss_endpoint(body: TextToGlossRequest):
    """Convert English text to a sequence of sign glosses (for voice-to-avatar)."""
    glosses = text_to_glosses(body.text or "")
    return TextToGlossResponse(glosses=glosses)


@app.post("/gloss-to-signs", response_model=GlossToSignsResponse)
async def gloss_to_signs_endpoint(body: GlossToSignsRequest):
    """Convert gloss sequence to sign playback sequence (sign vs fingerspell items)."""
    sequence = glosses_to_sign_sequence(body.glosses or [])
    return GlossToSignsResponse(sequence=sequence)


@app.get("/sign-video/{video_id}")
async def sign_video_endpoint(video_id: str):
    """Serve a WLASL sign video by id (from dataset/videos/). Safe path only."""
    if not video_id or not video_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(400, "Invalid video_id")
    path = WLASL_VIDEOS_DIR / f"{video_id}.mp4"
    if not path.is_file():
        raise HTTPException(404, "Video not found")
    return FileResponse(path, media_type="video/mp4")


# Serve frontend SPA (single-server deployment)
if FRONTEND_DIST.exists():

    @app.get("/")
    def index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/assets/{rest:path}")
    def assets(rest: str):
        p = FRONTEND_DIST / "assets" / rest
        if not p.is_file():
            raise HTTPException(404)
        return FileResponse(p)

    @app.get("/{path:path}")
    def spa(path: str):
        """Catch-all for SPA routes; serve index.html."""
        p = FRONTEND_DIST / path
        if p.is_file():
            return FileResponse(p)
        return FileResponse(FRONTEND_DIST / "index.html")
