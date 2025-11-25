from flask import Blueprint, request, jsonify
from models import Destination
from utils.gemini import get_ai_recommendations

search_bp = Blueprint("search", __name__)

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
