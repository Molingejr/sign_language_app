"""FastAPI app: /predict for video inference, serves frontend static files."""
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.app.config import FRONTEND_DIST
from backend.app.inference import predict

app = FastAPI(title="Sign Language Interpretation API", version="0.1.0")
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
