from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import db, User
from sqlalchemy.exc import IntegrityError
import re
from datetime import timedelta, datetime
import secrets

auth_bp = Blueprint("auth", __name__)

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

# -------- REGISTER --------
@auth_bp.route("/register", methods=["POST"])
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
    new_user = User(username=username, email=email, password=hashed_pw, is_email_verified=False)
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Database error"}), 500

    # --- Send verification email ---
    # token = secrets.token_urlsafe(32)
    # save token + send email (omitted for simplicity)
    
    return jsonify({"message": "User registered successfully. Please verify your email."}), 201

# -------- LOGIN --------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    if not user.is_email_verified:
        return jsonify({"message": "Email not verified"}), 403

    access_token = create_access_token(identity=user.id, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(identity=user.id, expires_delta=timedelta(days=7))

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
    }), 200

# -------- REFRESH TOKEN --------
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    new_token = create_access_token(identity=user_id, expires_delta=timedelta(hours=1))
    return jsonify({"access_token": new_token})

# -------- GET CURRENT USER --------
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email}), 200

# -------- FORGOT PASSWORD --------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Email not found"}), 404

    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    db.session.commit()

    # --- Send reset email with token (omitted for simplicity)
    return jsonify({"message": "Password reset email sent"}), 200

# -------- RESET PASSWORD --------
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("password")

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({"message": "Invalid or expired token"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"}), 200
