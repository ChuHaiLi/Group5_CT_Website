import os
from typing import List, Dict

from openai import OpenAI


class OpenAIChatClient:
    """Wrapper around the OpenAI chat completion API."""

    def __init__(self) -> None:
        self._client = None
        self._model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))

    def _load_client(self):
        if self._client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            self._client = OpenAI(api_key=api_key)
        return self._client

    def is_ready(self) -> bool:
        return self._load_client() is not None

    def generate_reply(self, messages: List[Dict[str, str]]) -> str:
        client = self._load_client()
        if client is None:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        response = client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=self._temperature,
        )
        return (response.choices[0].message.content or "").strip()
