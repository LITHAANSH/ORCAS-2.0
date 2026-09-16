"""Backend-only Groq adapter for structured ORCA intent extraction."""
from __future__ import annotations

import json
from typing import Any, Dict

import httpx

from ..config import GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_SECONDS


class GroqIntentError(RuntimeError):
    """A safe, user-facing category of AI intent failure."""


def extract_intent(message: str) -> Dict[str, Any]:
    print(f"DEBUG: GROQ_MODEL={GROQ_MODEL}, KEY_LEN={len(GROQ_API_KEY)}")
    if not GROQ_API_KEY:
        raise GroqIntentError("AI mode is unavailable")

    prompt = (
        "Classify this marine question for ORCA. Return JSON only with these keys: "
        "intent, activity, location_text, date, time, language, needs. "
        "intent must be one of fishing_safety, find_pfz, fishing_outlook, route, "
        "emergency, weather, marine_conditions, alerts, restricted, general_query. "
        "activity must be fishing or travel. language must be en, hi, or kn. "
        "needs must be a JSON array of specialist names. Do not invent coordinates "
        "or locations; use an empty location_text when none is stated. "
        f"Question: {message}"
    )
    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "You output only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=GROQ_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        payload = json.loads(content)
        if not isinstance(payload, dict):
            raise ValueError("structured response was not an object")
        return payload
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"GROQ ERROR: {exc!r}")
        if isinstance(exc, httpx.HTTPStatusError):
            print(exc.response.text)
        raise GroqIntentError("AI mode is unavailable") from exc

def generate_explanation(context_data: Dict[str, Any], language: str) -> str:
    if not GROQ_API_KEY:
        return ""
        
    prompt = (
        f"You are ORCA, a marine safety assistant. Answer the user naturally in language '{language}' "
        "based strictly on the following data context for real-time measurements (waves, weather, risk). "
        "However, you MAY use your own general knowledge to answer questions about local fish species, geography, or fishing techniques. "
        "For every real-time measurement or safety warning, you MUST cite the data source in brackets "
        "at the end of the sentence, for example: 'The wave height is 2.5m [Source: INCOIS]'.\n\n"
        "IMPORTANT RULES FOR YOUR OUTPUT:\n"
        "1. Write in plain text only. Do NOT use any Markdown formatting (no asterisks **, no bullet points -, no tables).\n"
        "2. Keep it conversational, short, and easy to read aloud.\n"
        "3. Write exactly 1 or 2 short paragraphs.\n"
        "4. ONLY answer the user's specific question (found in Context Data -> intent -> raw_query). DO NOT summarize extra risk or weather data unless it is directly relevant to their question or there is an extreme, imminent danger they must know about.\n\n"
        f"Context Data:\n{json.dumps(context_data, indent=2, default=str)}"
    )
    
    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": "You are a marine safety assistant. Always cite sources in brackets."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=GROQ_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return content.strip()
    except Exception as exc:
        print(f"GROQ EXPLANATION ERROR: {exc!r}")
        return ""