import asyncio
import base64
from typing import Optional
import httpx

GITHUB_API = "https://api.github.com"


def _headers(token: Optional[str] = None) -> dict:
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def fetch_tree(owner: str, repo: str, token: Optional[str] = None) -> list[str]:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                res = await client.get(url, headers=_headers(token))
                if res.status_code == 404:
                    raise ValueError("Repository not found — check URL or make it public")
                if res.status_code == 403:
                    raise ValueError("Rate limited or private repo — add a GitHub token")
                if res.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                res.raise_for_status()
                data = res.json()
                return [item["path"] for item in data.get("tree", []) if item["type"] == "blob"]
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)
    return []


async def fetch_file(
    owner: str, repo: str, path: str, token: Optional[str] = None
) -> str:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(url, headers=_headers(token))
            if not res.is_success:
                return ""
            data = res.json()
            if data.get("encoding") != "base64" or not data.get("content"):
                return ""
            return base64.b64decode(data["content"].replace("\n", "")).decode("utf-8", errors="replace")
    except Exception:
        return ""


async def fetch_files(
    owner: str, repo: str, paths: list[str], token: Optional[str] = None
) -> list[dict]:
    tasks = [fetch_file(owner, repo, p, token) for p in paths]
    contents = await asyncio.gather(*tasks)
    return [{"path": p, "content": c} for p, c in zip(paths, contents)]
