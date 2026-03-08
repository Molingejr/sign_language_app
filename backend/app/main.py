"""FastAPI app: /predict for video inference, serves frontend static files."""
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.config import FRONTEND_DIST
from backend.app.fingerspelling import predict_letter
from backend.app.gloss_to_sentence import glosses_to_sentence
from backend.app.inference import predict, predict_sentence

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
