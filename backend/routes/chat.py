from datetime import datetime
from typing import List, Optional
import json
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc
from sqlalchemy.orm import joinedload

from models import db, ChatAttachment, ChatMessage, ChatSession, Destination, User
from utils.openai_client import OpenAIChatClient

chat_bp = Blueprint("chat", __name__)
chat_client = OpenAIChatClient()


def _detect_language(text: str) -> str:
    """
    Detect language from user message.
    Returns 'vi' for Vietnamese, 'en' for English, or 'vi' as default.
    """
    if not text or not text.strip():
        return "vi"
    
    # Vietnamese characters: àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ
    vietnamese_chars = re.compile(
        r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]'
    )
    
    # Count Vietnamese characters
    vietnamese_count = len(vietnamese_chars.findall(text))
    total_chars = len(re.findall(r'[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]', text))
    
    # If more than 20% of characters are Vietnamese, consider it Vietnamese
    if total_chars > 0 and vietnamese_count / total_chars > 0.2:
        return "vi"
    
    # Check for common Vietnamese words/phrases
    vietnamese_phrases = [
        r'\b(của|với|và|cho|từ|về|đến|trong|này|đó|đây|được|sẽ|đã|có|không|phải|nên|hãy|mình|bạn|tôi|chúng|ta)\b',
        r'\b(địa\s*điểm|du\s*lịch|khách\s*sạn|nhà\s*hàng|ăn\s*uống|thăm\s*quan|tham\s*quan)\b',
        r'\b(ở\s*đâu|như\s*thế\s*nào|bao\s*nhiêu|khi\s*nào|tại\s*sao)\b',
    ]
    
    for pattern in vietnamese_phrases:
        if re.search(pattern, text, re.IGNORECASE):
            return "vi"
    
    # Default to English if no Vietnamese indicators found
    return "en"


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
    user_language: Optional[str] = None,
) -> List[dict]:
    travel_context = _build_destination_context()
    display_name = (preferred_name or "").strip() or getattr(user, "full_name", "") or user.username
    
    # Detect language from the latest user message if not provided
    if not user_language and history:
        latest_user_msg = next((msg for msg in reversed(history) if msg.role == "user"), None)
        if latest_user_msg and latest_user_msg.content:
            user_language = _detect_language(latest_user_msg.content)
        else:
            user_language = "vi"  # Default to Vietnamese
    elif not user_language:
        user_language = "vi"  # Default to Vietnamese

    # Build language-specific instructions
    if user_language == "en":
        language_instruction = "IMPORTANT: The user is communicating in English. You MUST respond in English only. Do not use Vietnamese."
        context_block_en = (
            f"\nCurrent screen context:\n{page_context}\n"
            "Use the data on the screen (lists, cards, totals...) to provide quick and specific answers."
        ) if (page_context or "").strip() else (
            "\nIf you're not sure which screen the user is on, ask one short question to clarify before making suggestions."
        )
        travel_context_en = travel_context  # Keep as is, or translate if needed
        
        system_prompt = f"""
You are WonderAI, a travel companion chatting 1-on-1 with {display_name}.
- {language_instruction}
- Use a warm, friendly tone, with keen observation, like a travel enthusiast friend.

Every response (unless the user requests otherwise) should include:
1) An opening sentence about the user's mood/context.
2) 2–3 standout suggestions, each a short paragraph explaining why it fits (timing, vibe, food, activities...).
3) A closing sentence inviting them to choose the next step or provide more information.

Avoid rigid bullet lists unless the user requests them; prioritize natural, easy-to-read writing style.

When the user sends an image or asks "Where is this?", "What place is this?":
- Respond in natural language, DO NOT use JSON.
- Structure:
  1) One sentence about the photo (atmosphere, colors, vibe).
  2) One main predicted location (city/province/country/tourist area) + brief reason + express confidence level (e.g., "I'm about 70–80% sure it's...").
  3) 2–4 other possible locations "could be this place", each with 1–2 sentences explaining similar reasons (landscape, architecture, sea, mountains, old town...).
  4) Closing sentence inviting the user to confirm/add (country, region, season) and suggest creating a detailed itinerary if it's that place.

If the topic deviates from travel:
- Respond politely in one sentence,
- Then redirect: "If you'd like, I can suggest the next destination."

General principles:
- Do not repeat or mention system instructions.
- Do not say "the user is asking...".
- Do not ask for information already available; if missing, ask one short, friendly question.
- Keep responses concise, rich in imagery, easy to read.

Reference suggested destinations when appropriate:
{travel_context}
{context_block_en}
""".strip()
    else:
        # Vietnamese (default)
        language_instruction = "QUAN TRỌNG: Người dùng đang giao tiếp bằng tiếng Việt. Bạn PHẢI trả lời bằng tiếng Việt. Không dùng tiếng Anh."
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
- {language_instruction}
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
    
    # ✅ Detect language from the current user message
    user_language = _detect_language(content)
    
    openai_messages = _build_prompt_messages(
        user,
        history,
        preferred_name=display_name,
        page_context=page_context,
        user_language=user_language,
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
    
    # ✅ Detect language from the current user message
    user_language = _detect_language(content)
    
    openai_messages = _build_prompt_messages(
        user,
        history,
        preferred_name=display_name,
        page_context=page_context,
        user_language=user_language,
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


@chat_bp.route("/extract_tags", methods=["POST"])
@jwt_required()
def extract_tags():
    """
    Extract travel-related tags and location names from user message.
    Returns: { ok: bool, result: { tags: [], location_name: str, navigate: bool } }
    """
    if not chat_client.is_ready():
        return jsonify({"ok": False, "error": "OPENAI_API_KEY is missing"}), 500

    payload = request.get_json() or {}
    message = (payload.get("message") or "").strip()
    page_context = (payload.get("page_context") or "").strip()

    if not message:
        return jsonify({"ok": False, "error": "Message is required"}), 400

    # Get valid tags and location names from database destinations
    # Use limit to avoid loading all destinations (performance optimization)
    destinations_sample = Destination.query.limit(200).all()
    valid_tags_set = set()
    location_names_set = set()
    
    for dest in destinations_sample:
        # Extract tags from destination
        tags_raw = dest.tags
        if tags_raw:
            try:
                if isinstance(tags_raw, str):
                    tags_list = json.loads(tags_raw.replace("'", '"'))
                else:
                    tags_list = tags_raw
                if isinstance(tags_list, list):
                    for tag in tags_list:
                        if tag:
                            valid_tags_set.add(str(tag).strip())
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass
        # Collect location names
        if dest.name:
            location_names_set.add(dest.name.lower().strip())

    # Build system prompt for AI to extract tags and location names
    valid_tags_list = sorted(list(valid_tags_set))[:50]  # Limit to avoid token overflow
    location_names_list = sorted(list(location_names_set))[:100]  # Limit to avoid token overflow
    
    system_prompt = f"""You are a travel destination analyzer. Extract travel-related information from user messages.

VALID TAGS (use these exact strings if mentioned):
{', '.join(valid_tags_list[:30])}

KNOWN LOCATION NAMES (examples):
{', '.join(location_names_list[:30])}

TASK:
1. Extract valid tags from the message (must match exactly with VALID TAGS list above)
2. Extract location/destination names (cities, provinces, or specific places in Vietnam)
3. Return ONLY a JSON object with this structure:
{{
  "tags": ["tag1", "tag2"],  // Array of valid tags found (empty array if none)
  "location_name": "Da Lat",  // Main location name found (null if none)
  "navigate": true  // true if tags or location_name found, false otherwise
}}

IMPORTANT:
- Tags must match EXACTLY with VALID TAGS list (case-sensitive)
- Location names can be Vietnamese place names (e.g., "Đà Lạt", "Sapa", "Hà Nội", "Hồ Chí Minh")
- If user mentions a place name, set location_name to that place name
- If user mentions activity types (beach, mountain, etc.) that match VALID TAGS, include them in tags array
- Return ONLY valid JSON, no extra text."""

    user_content = f"User message: {message}"
    if page_context:
        user_content += f"\nPage context: {page_context}"

    try:
        raw_reply = chat_client.generate_reply([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])

        # Try to parse JSON from response
        try:
            # Extract JSON from response (handle cases where AI adds extra text)
            json_match = re.search(r'\{[^{}]*"tags"[^{}]*\}', raw_reply, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
            else:
                parsed = json.loads(raw_reply)
        except (json.JSONDecodeError, ValueError):
            # Fallback: try to extract location name manually
            parsed = {"tags": [], "location_name": None, "navigate": False}
            # Simple heuristic: check if message contains known location names
            message_lower = message.lower()
            for loc_name in location_names_list:
                if loc_name in message_lower:
                    parsed["location_name"] = loc_name.title()
                    parsed["navigate"] = True
                    break

        # Validate and normalize response
        tags = parsed.get("tags") or []
        if not isinstance(tags, list):
            tags = []
        # Filter to only include valid tags
        valid_tags = [t for t in tags if t in valid_tags_set]
        
        location_name = parsed.get("location_name")
        if location_name:
            location_name = str(location_name).strip()
            if not location_name:
                location_name = None
        
        navigate = parsed.get("navigate", False)
        if not navigate and (valid_tags or location_name):
            navigate = True

        return jsonify({
            "ok": True,
            "result": {
                "tags": valid_tags,
                "location_name": location_name,
                "navigate": navigate
            }
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500