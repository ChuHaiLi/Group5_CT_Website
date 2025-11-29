from flask import Blueprint, request, jsonify
import requests
import os

weather_bp = Blueprint("weather", __name__)

API_KEY = os.getenv("WEATHER_API_KEY")

@weather_bp.route("/current", methods=["GET"])
def current_weather():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"message": "Missing lat/lon"}), 400
    url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    res = requests.get(url).json()
    return jsonify(res)
