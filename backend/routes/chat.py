from datetime import datetime
from typing import List, Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc

from models import db, ChatMessage, ChatSession, Destination, User
from utils.openai_client import OpenAIChatClient

chat_bp = Blueprint("chat", __name__)
chat_client = OpenAIChatClient()


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def _serialize_session(session: ChatSession) -> dict:
    last_message = (
        ChatMessage.query.filter_by(session_id=session.id)
        .order_by(ChatMessage.created_at.desc())
        .first()
    )
    preview = ""
    if last_message and last_message.content:
        preview = last_message.content[:90]
        if len(last_message.content) > 90:
            preview += "…"

    return {
        "id": session.id,
        "title": session.title or "Cuộc trò chuyện mới",
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "last_message": preview,
    }


def _get_session_or_404(user_id: int, session_id: int) -> Optional[ChatSession]:
    return ChatSession.query.filter_by(id=session_id, user_id=user_id).first()


def _build_destination_context() -> str:
    featured = (
        Destination.query.order_by(desc(Destination.rating)).limit(5).all()
    )
    if not featured:
        return "Không có dữ liệu điểm đến nổi bật hiện tại."

    lines = []
    for dest in featured:
        snippet = (dest.description or "")[:180]
        lines.append(f"- {dest.name} ({dest.category or 'du lịch'}): {snippet}")
    return "\n".join(lines)


def _build_prompt_messages(
    user: User,
    history: List[ChatMessage],
    preferred_name: Optional[str] = None,
) -> List[dict]:
    travel_context = _build_destination_context()
    display_name = (preferred_name or "").strip() or getattr(user, "full_name", "") or user.username
    system_prompt = (
        "Bạn là Astra, trợ lý du lịch của Travel Smart Planner. "
        f"Người dùng hiện tại tên là {display_name}. "
        "Luôn giữ ngữ giọng thân thiện, nhất quán và nhớ lại các thông tin đã trò chuyện trước đó. "
        "Sử dụng dữ liệu điểm đến sau đây khi phù hợp để cá nhân hóa gợi ý:\n"
        f"{travel_context}\n"
        "Nếu thiếu thông tin, hãy đặt câu hỏi để hiểu thêm nhu cầu của người dùng."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    return messages


@chat_bp.route("/sessions", methods=["GET"])
@jwt_required()
def list_sessions():
    user_id = int(get_jwt_identity())
    empty_sessions = (
        ChatSession.query.filter_by(user_id=user_id)
        .filter(~ChatSession.messages.any())
        .all()
    )
    if empty_sessions:
        for session in empty_sessions:
            db.session.delete(session)
        db.session.commit()

    sessions = (
        ChatSession.query.filter_by(user_id=user_id)
        .filter(ChatSession.messages.any())
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return jsonify([_serialize_session(session) for session in sessions])


@chat_bp.route("/sessions", methods=["POST"])
@jwt_required()
def create_session():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    title = (data.get("title") or "").strip() or "Cuộc trò chuyện mới"
    session = ChatSession(user_id=user_id, title=title)
    db.session.add(session)
    db.session.commit()
    return jsonify(_serialize_session(session)), 201


@chat_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@jwt_required()
def delete_session(session_id: int):
    user_id = int(get_jwt_identity())
    session = _get_session_or_404(user_id, session_id)
    if not session:
        return jsonify({"message": "Session not found"}), 404

    db.session.delete(session)
    db.session.commit()
    return jsonify({"message": "Session deleted"})


@chat_bp.route("/sessions/<int:session_id>", methods=["PUT"])
@jwt_required()
def update_session(session_id: int):
    user_id = int(get_jwt_identity())
    session = _get_session_or_404(user_id, session_id)
    if not session:
        return jsonify({"message": "Session not found"}), 404

    payload = request.get_json() or {}
    title = (payload.get("title") or "").strip()
    if not title:
        return jsonify({"message": "Title is required"}), 400

    session.title = title[:120]
    session.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_serialize_session(session))


@chat_bp.route("/sessions/<int:session_id>/messages", methods=["GET"])
@jwt_required()
def get_session_messages(session_id: int):
    user_id = int(get_jwt_identity())
    session = _get_session_or_404(user_id, session_id)
    if not session:
        return jsonify({"message": "Session not found"}), 404

    history = (
        ChatMessage.query.filter_by(session_id=session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return jsonify([_serialize_message(msg) for msg in history])


@chat_bp.route("/sessions/<int:session_id>/messages", methods=["POST"])
@jwt_required()
def send_session_message(session_id: int):
    user_id = int(get_jwt_identity())
    session = _get_session_or_404(user_id, session_id)
    if not session:
        return jsonify({"message": "Session not found"}), 404

    payload = request.get_json() or {}
    content = (payload.get("message") or "").strip()
    display_name = (payload.get("display_name") or "").strip()
    if not content:
        return jsonify({"message": "Message is required"}), 400

    if not chat_client.is_ready():
        return jsonify({"message": "OPENAI_API_KEY is missing on the server"}), 500

    user = session.user or User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    user_msg = ChatMessage(
        user_id=user_id,
        session_id=session.id,
        role="user",
        content=content,
    )
    db.session.add(user_msg)

    if (session.title or "").startswith("Cuộc trò chuyện") and content:
        session.title = content[:90] + ("…" if len(content) > 90 else "")

    session.updated_at = datetime.utcnow()
    db.session.commit()

    history = (
        ChatMessage.query.filter_by(session_id=session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
        .all()
    )
    history.reverse()
    openai_messages = _build_prompt_messages(user, history, preferred_name=display_name)

    try:
        reply_text = chat_client.generate_reply(openai_messages)
    except Exception as exc:  # pragma: no cover
        db.session.delete(user_msg)
        db.session.commit()
        return jsonify({"message": str(exc)}), 500

    assistant_msg = ChatMessage(
        user_id=user_id,
        session_id=session.id,
        role="assistant",
        content=reply_text,
    )
    db.session.add(assistant_msg)
    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        "reply": _serialize_message(assistant_msg),
        "session": _serialize_session(session),
    })