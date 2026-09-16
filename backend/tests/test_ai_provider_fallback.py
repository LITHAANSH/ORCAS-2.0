from unittest.mock import patch

import httpx
import pytest

from app.agents import intent_agent
from app.services import groq_intent
from app.services.groq_intent import GroqIntentError, extract_intent, generate_explanation


INTENT_PAYLOAD = {
    "intent": "marine_conditions",
    "activity": "fishing",
    "location_text": "Mumbai",
    "date": "2026-09-16",
    "time": "06:00",
    "language": "en",
    "needs": ["weather", "ocean"],
}


def _response(payload, status=200):
    request = httpx.Request("POST", "https://example.test/chat/completions")
    return httpx.Response(status, json=payload, request=request)


def _intent_response(status=200):
    return _response({"choices": [{"message": {"content": __import__("json").dumps(INTENT_PAYLOAD)}}]}, status)


@pytest.fixture(autouse=True)
def provider_config(monkeypatch):
    monkeypatch.setattr(groq_intent, "GROQ_API_KEY", "groq-test-key")
    monkeypatch.setattr(groq_intent, "NVIDIA_API_KEY", "nvidia-test-key")
    monkeypatch.setattr(groq_intent, "NVIDIA_MODEL", "openai/gpt-oss-20b")


def test_groq_success_does_not_call_nvidia_and_preserves_source():
    with patch.object(groq_intent.httpx, "post", return_value=_intent_response()) as post:
        result = intent_agent.run("What are the sea conditions from Mumbai?", mode="AI")

    assert result.data["intent_source"] == "GROQ_LLM"
    assert post.call_count == 1
    assert "api.groq.com" in post.call_args.args[0]


@pytest.mark.parametrize(
    "groq_failure",
    [
        _response({}, 429),
        _response({}, 500),
        httpx.ReadTimeout("timed out"),
        httpx.ConnectError("connection failed"),
    ],
)
def test_retryable_groq_failure_uses_nvidia(groq_failure):
    with patch.object(
        groq_intent.httpx,
        "post",
        side_effect=[groq_failure, _intent_response()],
    ) as post:
        result = intent_agent.run("What are the sea conditions from Mumbai?", mode="AI")

    assert result.data["intent_source"] == "NVIDIA_FALLBACK"
    assert post.call_count == 2
    assert "api.groq.com" in post.call_args_list[0].args[0]
    assert "integrate.api.nvidia.com" in post.call_args_list[1].args[0]


def test_groq_400_does_not_call_nvidia():
    with patch.object(groq_intent.httpx, "post", return_value=_response({}, 400)) as post:
        with pytest.raises(GroqIntentError, match="AI mode is unavailable"):
            extract_intent("anything")

    assert post.call_count == 1


def test_groq_quota_error_uses_nvidia_even_with_client_status():
    quota_error = _response({"error": {"message": "quota exceeded"}}, 400)
    with patch.object(
        groq_intent.httpx,
        "post",
        side_effect=[quota_error, _intent_response()],
    ) as post:
        result = intent_agent.run("What are the sea conditions from Mumbai?", mode="AI")

    assert result.data["intent_source"] == "NVIDIA_FALLBACK"
    assert post.call_count == 2


def test_nvidia_failure_preserves_existing_ai_error():
    with patch.object(
        groq_intent.httpx,
        "post",
        side_effect=[_response({}, 429), _response({}, 503)],
    ) as post:
        with pytest.raises(GroqIntentError, match="AI mode is unavailable"):
            extract_intent("anything")

    assert post.call_count == 2


def test_offline_mode_calls_neither_provider():
    with patch.object(groq_intent.httpx, "post", side_effect=AssertionError("provider called")):
        result = intent_agent.run("Is it safe to go fishing?", mode="OFFLINE")

    assert result.data["intent_source"] == "KEYWORD_OFFLINE"


def test_nvidia_intent_response_keeps_existing_validation():
    with patch.object(
        groq_intent.httpx,
        "post",
        side_effect=[_response({}, 429), _intent_response()],
    ):
        result = intent_agent.run("What are the sea conditions from Mumbai?", mode="AI")

    assert result.data["intent"] == "marine_conditions"
    assert result.data["location"]["name"] == "Mumbai"
    assert result.data["intent_source"] == "NVIDIA_FALLBACK"


def test_explanation_falls_back_to_nvidia():
    nvidia_payload = {"choices": [{"message": {"content": "NVIDIA answer"}}]}
    with patch.object(
        groq_intent.httpx,
        "post",
        side_effect=[_response({}, 429), _response(nvidia_payload)],
    ) as post:
        answer = generate_explanation({"intent": {"raw_query": "What is the weather?"}}, "en")

    assert answer == "NVIDIA answer"
    assert post.call_count == 2
