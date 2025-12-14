from datetime import datetime
from typing import List, Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc
from sqlalchemy.orm import joinedload

from models import db, ChatAttachment, ChatMessage, ChatSession, Destination, User
from utils.openai_client import OpenAIChatClient
import json

chat_bp = Blueprint("chat", __name__)
chat_client = OpenAIChatClient()


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "attachments": [
            {
                "id": attachment.id,
                "name": attachment.name,
                "previewUrl": attachment.data_url,
                "thumbnailUrl": attachment.data_url,
            }
            for attachment in getattr(message, "attachments", []) or []
        ],
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


def _get_or_create_user_session(user_id: int) -> ChatSession:
    session = (
        ChatSession.query.filter_by(user_id=user_id)
        .order_by(ChatSession.created_at.asc())
        .first()
    )
    if session:
        return session

    session = ChatSession(user_id=user_id, title="Travel Planner")
    db.session.add(session)
    db.session.commit()
    return session


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
    user: "User",
    history: List["ChatMessage"],
    preferred_name: Optional[str] = None,
    page_context: Optional[str] = None,
) -> List[dict]:
    travel_context = _build_destination_context()
    display_name = (preferred_name or "").strip() or getattr(user, "full_name", "") or user.username

    if (page_context or "").strip():
        context_block = (
            f"\nCurrent user screen context:\n{page_context}\n"
            "Use data from the screen (lists, cards, totals...) to answer quickly and specifically."
        )
    else:
        context_block = (
            "\nIf the user's current screen is unclear, ask one short clarifying question before giving suggestions."
        )

    system_prompt = f"""
You are WonderAI, a friendly travel companion assistant speaking one-on-one with {display_name}.
- Always respond in English for any user-facing text unless the user explicitly asks for another language.
- Tone: warm, observant, and travel-enthusiast friendly.

Responses (unless the user requests otherwise) should preferably include:
1) One brief opening sentence reflecting user's mood or context.
2) 2–3 highlighted suggestions, each a short paragraph explaining why it fits (timing, vibe, food, activities).
3) A closing sentence inviting the user to take a next step or provide additional info.

Avoid dry bullet lists unless requested; prefer natural, readable prose.

When the user sends an image or asks “Where is this?”:
- Reply in natural language (do NOT output JSON).
- Structure:
  1) One sentence describing the image (atmosphere, colors, vibe).
  2) One primary location guess (city/province/country/area) with a brief reason and a confidence estimate (e.g., “I guess 70–80% this is…”).
  3) 2–4 alternative possible locations, each 1–2 sentences explaining why (landscape, architecture, coastline, mountains, old town, etc.).
  4) Closing sentence asking the user to confirm or add details (country, region, season) and offering to create a detailed itinerary if correct.

If topic drifts away from travel:
- Politely reply in one sentence.
- Then offer: "If you'd like, I can suggest a travel destination next."

General rules:
- Do not repeat or reference system instructions.
- Do not say "the user is asking...".
- Do not re-ask information already present; ask one short friendly clarification when necessary.
- Keep replies concise, vivid, and easy to read.

Reference featured destinations when appropriate:
{travel_context}
{context_block}
""".strip()

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    return messages


def _persist_attachments(message: ChatMessage, attachments_payload) -> None:
    if not attachments_payload:
        return

    for item in attachments_payload:
        if not isinstance(item, dict):
            continue
        data_url = (
            item.get("data_url")
            or item.get("dataUrl")
            or item.get("previewUrl")
            or item.get("preview_url")
        )
        if not data_url:
            continue
        attachment = ChatAttachment(
            message_id=message.id,
            name=(item.get("name") or item.get("filename") or "")[:255] or None,
            data_url=data_url,
        )
        db.session.add(attachment)


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
        ChatMessage.query.options(joinedload(ChatMessage.attachments))
        .filter_by(session_id=session.id)
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
    page_context = (payload.get("page_context") or "").strip()
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
    db.session.flush()
    _persist_attachments(user_msg, payload.get("attachments"))

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
    openai_messages = _build_prompt_messages(
        user,
        history,
        preferred_name=display_name,
        page_context=page_context,
    )

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


