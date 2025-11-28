from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
from datetime import timedelta
import re
import secrets
from datetime import datetime
from models import db, User, Destination, SavedDestination, Review, Itinerary
from routes.chat import chat_bp

# ----------------- App & Config -----------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_super_secret_key'

# Token expiration
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['JWT_HEADER_NAME'] = "Authorization"
app.config['JWT_HEADER_TYPE'] = "Bearer"

db.init_app(app)
jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(chat_bp, url_prefix="/api/chat")

# ----------------- JWT Error Handler -----------------
@jwt.unauthorized_loader
def unauthorized_callback(reason):
    print("Unauthorized:", reason, request.headers)
    return jsonify({"message": "Token is missing or invalid. Please log in."}), 401

@jwt.invalid_token_loader
def invalid_token_callback(reason):
    print("Invalid token:", reason)
    return jsonify({"message": f"Invalid token: {reason}"}), 401

# ----------------- Utils -----------------
def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# ----------------- Routes -----------------

# -------- REGISTER --------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    errors = {}
    if len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    if not is_valid_email(email):
        errors["email"] = "Invalid email"
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    if User.query.filter_by(username=username).first():
        errors["username"] = "Username already exists"
    if User.query.filter_by(email=email).first():
        errors["email"] = "Email already exists"

    if errors:
        return jsonify({"errors": errors}), 400

    hashed_pw = generate_password_hash(password)
    new_user = User(username=username, email=email, password=hashed_pw)
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Database error"}), 500

    return jsonify({"message": "User registered successfully"}), 201

# -------- LOGIN --------
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    #if not getattr(user, "is_email_verified", True):
    #   return jsonify({"message": "Email not verified"}), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
    }), 200

# -------- REFRESH TOKEN --------
@app.route("/api/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))
    return jsonify({"access_token": access_token}), 200

# -------- GET CURRENT USER --------
@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email})

# -------- FORGOT PASSWORD --------
@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Email not found"}), 404

    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    db.session.commit()
    return jsonify({"message": "Password reset email sent (simulate)"}), 200

# -------- RESET PASSWORD --------
@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("password") or ""

    if len(new_password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({"message": "Invalid or expired token"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"}), 200

# -------- SAVED DESTINATIONS --------
@app.route("/api/saved/add", methods=["POST"])
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

@app.route("/api/saved/remove", methods=["DELETE"])
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

@app.route("/api/saved/list", methods=["GET"])
@jwt_required()
def get_saved_list():
    user_id = int(get_jwt_identity())
    saved_items = SavedDestination.query.filter_by(user_id=user_id).all()
    result = []

    for item in saved_items:
        destination = Destination.query.get(item.destination_id)
        if destination:
            # Build URL đầy đủ cho ảnh
            image_filename = destination.image_url.split("/")[-1]
            image_full_url = request.host_url.rstrip('/') + url_for('static', filename=f'images/{image_filename}')

            result.append({
                "id": destination.id,
                "name": destination.name,
                "image_url": image_full_url,  # <-- dùng URL đầy đủ
                "description": destination.description,
                "latitude": destination.latitude,
                "longitude": destination.longitude,
                "rating": destination.rating or 0,
                "category": destination.category,
                "tags": destination.tags,
                "weather": "Sunny 25°C",  # tùy muốn thêm
            })
    return jsonify(result), 200

# -------- GET ALL DESTINATIONS --------
@app.route("/api/destinations", methods=["GET"])
def get_destinations():
    destinations = Destination.query.all()
    result = []
    for dest in destinations:
        image_filename = dest.image_url.split("/")[-1]
        image_full_url = request.host_url.rstrip('/') + url_for('static', filename=f'images/{image_filename}')
        result.append({
            "id": dest.id,
            "name": dest.name,
            "description": dest.description,
            "image_url": image_full_url,
            "latitude": dest.latitude,
            "longitude": dest.longitude,
            "rating": dest.rating or 0,
            "category": dest.category,
            "tags": dest.tags,
        })
    return jsonify(result), 200

# -------- TEST JWT --------
@app.route("/api/test", methods=["GET"])
@jwt_required()
def test_jwt():
    user_id = int(get_jwt_identity())
    return jsonify({"message": "JWT valid!", "user_id": user_id})

# ----------------- Main -----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    print("Server running at http://127.0.0.1:5000")
    app.run(debug=True)
