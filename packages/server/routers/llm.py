from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.llm_service import stream_llm, call_llm

router = APIRouter()


class LLMRequest(BaseModel):
    provider: str
    apiKey: str
    model: Optional[str] = None
    baseUrl: Optional[str] = None
    apiVersion: Optional[str] = None
    promptField: Optional[str] = None
    contextField: Optional[str] = None
    responseField: Optional[str] = None
    headerName: Optional[str] = None
    system: str
    prompt: str


@router.post("/stream")
async def llm_stream(req: LLMRequest):
    async def event_generator():
        async for token in stream_llm(
            provider=req.provider,
            api_key=req.apiKey,
            model=req.model or "",
            system=req.system,
            prompt=req.prompt,
            base_url=req.baseUrl,
            api_version=req.apiVersion,
            prompt_field=req.promptField,
            context_field=req.contextField,
            response_field=req.responseField,
            header_name=req.headerName,
        ):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/call")
async def llm_call(req: LLMRequest):
    content = await call_llm(
        provider=req.provider,
        api_key=req.apiKey,
        model=req.model or "",
        system=req.system,
        prompt=req.prompt,
        base_url=req.baseUrl,
        api_version=req.apiVersion,
        prompt_field=req.promptField,
        context_field=req.contextField,
        response_field=req.responseField,
        header_name=req.headerName,
    )
    return {"content": content}