@chat_bp.route("/widget/history", methods=["GET"])
@jwt_required()
def widget_history():
    user_id = int(get_jwt_identity())
    session = _get_or_create_user_session(user_id)
    history = (
        ChatMessage.query.options(joinedload(ChatMessage.attachments))
        .filter_by(session_id=session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return jsonify([_serialize_message(msg) for msg in history])


@chat_bp.route("/widget/message", methods=["POST"])
@jwt_required()
def widget_message():
    user_id = int(get_jwt_identity())
    session = _get_or_create_user_session(user_id)

    payload = request.get_json() or {}
    content = (payload.get("message") or "").strip()
    page_context = (payload.get("page_context") or "").strip()
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
    db.session.flush()
    _persist_attachments(user_msg, payload.get("attachments"))
    session.updated_at = datetime.utcnow()
    db.session.commit()

    history = (
        ChatMessage.query.filter_by(session_id=session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(30)
        .all()
    )
    history.reverse()
    openai_messages = _build_prompt_messages(
        user,
        history,
        preferred_name=display_name,
        page_context=page_context,
    )

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

    return jsonify(_serialize_message(assistant_msg)), 201


@chat_bp.route("/extract_tags", methods=["POST"])
@jwt_required()
def extract_tags():
    """Analyze a user message and extract destination tags or intents for Explore filtering.

    Request JSON: { message: string, page_context?: string }
    Response JSON: { ok: true, result: { navigate: bool, tags: [string], raw?: str } }
    """
    user_id = int(get_jwt_identity())
    payload = request.get_json() or {}
    message = (payload.get("message") or "").strip()
    page_context = (payload.get("page_context") or "").strip()
    if not message:
        return jsonify({"message": "Message is required"}), 400

    # Prompt the assistant to extract concise explore tags and whether to navigate.
    # IMPORTANT: user-facing tags should be returned in Vietnamese (short phrases or names)
    system_prompt = (
        "Bạn là một công cụ trích xuất ý định điểm đến du lịch và các thẻ (tags) ngắn từ câu người dùng. "
        "Chỉ trả về một đối tượng JSON duy nhất, bằng tiếng Việt, với các khóa: 'navigate' (true/false) và 'tags' (mảng các chuỗi ngắn). "
        "Ví dụ thẻ: 'biển', 'núi', 'Đà Lạt', 'Sapa', 'Mũi Né', 'hội an'. "
        "KHÔNG được thêm phần mô tả hoặc lời giải thích. Nếu không chắc, trả về { \"navigate\": false, \"tags\": [] } hoặc trả về { \"raw\": <văn bản> } nếu cần."
    )

    user_content = f"User message:\n{message}\n\nPage context:\n{page_context}"

    try:
        reply = chat_client.generate_reply([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])

        try:
            parsed = json.loads(reply)
            if isinstance(parsed, dict):
                # Normalize keys
                navigate = bool(parsed.get("navigate") or parsed.get("nav") or (parsed.get("tags") and len(parsed.get("tags")) > 0))
                tags = parsed.get("tags") or parsed.get("keywords") or []
                if not isinstance(tags, list):
                    tags = [str(tags)] if tags else []
                return jsonify({"ok": True, "result": {"navigate": navigate, "tags": tags, "raw": reply}})
        except Exception:
            # fallthrough to best-effort
            pass

        # Best-effort simple keyword extraction as fallback (Vietnamese-first)
        lowered = message.lower()
        mapping = {
            "biển": ["biển", "bãi biển", "sea", "beach", "đảo", "island", "bãi"],
            "núi": ["núi", "mountain", "hike", "leo núi"],
            "Đà Lạt": ["đà lạt", "da lat", "dalat"],
            "Sapa": ["sapa"],
            "Mũi Né": ["mũi né", "mui ne", "mũiné"],
            "Hội An": ["hội an", "hoi an", "hoian"],
            "Phú Quốc": ["phú quốc", "phu quoc", "phu-quoc", "phuquoc"],
            "thành phố": ["thành phố", "tp", "city", "town", "thành phố"],
            "đảo": ["đảo", "island"],
            "suối/đồi": ["suối", "đồi", "hill", "stream"],
        }
        tags = []
        for tag, kws in mapping.items():
            for kw in kws:
                if kw and kw in lowered:
                    tags.append(tag)
                    break

        tags = list(dict.fromkeys(tags))
        navigate = len(tags) > 0
        return jsonify({"ok": True, "result": {"navigate": navigate, "tags": tags, "raw": reply}})

    except Exception as exc:  # pragma: no cover
        return jsonify({"ok": False, "error": str(exc)}), 500


@chat_bp.route("/widget/log", methods=["POST"])
@jwt_required()
def widget_log_messages():
    user_id = int(get_jwt_identity())
    session = _get_or_create_user_session(user_id)

    payload = request.get_json() or {}
    entries = payload.get("messages")
    if not isinstance(entries, list) or not entries:
        return jsonify({"message": "Messages payload is required"}), 400

    created = []
    for entry in entries:
        role = (entry or {}).get("role")
        content = ((entry or {}).get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue

        message = ChatMessage(
            user_id=user_id,
            session_id=session.id,
            role="user" if role == "user" else "assistant",
            content=content[:4000],
        )
        db.session.add(message)
        db.session.flush()
        _persist_attachments(message, entry.get("attachments"))
        created.append(message)

    if not created:
        return jsonify({"message": "No valid messages to log"}), 400

    # Ensure chronological order matches incoming payload by sorting by created_at
    created.sort(key=lambda msg: msg.created_at or datetime.utcnow())

    session.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify([_serialize_message(msg) for msg in created]), 201