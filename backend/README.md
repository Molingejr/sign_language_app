# Backend API

FastAPI app for sign language inference. Run from **repo root** so `wlasl_i3d` and weights resolve.

## Virtual environment

Create (already done if you ran the project setup):

```bash
# From repo root
python3 -m venv backend/.venv
```

Activate:

```bash
# macOS/Linux
source backend/.venv/bin/activate

# Windows (cmd)
backend\.venv\Scripts\activate.bat

# Windows (PowerShell)
backend\.venv\Scripts\Activate.ps1
```

Then install dependencies (from repo root):

```bash
pip install -r backend/requirements.txt
```

## Run

From repo root with venv activated:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

See **docs/RUN.md** for full setup (weights, env vars, frontend).
