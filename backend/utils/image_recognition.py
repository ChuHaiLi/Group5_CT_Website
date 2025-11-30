import os
from typing import List, Dict, Any, Optional

from openai import OpenAI


class OpenAIImageRecognizer:
    """Send travel-photo prompts to OpenAI and receive friendly text summaries."""

    def __init__(self) -> None:
        self._cached_client: Optional[OpenAI] = None
        self._model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-4o-mini")
        self._base_url = (os.getenv("OPENAI_API_IMAGE") or "").rstrip("/")

    def _get_client(self) -> OpenAI:
        if self._cached_client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY is not configured")

            client_kwargs: Dict[str, Any] = {"api_key": api_key}
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
            "Bạn là Travel Lens, trợ lý AI vui tính chuyên nhận dạng địa điểm du lịch từ ảnh. "
            "Luôn trả lời bằng tiếng Việt, giọng hài hước, thân thiện. "
            "Hãy dùng đúng FORMAT cố định sau (không thêm JSON, không thêm thẻ HTML, không thay đổi tiêu đề):\n\n"
            "Ảnh đẹp kiểu khiến người ta muốn nghỉ làm một ngày để đi chơi ngay!\n"
            "<1-2 câu tả vibe ảnh như: 'Tấm ảnh này nhìn vào thấy chill dễ sợ...'>\n\n"
            "Tôi nghĩ địa điểm du lịch đó là: <địa điểm hoặc 'mình chưa chắc lắm'>\n\n"
            "Vài nét về địa điểm đó: <liệt kê gạch đầu dòng, mỗi gạch đầu dòng bắt đầu bằng dấu '-' mô tả đặc điểm nổi bật>\n\n"
            "Bạn cũng có thể tham khảo thử với: <liệt kê tối đa 3 gợi ý, dạng '- Tên địa điểm – lý do ngắn'>\n\n"
            "Nếu ảnh không liên quan đến du lịch, nói thẳng lý do và khuyên người dùng gửi ảnh khác."
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

        response = client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.5")),
        )

        return (response.choices[0].message.content or "").strip()
