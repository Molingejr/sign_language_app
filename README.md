# CareSign

Sign language for healthcare: **Sign Interpretation** (camera → gloss), **Finger Spelling**, and **Voice to Avatar**. Built for hospitals and care settings. Backend: FastAPI + WLASL I3D. Frontend: Vite + React + TypeScript + Tailwind.

## Quick start

Run backend and frontend in **two terminals** (both from repo root).

### Backend

```bash
# Create venv (first time only)
python3 -m venv backend/.venv

# Activate venv
source backend/.venv/bin/activate   # macOS/Linux
# backend\.venv\Scripts\activate    # Windows

# Install dependencies (first time only)
pip install -r backend/requirements.txt

# Start API (from repo root)
uvicorn backend.app.main:app --reload --port 8000
```

API: [http://127.0.0.1:8000](http://127.0.0.1:8000)  
Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Frontend

```bash
# Install dependencies (first time only)
cd frontend && npm install

# Start dev server
npm run dev
```

App: [http://localhost:5173](http://localhost:5173) (Vite proxies `/predict` and `/health` to the backend.)

---

**Weights:** Put pretrained weights under `backend/pretrained_weights/` (see `backend/README.md`). Dataset and weights are gitignored.
