from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Region(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    
    provinces = db.relationship("Province", backref="region", lazy=True)

    def __repr__(self):
        return f"<Region {self.name}>"

class Province(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    overview = db.Column(db.Text) # Giới thiệu chung về tỉnh
    image_url = db.Column(db.String(255)) # Ảnh đại diện cho Tỉnh
    
    region_id = db.Column(db.Integer, db.ForeignKey("region.id"), nullable=False)
    
    destinations = db.relationship("Destination", backref="province", lazy=True)

    def __repr__(self):
        return f"<Province {self.name}>"


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(200), nullable=True)
    
    saved_destinations = db.relationship("SavedDestination", backref="user", lazy=True)
    itineraries = db.relationship("Itinerary", backref="user", lazy=True)
    reviews = db.relationship("Review", backref="user", lazy=True)
    chat_sessions = db.relationship("ChatSession", backref="user", lazy=True) # Đã có sẵn

class Destination(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    
    province_id = db.Column(db.Integer, db.ForeignKey("province.id"), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)
    place_type = db.Column(db.String(50)) 
    description = db.Column(db.Text) 
    
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    
    opening_hours = db.Column(db.String(100))
    entry_fee = db.Column(db.Float)
    source = db.Column(db.String(255))

    image_url = db.Column(db.String(200)) 
    rating = db.Column(db.Float, default=0)
    tags = db.Column(db.Text) 
    category = db.Column(db.String(50)) 

    # Relationship
    reviews = db.relationship("Review", backref="destination", lazy=True)
    saved_by_users = db.relationship("SavedDestination", backref="destination", lazy=True)

class DestinationImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(255), nullable=False)
    destination_id = db.Column(db.Integer, db.ForeignKey('destination.id'), nullable=False)
    destination = db.relationship("Destination", backref=db.backref("images", lazy=True, cascade="all, delete-orphan"))


class Itinerary(db.Model):
    __tablename__ = 'itineraries'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    province_id = db.Column(db.Integer, db.ForeignKey('provinces.id'), nullable=False)
    duration = db.Column(db.Integer, nullable=False, default=1) # Số ngày của chuyến đi
    
    # 💡 LỘ TRÌNH CHIA NGÀY (Lưu trữ JSON string)
    itinerary_json = db.Column(db.Text, nullable=True) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref='trips')  
    province = db.relationship('Province', backref='itineraries')

    def __repr__(self):
        return f"<Itinerary {self.id}: {self.name} - Province {self.province_id}>"
    
# Nơi lưu địa điểm yêu thích (Không cần thay đổi)
class SavedDestination(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    destination_id = db.Column(db.Integer, db.ForeignKey('destination.id'), nullable=False)
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)

# Đánh giá địa điểm (Không cần thay đổi)
class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    destination_id = db.Column(db.Integer, db.ForeignKey('destination.id'), nullable=False)
    rating = db.Column(db.Float, nullable=False) 
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# --- 4. MODEL CHATBOT ---

class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(150), default="Cuộc trò chuyện mới")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # messages đã có sẵn

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_session.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attachments = db.relationship(
        "ChatAttachment",
        backref="message",
        lazy=True,
        cascade="all, delete-orphan"
    )

class ChatAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('chat_message.id'), nullable=False)
    name = db.Column(db.String(255))
    data_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
