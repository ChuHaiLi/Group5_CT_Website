from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import Destination
from utils.gemini import get_ai_recommendations
from utils.openai_client import OpenAIChatClient
from utils.image_recognition import OpenAIImageRecognizer

search_bp = Blueprint("search", __name__)
vision_client = OpenAIImageRecognizer()


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
    for item in raw_images[:4]:
        if not isinstance(item, str):
            continue
        base64_data = item.split(",")[-1].strip()
        if base64_data:
            sanitized_urls.append(f"data:image/jpeg;base64,{base64_data}")

    if not sanitized_urls:
        return jsonify({"message": "Images payload is invalid."}), 400

    user_question = (payload.get("question") or "").strip()
    destination_context = _build_destination_snapshot()
    prompt = user_question or (
        "Identify the landmarks or scenery in these photos and recommend comparable destinations."
    )

    try:
        result_text = vision_client.describe_location_text(
            user_prompt=(
                f"We uploaded {len(sanitized_urls)} optimized photo(s). {prompt} "
                "If you are unsure, explain it in the summary."
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

    return result_text, 200, {"Content-Type": "text/plain; charset=utf-8"}
