"""HTTP analysis service — the queued-job contract the web app's HttpAnalysisClient
already speaks (lib/analysis/client.ts):

    POST /jobs              body = AnalysisRequest  -> JobHandle {jobId, plotId, status}
    GET  /jobs/<jobId>                              -> JobPoll (queued|running|succeeded|failed)
    GET  /tiles/<jobId>/<role>.png                  -> rendered before/after PNG (for the PDF)
    GET  /health                                    -> {ok:true}

Queued because a real analysis downloads and processes scenes (minutes): `submit`
returns immediately; a background worker runs analyze_plot and writes the result.

    ./.venv/Scripts/python.exe server.py            # serves on :8000

To point the web app at it: set ANALYSIS_SERVICE_URL=http://localhost:8000 and
ANALYSIS_STUB=0 (see lib/analysis/index.ts). No web-app code changes.
"""
from __future__ import annotations

import json
import os
import queue
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
from analyze import analyze_plot

TILES_ROOT = config.OUTPUT_DIR / "tiles"
PORT = int(os.environ.get("PORT", "8000"))  # container hosts inject PORT

_jobs: dict[str, dict] = {}
_lock = threading.Lock()
_q: "queue.Queue[str]" = queue.Queue()


def _worker():
    while True:
        job_id = _q.get()
        with _lock:
            job = _jobs.get(job_id)
        if not job:
            continue
        with _lock:
            job["status"] = "running"
        try:
            r = job["request"]
            result = analyze_plot(
                r.get("plotId", ""), r["geometry"], r.get("countryCode", ""),
                r.get("commodity", ""), r.get("cutoffDate", ""), job_id, TILES_ROOT,
            )
            with _lock:
                job["status"], job["result"] = "succeeded", result
        except Exception as e:  # a failed job is a first-class contract state
            with _lock:
                job["status"], job["error"] = "failed", f"{type(e).__name__}: {e}"


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj=None, raw=None, ctype="application/json"):
        body = raw if raw is not None else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.rstrip("/") == "/jobs":
            n = int(self.headers.get("content-length", 0) or 0)
            try:
                req = json.loads(self.rfile.read(n) or b"{}")
            except json.JSONDecodeError:
                return self._send(400, {"error": "invalid JSON"})
            if not req.get("geometry"):
                return self._send(400, {"error": "geometry (WGS84 Polygon) required"})
            job_id = str(uuid.uuid4())
            plot_id = req.get("plotId", "")
            with _lock:
                _jobs[job_id] = {"status": "queued", "plotId": plot_id, "request": req,
                                 "result": None, "error": None}
            _q.put(job_id)
            return self._send(200, {"jobId": job_id, "plotId": plot_id, "status": "queued"})
        self._send(404, {"error": "not found"})

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/health":
            return self._send(200, {"ok": True})
        if path.startswith("/jobs/"):
            job_id = path[len("/jobs/"):]
            with _lock:
                job = _jobs.get(job_id)
            if not job:
                return self._send(404, {"status": "failed", "jobId": job_id, "plotId": "", "error": "unknown job"})
            st = job["status"]
            if st in ("queued", "running"):
                return self._send(200, {"status": st, "jobId": job_id, "plotId": job["plotId"]})
            if st == "succeeded":
                return self._send(200, {"status": "succeeded", "jobId": job_id,
                                        "plotId": job["plotId"], "result": job["result"]})
            return self._send(200, {"status": "failed", "jobId": job_id,
                                    "plotId": job["plotId"], "error": job.get("error", "")})
        if path.startswith("/tiles/"):
            rel = path[len("/tiles/"):]
            fp = (TILES_ROOT / rel).resolve()
            if TILES_ROOT.resolve() in fp.parents and fp.is_file() and fp.suffix == ".png":
                return self._send(200, raw=fp.read_bytes(), ctype="image/png")
            return self._send(404, {"error": "tile not found"})
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass  # quiet


def main():
    TILES_ROOT.mkdir(parents=True, exist_ok=True)
    for _ in range(2):  # a couple of workers; analysis is I/O-bound on scene downloads
        threading.Thread(target=_worker, daemon=True).start()
    print(f"analysis service on http://localhost:{PORT}  (POST /jobs, GET /jobs/<id>)")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
