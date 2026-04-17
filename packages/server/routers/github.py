from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.github_service import fetch_tree, fetch_files

router = APIRouter()


class TreeRequest(BaseModel):
    owner: str
    repo: str
    token: Optional[str] = None


class ContentRequest(BaseModel):
    owner: str
    repo: str
    paths: list[str]
    token: Optional[str] = None


@router.post("/tree")
async def get_tree(req: TreeRequest):
    paths = await fetch_tree(req.owner, req.repo, req.token)
    return {"paths": paths, "total": len(paths)}


@router.post("/content")
async def get_content(req: ContentRequest):
    files = await fetch_files(req.owner, req.repo, req.paths, req.token)
    return {"files": files}
