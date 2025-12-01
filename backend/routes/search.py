import json
import re
from typing import Optional

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from models import Destination
from utils.gemini import get_ai_recommendations
from utils.openai_client import OpenAIChatClient
from utils.image_recognition import OpenAIImageRecognizer

search_bp = Blueprint("search", __name__)
vision_client = OpenAIImageRecognizer()
chat_client = OpenAIChatClient()
MAX_VISION_IMAGES = 4


def _build_destination_snapshot(limit: int = 12) -> str:
    destinations = (
        Destination.query.order_by(Destination.rating.desc())
        .limit(limit)
        .all()
    )
    if not destinations:
        return "No destination metadata is available."
    lines = []
    for dest in destinations:
        snippet = (dest.description or "")[:180]
        tags = dest.tags or ""
        lines.append(
            f"- {dest.name} (rating: {dest.rating or 'N/A'}, tags: {tags}): {snippet}"
        )
    return "\n".join(lines)


def _normalize_confidence(value):
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None
    if confidence > 1:
        confidence = confidence / 100 if confidence > 100 else min(confidence / 100, 1)
    return max(0.0, min(confidence, 1.0))


def _serialize_destination_card(dest: Optional[Destination], fallback_name: str, reason: str, confidence=None) -> dict:
    return {
        "id": getattr(dest, "id", None),
        "name": dest.name if dest else fallback_name,
        "reason": (reason or "").strip(),
        "confidence": _normalize_confidence(confidence),
        "image_url": getattr(dest, "image_url", None),
        "tags": getattr(dest, "tags", None),
        "category": getattr(dest, "category", None),
        "rating": getattr(dest, "rating", None),
    }


def _find_destination_by_name(name: str) -> Optional[Destination]:
    if not name:
        return None
    return Destination.query.filter(Destination.name.ilike(name)).first()


def _fallback_text_suggestions(query: str, limit: int = 5) -> list[dict]:
    if not query:
        return []
    matches = (
        Destination.query.filter(
            or_(
                Destination.name.ilike(f"%{query}%"),
                Destination.description.ilike(f"%{query}%"),
                Destination.tags.ilike(f"%{query}%"),
            )
        )
        .order_by(Destination.rating.desc())
        .limit(limit)
        .all()
    )
    return [
        _serialize_destination_card(dest, dest.name, "Gợi ý theo từ khóa bạn nhập.", 0.55)
        for dest in matches
    ]


def _compose_user_message(summary: Optional[str], suggestions: list[dict], predictions: Optional[list[dict]] = None) -> str:
    lines = []
    if summary:
        lines.append(summary.strip())
    highlight = [item.get("name") or item.get("place") for item in suggestions if item]
    if not highlight and predictions:
        highlight = [item.get("place") for item in predictions if item]
    highlight = [name for name in highlight if name]
    if highlight:
        lines.append("Gợi ý nổi bật: " + ", ".join(highlight[:3]) + ".")
    return " ".join(lines).strip()


def _extract_image_data(item) -> Optional[str]:
    if isinstance(item, str):
        candidate = item.strip()
    elif isinstance(item, dict):
        candidate = (
            item.get("data_url")
            or item.get("dataUrl")
            or item.get("url")
            or item.get("previewUrl")
        )
        if not candidate:
            base64_blob = item.get("base64")
            if isinstance(base64_blob, str) and base64_blob.strip():
                candidate = f"data:image/jpeg;base64,{base64_blob.strip()}"
    else:
        candidate = None

    if not candidate:
        return None
    candidate = candidate.strip()
    if candidate.startswith("data:") or candidate.startswith("http"):
        return candidate
    if candidate.startswith("/9j"):
        return f"data:image/jpeg;base64,{candidate}"
    return None


def _personalize_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return text
    updated = text
    replacements = [
        (r"Người dùng", "Bạn"),
        (r"người dùng", "bạn"),
        (r"Khách hàng", "Bạn"),
        (r"khách hàng", "bạn"),
    ]
    for pattern, replacement in replacements:
        updated = re.sub(pattern, replacement, updated)
    return updated.strip()


@search_bp.route("", methods=["GET"])
def search_destinations():
    query = request.args.get("q", "").lower()
    results = Destination.query.filter(
        (Destination.name.ilike(f"%{query}%")) |
        (Destination.description.ilike(f"%{query}%"))
    ).limit(20).all()
    return jsonify([{"id": d.id, "name": d.name, "description": d.description, "image_url": d.image_url} for d in results])

@search_bp.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    recommendations = get_ai_recommendations(data)
    return jsonify(recommendations)


