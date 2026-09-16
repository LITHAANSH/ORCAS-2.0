"""Conversational endpoint — the one the demo drives."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..agents import planner
from ..schemas import ChatRequest, ChatResponse
from ..services.groq_intent import GroqIntentError

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Ask ORCA anything in English, Hindi or Kannada."""
    try:
        return planner.handle(req)
    except GroqIntentError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/chat/reset")
def reset(session_id: str = "default") -> dict:
    planner.reset_session(session_id)
    return {"ok": True, "session_id": session_id}
