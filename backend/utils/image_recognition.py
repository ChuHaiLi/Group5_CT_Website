import os
import time
from typing import List, Dict, Any, Optional

from openai import OpenAI
from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError, RateLimitError

from .openai_rate_limiter import get_shared_openai_limiter


class OpenAIImageRecognizer:
    """Send travel-photo prompts to OpenAI and receive friendly text summaries."""

    def __init__(self) -> None:
        self._cached_client: Optional[OpenAI] = None
        self._model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-4o-mini")
        self._base_url = (os.getenv("OPENAI_API_IMAGE") or "").rstrip("/")
        self._rate_limiter = get_shared_openai_limiter()
        self._max_retries = int(os.getenv("OPENAI_MAX_RETRIES", "2"))
        self._retry_delay = float(os.getenv("OPENAI_RETRY_DELAY", "5"))

    def _get_client(self) -> OpenAI:
        if self._cached_client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY is not configured")

            client_kwargs: Dict[str, Any] = {"api_key": api_key, "max_retries": 0}
            if self._base_url:
                client_kwargs["base_url"] = self._base_url

            self._cached_client = OpenAI(**client_kwargs)
        return self._cached_client

    def is_ready(self) -> bool:
        try:
            self._get_client()
        except RuntimeError:
            return False
        return True

    def describe_location_text(
        self,
        user_prompt: str,
        image_data_urls: List[str],
        destination_context: Optional[str] = None,
    ) -> str:
        """Send caption + photos and return a playful Vietnamese text summary."""

        if not image_data_urls:
            raise ValueError("At least one image is required")

        client = self._get_client()
        system_prompt = (
            "Bạn là Travel Lens, một storyteller du lịch tinh tế. "
            "Hãy nhìn các bức ảnh bằng ánh mắt của người bạn mê xê dịch: mở đầu bằng cảm xúc đầu tiên khi vừa chạm mắt,"
            " sau đó mô tả sinh động màu sắc, ánh sáng, vibe, âm thanh tưởng tượng, mùi vị nếu có. "
            "Khi suy đoán địa điểm, diễn đạt tự nhiên, tự tin nhưng vẫn mềm mại (không dùng câu 'Tôi nghĩ địa điểm...' hay xin lỗi). "
            "Nếu chưa chắc chắn, khéo léo kể theo kiểu 'khung cảnh này gợi mình nhớ đến...' thay vì phủ nhận thẳng. "
            "Gợi ý điểm tương tự như lời khuyên của người bạn am hiểu du lịch, không liệt kê khô khan. "
            "Tránh hoàn toàn các format cố định, tiêu đề, bullet list, hoặc nhắc lại cùng cấu trúc mỗi lần. "
            "Văn phong ấm áp, giàu hình ảnh, mang hơi thở của hành trình thực thụ. "
            "Nếu ảnh không liên quan đến du lịch, hãy nói rõ một cách duyên dáng và rủ người dùng gửi ảnh khác."
        )
        if destination_context:
            system_prompt += (
                "\nDưới đây là danh sách địa điểm gợi ý để tham khảo thêm:\n" + destination_context
            )

        user_content: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": user_prompt
                or "Giúp tôi nhận dạng địa điểm du lịch trong những bức ảnh này.",
            }
        ]

        for url in image_data_urls:
            if not url:
                continue
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": url},
                }
            )

        temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.5"))

        def _call_openai():
            return client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=temperature,
            )

        response = self._run_with_retry(_call_openai)
        return (response.choices[0].message.content or "").strip()

    def _run_with_retry(self, call):
        last_exc: Optional[Exception] = None
        attempts = max(self._max_retries, 0) + 1
        for attempt in range(attempts):
            try:
                self._rate_limiter.acquire()
                return call()
            except RateLimitError as exc:
                last_exc = exc
                if attempt == attempts - 1:
                    raise RuntimeError(
                        "OpenAI đang tạm khóa vì vượt giới hạn 1 phút. Đợi khoảng 20s rồi thử lại nhé."
                    ) from exc
            except (APITimeoutError, APIConnectionError) as exc:
                last_exc = exc
                if attempt == attempts - 1:
                    raise RuntimeError(
                        "Không thể kết nối tới OpenAI lúc này. Hãy thử gửi lại ảnh sau ít phút."
                    ) from exc
            except APIStatusError as exc:
                last_exc = exc
                status = getattr(exc, "status_code", None)
                if status and 500 <= status < 600 and attempt < attempts - 1:
                    time.sleep(self._retry_delay * (attempt + 1))
                    continue
                if status == 429:
                    raise RuntimeError(
                        "OpenAI yêu cầu tạm nghỉ vài giây do giới hạn tốc độ. Vui lòng thử lại sau."
                    ) from exc
                message = "OpenAI trả về lỗi không xác định. Hãy thử lại sau."
                if status:
                    message = f"OpenAI trả về lỗi {status}. Hãy thử lại sau."
                raise RuntimeError(message) from exc
            except APIError as exc:
                raise RuntimeError(f"OpenAI gặp lỗi: {exc}") from exc

            time.sleep(self._retry_delay * (attempt + 1))

        raise RuntimeError("Không thể gọi OpenAI Vision thành công.") from last_exc
