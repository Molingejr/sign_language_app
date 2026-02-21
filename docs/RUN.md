# How to run the app

## 1. One-time setup

### Backend (Python)
From repo root:
```bash
# Use your existing conda env or create one
conda activate sign_language_app
pip install -r backend/requirements.txt
# Ensure pretrained weights exist (see README_PRETRAINED_WLASL.md)
#   - pretrained_weights/rgb_imagenet.pt
#   - pretrained_weights/archived/asl2000/FINAL_nslt_2000_*.pt
```

### Frontend (Node)
```bash
cd frontend
npm install
```

## 2. Run (development)

**Terminal 1 – Backend**
```bash
# From repo root
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 – Frontend (dev server with proxy)**
```bash
cd frontend
npm run dev
```
Open http://localhost:5173 — the Vite dev server proxies `/predict` and `/health` to the backend.

## 3. Run (single-server production)

Build the frontend, then run only the backend; it will serve the SPA at `/`:
```bash
cd frontend && npm run build && cd ..
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Open http://localhost:8000 — same origin for API and UI.

## Optional env vars (backend)

- `NUM_CLASSES` — default 2000  
- `MAX_FRAMES` — default 64  
- `CHECKPOINT_PATH` — path to WLASL .pt (relative to repo root or absolute)  
- `CLASS_LIST_PATH` — path to wlasl_class_list.txt  
- `WEIGHTS_DIR` — directory containing rgb_imagenet.pt  

Example (smaller vocab, different checkpoint):
```bash
export NUM_CLASSES=100
export CHECKPOINT_PATH=pretrained_weights/archived/asl100/FINAL_nslt_100_iters=896_top1=65.89_top5=84.11_top10=89.92.pt
uvicorn backend.app.main:app --port 8000
```
