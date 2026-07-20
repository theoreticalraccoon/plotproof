# PlotProof analysis service — the queued-job HTTP contract (server.py).
# Build & run:
#   docker build -t plotproof-analysis ./service
#   docker run -p 8000:8000 plotproof-analysis
# Deploys as-is to any container host (Railway, Render, Fly.io, Cloud Run) —
# they inject PORT, which server.py honours.
FROM python:3.13-slim

WORKDIR /app

# Deps first for layer caching. Wheels only — no compiler toolchain in the image.
COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt

COPY *.py ./

# Scene cache + rendered tiles live here; mount a volume to persist across restarts.
VOLUME ["/app/.cache", "/app/output"]

EXPOSE 8000
CMD ["python", "server.py"]