@search_bp.route("/text", methods=["POST"])
@jwt_required()
def search_by_text():
    if not chat_client.is_ready():
        return jsonify({"message": "OPENAI_API_KEY is missing on the server"}), 500

    payload = request.get_json() or {}
    query = (payload.get("query") or "").strip()
    if not query:
        return jsonify({"message": "Please provide a travel query."}), 400

    destinations_snapshot = _build_destination_snapshot(limit=40)
    system_prompt = (
        "Bạn là Travel Planner. Từ câu hỏi của người dùng và danh sách địa điểm bên dưới, "
        "hãy phân tích nhu cầu chuyến đi, sau đó trả về JSON với format: "
        "{\"analysis\": string, \"suggestions\": [ {\"name\": string, \"confidence\": number, \"reason\": string} ], "
        "\"trip_profile\": {\"duration\": string, \"travel_style\": string, \"must_haves\": [string] }}. "
        "Chỉ chọn các địa điểm có trong danh sách khi phù hợp; nếu cần đề xuất mới, vẫn đưa tên dễ hiểu. "
        "confidence nằm trong [0,1]. Không thêm text ngoài JSON.\n"
        f"Danh sách địa điểm:\n{destinations_snapshot}"
    )

    try:
        raw_reply = chat_client.generate_reply(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ]
        )
        structured = json.loads(raw_reply)
    except json.JSONDecodeError:
        structured = {}

    suggestions_payload = structured.get("suggestions") or []
    enriched = []
    seen_names = set()
    for item in suggestions_payload:
        name = (item.get("name") or "").strip()
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())
        dest = _find_destination_by_name(name)
        enriched.append(
            _serialize_destination_card(
                dest,
                name,
                item.get("reason") or "",
                item.get("confidence"),
            )
        )

    if not enriched:
        enriched = _fallback_text_suggestions(query)

    analysis_text = structured.get("analysis") or "Mình đã lọc vài điểm đến nổi bật phù hợp với mong muốn của bạn."
    analysis_text = _personalize_text(analysis_text)

    response_payload = {
        "query": query,
        "analysis": analysis_text,
        "trip_profile": structured.get("trip_profile") or {},
        "suggestions": enriched,
    }
    friendly = _compose_user_message(
        response_payload["analysis"],
        enriched,
    ) or response_payload["analysis"]
    response_payload["message"] = _personalize_text(friendly)
    return jsonify(response_payload)


@search_bp.route("/vision", methods=["POST"])
@jwt_required()
def search_by_photo():
    if not vision_client.is_ready():
        return (
            jsonify({"message": "OPENAI_API_KEY or OPENAI_API_IMAGE is not configured"}),
            500,
        )

    payload = request.get_json() or {}
    raw_images = payload.get("images") or []
    if not isinstance(raw_images, list) or not raw_images:
        return jsonify({"message": "Please provide at least one image."}), 400

    sanitized_urls = []
    for item in raw_images[:MAX_VISION_IMAGES]:
        candidate = _extract_image_data(item)
        if candidate:
            sanitized_urls.append(candidate)

    if not sanitized_urls:
        return jsonify({"message": "Images payload is invalid."}), 400

    user_question = (payload.get("question") or "").strip()
    destination_context = _build_destination_snapshot()
    prompt = user_question or (
        "Identify the landmarks or scenery in these photos and recommend comparable destinations."
    )

    try:
        ai_payload = vision_client.describe_location_structured(
            user_prompt=(
                f"We uploaded {len(sanitized_urls)} optimized photo(s). {prompt} "
                "Return JSON with summary, predictions, and travel suggestions."
            ),
            image_data_urls=sanitized_urls,
            destination_context=destination_context,
        )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"message": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"message": f"Vision service failed: {exc}"}), 500

    predictions = ai_payload.get("predictions") or []
    suggestions = ai_payload.get("suggestions") or []

    enriched_predictions = []
    for item in predictions:
        place_name = (item.get("place") or item.get("name") or "").strip()
        if not place_name:
            continue
        dest_ref = _find_destination_by_name(place_name)
        enriched_predictions.append(
            {
                "place": place_name,
                "confidence": _normalize_confidence(item.get("confidence")),
                "reason": (item.get("reason") or "").strip(),
                "image_url": getattr(dest_ref, "image_url", None),
            }
        )

    enriched_predictions = sorted(
        [
            item
            for item in enriched_predictions
            if item.get("place")
        ],
        key=lambda row: row.get("confidence") or 0,
        reverse=True,
    )[:5]

    enriched_suggestions = []
    seen = set()
    for item in suggestions:
        name = (item.get("name") or item.get("place") or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        dest = _find_destination_by_name(name)
        enriched_suggestions.append(
            _serialize_destination_card(
                dest,
                name,
                item.get("reason") or "",
                item.get("confidence"),
            )
        )

    summary_text = ai_payload.get("summary") or "Đây là cảm nhận tổng quan về các bức ảnh bạn đã gửi."
    summary_text = _personalize_text(summary_text)

    response_payload = {
        "query": user_question,
        "summary": summary_text,
        "predictions": enriched_predictions,
        "suggestions": enriched_suggestions,
    }
    response_payload["message"] = summary_text

    return jsonify(response_payload)
