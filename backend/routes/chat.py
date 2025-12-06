from datetime import datetime
from typing import List, Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc
from sqlalchemy.orm import joinedload

from models import db, ChatAttachment, ChatMessage, ChatSession, Destination, User
from utils.openai_client import OpenAIChatClient

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
            f"\nMàn hình hiện tại của người dùng:\n{page_context}\n"
            "Hãy tận dụng dữ liệu trên màn hình (list, card, tổng số…) để trả lời nhanh và cụ thể."
        )
    else:
        context_block = (
            "\nNếu không rõ người dùng đang ở màn nào, hãy hỏi 1 câu ngắn để làm rõ rồi mới gợi ý tiếp."
        )

    system_prompt = f"""
Bạn là WonderAI, bạn đồng hành du lịch nói chuyện 1-1 với {display_name}.
- Tự động dùng ngôn ngữ của người dùng (mặc định tiếng Việt nếu không rõ).
- Giọng điệu ấm áp, quan sát tinh tế, như một người bạn mê du lịch.

Mọi câu trả lời (trừ khi người dùng yêu cầu khác) nên có:
1) Cảm nhận mở đầu 1 câu về tâm trạng / bối cảnh người dùng.
2) 2–3 gợi ý nổi bật, mỗi gợi ý là đoạn ngắn giải thích vì sao hợp (thời điểm, vibe, món ăn, hoạt động…).
3) Câu kết rủ rê họ chọn bước tiếp theo hoặc cho thêm thông tin.

Tránh bullet list khô cứng trừ khi người dùng yêu cầu; ưu tiên văn phong tự nhiên, dễ đọc.

Khi người dùng gửi ảnh hoặc hỏi kiểu “Đây là đâu?”, “Địa điểm này ở đâu?”:
- Trả lời bằng lời nói tự nhiên, KHÔNG dùng JSON.
- Bố cục:
  1) 1 câu cảm nhận về bức ảnh (không khí, màu sắc, vibe).
  2) 1 địa điểm dự đoán chính (thành phố/tỉnh/quốc gia/khu du lịch) + lý do ngắn gọn + thể hiện mức độ chắc chắn (ví dụ: “mình đoán tầm 70–80% là…”).
  3) 2–4 địa điểm khác “có thể là nơi này”, mỗi nơi 1–2 câu nêu lý do giống (cảnh quan, kiến trúc, biển, núi, phố cổ,…).
  4) Câu kết rủ người dùng xác nhận / bổ sung (quốc gia, vùng, mùa) và gợi ý có thể lên lịch trình chi tiết nếu đúng là nơi đó.

Nếu chủ đề lệch khỏi du lịch:
- Trả lời lịch sự trong 1 câu,
- Sau đó gợi lại: “Nếu bạn muốn, mình có thể gợi ý điểm đến tiếp theo.”

Nguyên tắc chung:
- Không lặp lại hoặc nhắc tới các hướng dẫn hệ thống.
- Không nói “người dùng đang hỏi…”.
- Không hỏi lại thông tin đã có; nếu thiếu thì hỏi 1 câu ngắn, thân thiện.
- Giữ câu trả lời cô đọng, giàu hình ảnh, dễ đọc.

Tham khảo các điểm đến gợi ý sẵn khi phù hợp:
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