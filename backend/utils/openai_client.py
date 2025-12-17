import os
import time
from typing import List, Dict

try:
    from openai import OpenAI
    from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError, RateLimitError
except Exception:  # ImportError or other import-time issues
    # If the package isn't installed, set placeholders and defer the error
    OpenAI = None
    # Bind generic exceptions so later except clauses still work
    APIConnectionError = Exception
    APIError = Exception
    APIStatusError = Exception
    APITimeoutError = Exception
    RateLimitError = Exception

from .openai_rate_limiter import get_shared_openai_limiter


class OpenAIChatClient:
    """Wrapper around the OpenAI chat completion API."""

    def __init__(self) -> None:
        self._client = None
        self._model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))
        self._rate_limiter = get_shared_openai_limiter()
        self._max_retries = int(os.getenv("OPENAI_MAX_RETRIES", "2"))
        self._retry_delay = float(os.getenv("OPENAI_RETRY_DELAY", "5"))

    def _load_client(self):
        if self._client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            if OpenAI is None:
                # Provide a helpful message instead of crashing at import time
                raise RuntimeError(
                    "Python package 'openai' is not installed. Run: python -m pip install -r requirements.txt"
                )
            self._client = OpenAI(api_key=api_key, max_retries=0)
        return self._client

    def is_ready(self) -> bool:
        return self._load_client() is not None

    def _run_with_retry(self, call):
        last_exc = None
        attempts = max(self._max_retries, 0) + 1
        for attempt in range(attempts):
            try:
                self._rate_limiter.acquire()
                return call()
            except RateLimitError as exc:
                last_exc = exc
                if attempt == attempts - 1:
                    raise RuntimeError(
                        "OpenAI đang giới hạn số lượng yêu cầu. Vui lòng chờ vài giây rồi thử lại."
                    ) from exc
            except (APITimeoutError, APIConnectionError) as exc:
                last_exc = exc
                if attempt == attempts - 1:
                    raise RuntimeError(
                        "Không thể kết nối tới OpenAI lúc này. Thử gửi lại sau ít phút."
                    ) from exc
            except APIStatusError as exc:
                last_exc = exc
                status = getattr(exc, "status_code", None)
                if status and 500 <= status < 600 and attempt < attempts - 1:
                    time.sleep(self._retry_delay * (attempt + 1))
                    continue
                raise RuntimeError(
                    f"OpenAI trả về lỗi {status or exc.status_code}. Vui lòng thử lại sau."
                ) from exc
            except APIError as exc:
                raise RuntimeError(f"OpenAI gặp lỗi: {exc}") from exc

            time.sleep(self._retry_delay * (attempt + 1))

        raise RuntimeError("Không thể hoàn thành yêu cầu OpenAI.") from last_exc

    def generate_reply(self, messages: List[Dict[str, str]]) -> str:
        client = self._load_client()
        if client is None:
            raise RuntimeError("OPENAI_API_KEY chưa được cấu hình trên server")

        response = self._run_with_retry(
            lambda: client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=self._temperature,
            )
        )
        return (response.choices[0].message.content or "").strip()

    def generate_multimodal_reply(
        self,
        system_prompt: str,
        user_prompt: str,
        image_data_urls: List[str],
    ) -> str:
        client = self._load_client()
        if client is None:
            raise RuntimeError("OPENAI_API_KEY chưa được cấu hình trên server")

        user_content: List[Dict[str, object]] = [
            {"type": "text", "text": user_prompt}
        ]
        for url in image_data_urls:
            if not url:
                continue
            user_content.append({
                "type": "image_url",
                "image_url": {"url": url},
            })

        response = self._run_with_retry(
            lambda: client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=self._temperature,
            )
        )
        return (response.choices[0].message.content or "").strip()
