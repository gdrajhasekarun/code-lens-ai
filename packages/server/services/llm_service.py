from typing import AsyncGenerator, Optional
import httpx


async def stream_llm(
    provider: str,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    base_url: Optional[str] = None,
    api_version: Optional[str] = None,
    prompt_field: Optional[str] = None,
    context_field: Optional[str] = None,
    response_field: Optional[str] = None,
    header_name: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    if provider == "anthropic":
        async for token in _stream_anthropic(api_key, model, system, prompt, base_url):
            yield token
    elif provider in ("openai", "azure"):
        async for token in _stream_openai(api_key, model, system, prompt, base_url, api_version, provider):
            yield token
    elif provider == "openrouter":
        async for token in _stream_openrouter(api_key, model, system, prompt, base_url):
            yield token
    elif provider == "gemini":
        async for token in _stream_gemini(api_key, model, system, prompt, base_url):
            yield token
    elif provider == "enterprise":
        async for token in _call_enterprise(
            api_key, model, system, prompt, base_url,
            prompt_field, context_field, response_field, header_name
        ):
            yield token
    else:
        raise ValueError(f"Unknown provider: {provider}")


async def call_llm(
    provider: str,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    base_url: Optional[str] = None,
    api_version: Optional[str] = None,
    prompt_field: Optional[str] = None,
    context_field: Optional[str] = None,
    response_field: Optional[str] = None,
    header_name: Optional[str] = None,
) -> str:
    result = []
    async for token in stream_llm(
        provider, api_key, model, system, prompt,
        base_url, api_version, prompt_field, context_field, response_field, header_name
    ):
        result.append(token)
    return "".join(result)


async def _stream_anthropic(
    api_key: str, model: str, system: str, prompt: str, base_url: Optional[str]
) -> AsyncGenerator[str, None]:
    import anthropic
    client = anthropic.AsyncAnthropic(
        api_key=api_key,
        base_url=base_url or "https://api.anthropic.com",
    )
    async with client.messages.stream(
        model=model or "claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _stream_openai(
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    base_url: Optional[str],
    api_version: Optional[str],
    provider: str,
) -> AsyncGenerator[str, None]:
    import openai
    if provider == "azure":
        client = openai.AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=base_url or "",
            api_version=api_version or "2024-02-01",
        )
    else:
        client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or "https://api.openai.com/v1",
        )

    stream = await client.chat.completions.create(
        model=model or "gpt-4o",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=4096,
        stream=True,
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content if chunk.choices else None
        if text:
            yield text


async def _stream_openrouter(
    api_key: str, model: str, system: str, prompt: str, base_url: Optional[str]
) -> AsyncGenerator[str, None]:
    url = f"{base_url or 'https://openrouter.ai/api/v1'}/chat/completions"
    payload = {
        "model": model or "meta-llama/llama-3.1-8b-instruct",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 4096,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            url,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        ) as res:
            async for line in res.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload_str = line[6:]
                if payload_str == "[DONE]":
                    return
                import json
                try:
                    data = json.loads(payload_str)
                    text = data["choices"][0]["delta"].get("content")
                    if text:
                        yield text
                except Exception:
                    pass


async def _stream_gemini(
    api_key: str, model: str, system: str, prompt: str, base_url: Optional[str]
) -> AsyncGenerator[str, None]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gemini = genai.GenerativeModel(
        model_name=model or "gemini-1.5-pro",
        system_instruction=system,
    )
    response = await gemini.generate_content_async(prompt, stream=True)
    async for chunk in response:
        if chunk.text:
            yield chunk.text


async def _call_enterprise(
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    base_url: Optional[str],
    prompt_field: Optional[str],
    context_field: Optional[str],
    response_field: Optional[str],
    header_name: Optional[str],
) -> AsyncGenerator[str, None]:
    if not base_url:
        raise ValueError("Enterprise provider requires a Base URL")

    pf = prompt_field or "prompt"
    cf = context_field or "context"
    rf = response_field or "response"
    hn = header_name or "x-api-key"

    body: dict = {
        pf: f"{system}\n\n---\n\n{prompt}",
        cf: "",
    }
    if model:
        body["model"] = model

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{base_url}/llm/invoke",
            json=body,
            headers={"Content-Type": "application/json", hn: api_key},
        )

    if not res.is_success:
        raise ValueError(f"Enterprise API error {res.status_code}: {res.text}")

    data = res.json()
    # Support nested dot-path like "data.result.text"
    value = data
    for key in rf.split("."):
        if isinstance(value, dict):
            value = value.get(key)
        else:
            value = None
            break

    if not isinstance(value, str):
        raise ValueError(
            f"Enterprise API response did not contain field '{rf}'. Got: {data}"
        )

    yield value
