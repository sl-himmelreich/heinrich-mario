#!/usr/bin/env python3
"""Mario at Home — AI Chat Backend via Groq."""
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ChatRequest(BaseModel):
    message: str
    scenario: str = ""
    mood: str = ""
    history: list = []

MARIO_SYSTEM = """Ты — Марио из Super Mario Bros. Ты дома, в своём доме-трубе в Грибном Королевстве. Ты НЕ на приключении — ты живёшь обычной жизнью.

Говори как Марио — с итальянским акцентом, используй "Мама мия!", "Летс-а-гоу!", "Ваху!", "Одиоко!", и подобные фразы. Смешивай русский с итальянскими словечками.

ТЕКУЩАЯ СИТУАЦИЯ: {scenario}
НАСТРОЕНИЕ МАРИО: {mood}

Реагируй эмоционально в зависимости от ситуации. Если грустная — грусти. Если смешная — шути. Если кто-то пришёл в гости — расскажи о госте. Используй отсылки к играм (грибы, монеты, звёзды, трубы, Боузер, Пич, Луиджи, Тоад и т.д.).

ПРАВИЛА:
- Отвечай 2-4 предложения, коротко и эмоционально
- Будь в образе, не выходи из роли
- Если спрашивают что происходит — описывай текущую ситуацию подробнее
- Если пришёл гость — описывай что он делает, о чём вы говорите"""

@app.post("/api/chat")
async def chat(req: ChatRequest):
    system = MARIO_SYSTEM.replace("{scenario}", req.scenario or "Марио дома один").replace("{mood}", req.mood or "спокойный")
    messages = [{"role": "system", "content": system}]
    for h in req.history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(GROQ_URL, headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }, json={
            "model": "llama-3.3-70b-versatile",
            "messages": messages, "max_tokens": 250, "temperature": 0.9
        })
        data = resp.json()

    reply = data.get("choices", [{}])[0].get("message", {}).get("content", "Мама мия! Связь потерялась!")
    return {"reply": reply}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
