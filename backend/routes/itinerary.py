from flask import Blueprint, request, jsonify
from models import Itinerary, db
import json

itinerary_bp = Blueprint("itinerary", __name__)

@itinerary_bp.route("/save", methods=["POST"])
def save_itinerary():
    data = request.json
    itinerary = Itinerary(user_id=data["user_id"], locations=json.dumps(data["locations"]))
    db.session.add(itinerary)
    db.session.commit()
    return jsonify({"message": "Itinerary saved"})

@itinerary_bp.route("/load/<int:user_id>", methods=["GET"])
def load_itinerary(user_id):
    itineraries = Itinerary.query.filter_by(user_id=user_id).all()
    return jsonify([{"id": it.id, "locations": json.loads(it.locations)} for it in itineraries])
