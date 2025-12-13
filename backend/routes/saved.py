from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, SavedDestination, Destination, Province
import json
import random

saved_bp = Blueprint("saved", __name__)

# CẤU HÌNH RANDOM THEO VÙNG
REGION_CONFIG = {
    "Miền Bắc": {"temp_min": 15, "temp_max": 35, "weather_types": ["Sunny", "Cloudy", "Rainy"]},
    "Miền Trung": {"temp_min": 27, "temp_max": 39, "weather_types": ["Sunny", "Hot", "Clear"]},
    "Miền Nam": {"temp_min": 25, "temp_max": 36, "weather_types": ["Sunny", "Hot", "Cloudy", "Rainy"]},
}

def generate_random_weather(region_name):
    config = REGION_CONFIG.get(region_name, REGION_CONFIG["Miền Nam"])
    temp = random.randint(config["temp_min"], config["temp_max"])
    weather_type = random.choice(config["weather_types"])
    return f"{weather_type} {temp}°C"

def decode_db_json_string(data_string, default_type='list'):
    if not data_string:
        return [] if default_type == 'list' else None
    try:
        return json.loads(data_string)
    except (json.JSONDecodeError, TypeError):
        return [data_string] if default_type == 'list' else data_string

def get_card_image_url(destination):
    """Lấy URL ảnh cho destination"""
    if destination.image_url:
        source_url = destination.image_url
        if source_url and (source_url.startswith('http://') or source_url.startswith('https://')):
            return source_url
        else:
            image_filename = source_url.split("/")[-1]
            return request.host_url.rstrip('/') + url_for('static', filename=f'images/{image_filename}')

    elif destination.images:
        for image_obj in destination.images:
            url = image_obj.image_url
            if url and (url.startswith('http://') or url.startswith('https://')):
                return url
        
    return None

# -------- SAVED DESTINATIONS --------
@saved_bp.route("/add", methods=["POST"])
@jwt_required()
def save_destination():
    data = request.get_json() or {}
    destination_id = data.get("destination_id")
    user_id = int(get_jwt_identity())

    if not destination_id:
        return jsonify({"message": "Destination ID required"}), 400

    exists = SavedDestination.query.filter_by(
        user_id=user_id,
        destination_id=destination_id
    ).first()

    if exists:
        return jsonify({"message": "Already saved"}), 200

    new_save = SavedDestination(user_id=user_id, destination_id=destination_id)
    db.session.add(new_save)
    db.session.commit()
    return jsonify({"message": "Saved successfully"}), 201

@saved_bp.route("/remove", methods=["DELETE"])
@jwt_required()
def remove_saved():
    data = request.get_json() or {}
    destination_id = data.get("destination_id")
    user_id = int(get_jwt_identity())

    saved = SavedDestination.query.filter_by(
        user_id=user_id,
        destination_id=destination_id
    ).first()

    if not saved:
        return jsonify({"message": "Not in saved list"}), 404

    db.session.delete(saved)
    db.session.commit()
    return jsonify({"message": "Removed from saved list"}), 200

@saved_bp.route("/list", methods=["GET"])
@jwt_required()
def get_saved_list():
    user_id = int(get_jwt_identity())
    saved_items = SavedDestination.query.filter_by(user_id=user_id).all()
    result = []

    for item in saved_items:
        destination = db.session.get(
            Destination, 
            item.destination_id, 
            options=[db.joinedload(Destination.images), db.joinedload(Destination.province).joinedload(Province.region)]
        )
        
        if destination:
            province = destination.province
            region = province.region if province else None
            region_name = region.name if region else "Miền Nam"
            
            image_full_url = get_card_image_url(destination)

            result.append({
                "id": destination.id,
                "name": destination.name,
                "province_name": province.name if province else None,
                "region_name": region_name,
                "image_url": image_full_url,
                "description": decode_db_json_string(destination.description),
                "latitude": destination.latitude,
                "longitude": destination.longitude,
                "rating": destination.rating or 0,
                "category": destination.category,
                "tags": decode_db_json_string(destination.tags, default_type='text'),
                "weather": generate_random_weather(region_name),
                "images": [img.image_url for img in destination.images],
                "type": destination.place_type,
                "place_type": destination.place_type,
                "opening_hours": destination.opening_hours,
                "entry_fee": destination.entry_fee,
                "source": destination.source,
            })
    return jsonify(result), 200