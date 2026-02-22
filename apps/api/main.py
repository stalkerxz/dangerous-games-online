from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
CONTENT_DIR = BASE_DIR / "content"
MANIFEST_PATH = CONTENT_DIR / "manifest.json"
PUBLISHED_DIR = CONTENT_DIR / "published"

app = FastAPI(title="Dangerous Games API")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/content/manifest.json")
def get_manifest() -> FileResponse:
    if not MANIFEST_PATH.exists():
        raise HTTPException(status_code=404, detail="Manifest not found")
    return FileResponse(MANIFEST_PATH)


app.mount("/content/published", StaticFiles(directory=PUBLISHED_DIR), name="published-content")
