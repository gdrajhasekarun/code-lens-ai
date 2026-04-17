import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from routers import github, llm

app = FastAPI(title="CodeLens AI", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(github.router, prefix="/api/github")
app.include_router(llm.router, prefix="/api/llm")


@app.get("/health")
async def health():
    return {"status": "ok"}


dist_dir = os.path.join(os.path.dirname(__file__), "dist")
if os.path.isdir(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = os.path.join(dist_dir, "index.html")
        return FileResponse(index)
