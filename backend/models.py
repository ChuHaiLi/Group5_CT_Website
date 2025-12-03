from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# -------------------------------------------------------------
# CÁC MODEL CẤP ĐỘ KHU VỰC
# -------------------------------------------------------------

class Region(db.Model):
    __tablename__ = 'regions' # <-- THÊM: Đồng bộ tên bảng số nhiều
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    
    provinces = db.relationship("Province", backref="region", lazy=True)

    def __repr__(self):
        return f"<Region {self.name}>"

class Province(db.Model):
    __tablename__ = 'provinces' # <-- THÊM: Đồng bộ tên bảng số nhiều
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    overview = db.Column(db.Text)
    image_url = db.Column(db.String(255))
    
    # SỬA: Khóa ngoại phải trỏ đến tên bảng đã định nghĩa ('regions.id')
    region_id = db.Column(db.Integer, db.ForeignKey("regions.id"), nullable=False) 
    
    destinations = db.relationship("Destination", backref="province", lazy=True)

    def __repr__(self):
        return f"<Province {self.name}>"

# -------------------------------------------------------------
# MODEL USER VÀ DESTINATION
# -------------------------------------------------------------

class User(db.Model):
    __tablename__ = 'users' # <-- GIỮ LẠI: Đồng bộ với khóa ngoại
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reset_token = db.Column(db.String(200), nullable=True)
    
    saved_destinations = db.relationship("SavedDestination", backref="user", lazy=True)
    itineraries = db.relationship("Itinerary", back_populates="user", lazy=True)
    reviews = db.relationship("Review", backref="user", lazy=True)
    chat_sessions = db.relationship("ChatSession", backref="user", lazy=True)

class Destination(db.Model):
    __tablename__ = 'destinations' # <-- THÊM: Đồng bộ với khóa ngoại
    id = db.Column(db.Integer, primary_key=True)
    
    # SỬA: Khóa ngoại phải trỏ đến tên bảng đã định nghĩa ('provinces.id')
    province_id = db.Column(db.Integer, db.ForeignKey("provinces.id"), nullable=False) 
    
    name = db.Column(db.String(100), nullable=False)
    place_type = db.Column(db.String(50)) 
    description = db.Column(db.Text) 
    # ... (Các cột khác)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    opening_hours = db.Column(db.String(100))
    entry_fee = db.Column(db.Float)
    source = db.Column(db.String(255))
    image_url = db.Column(db.String(200)) 
    rating = db.Column(db.Float, default=0)
    tags = db.Column(db.Text) 
    category = db.Column(db.String(50)) 

    reviews = db.relationship("Review", backref="destination", lazy=True)
    saved_by_users = db.relationship("SavedDestination", backref="destination", lazy=True)

class DestinationImage(db.Model):
    __tablename__ = 'destination_images' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(255), nullable=False)
    # SỬA: Khóa ngoại phải trỏ đến tên bảng đã định nghĩa ('destinations.id')
    destination_id = db.Column(db.Integer, db.ForeignKey('destinations.id'), nullable=False) 
    destination = db.relationship("Destination", backref=db.backref("images", lazy=True, cascade="all, delete-orphan"))

# -------------------------------------------------------------
# CÁC MODEL MỚI VÀ QUAN HỆ KHÓA NGOẠI
# -------------------------------------------------------------

class Itinerary(db.Model):
    __tablename__ = 'itineraries'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    
    # Khóa ngoại chính đã đúng: trỏ đến 'users.id'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    # Khóa ngoại chính đã đúng: trỏ đến 'provinces.id'
    province_id = db.Column(db.Integer, db.ForeignKey('provinces.id'), nullable=False) 
    
    duration = db.Column(db.Integer, nullable=False, default=1)
    itinerary_json = db.Column(db.Text, nullable=True) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', back_populates='itineraries')
    province = db.relationship('Province', backref='itineraries')
    def __repr__(self):
        return f"<Itinerary {self.id}: {self.name} - Province {self.province_id}>"
    
# Nơi lưu địa điểm yêu thích 
class SavedDestination(db.Model):
    __tablename__ = 'saved_destinations' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    
    # SỬA: user_id phải trỏ đến 'users.id'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # SỬA: destination_id phải trỏ đến 'destinations.id'
    destination_id = db.Column(db.Integer, db.ForeignKey('destinations.id'), nullable=False) 
    
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)

# Đánh giá địa điểm 
class Review(db.Model):
    __tablename__ = 'reviews' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    
    # SỬA: user_id phải trỏ đến 'users.id'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    # SỬA: destination_id phải trỏ đến 'destinations.id'
    destination_id = db.Column(db.Integer, db.ForeignKey('destinations.id'), nullable=False) 
    
    rating = db.Column(db.Float, nullable=False) 
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# -------------------------------------------------------------
# MODEL CHATBOT
# -------------------------------------------------------------

class ChatSession(db.Model):
    __tablename__ = 'chat_sessions' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    
    # SỬA: user_id phải trỏ đến 'users.id'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    
    title = db.Column(db.String(150), default="Cuộc trò chuyện mới")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    
    # SỬA: user_id phải trỏ đến 'users.id'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False)
    
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
    __tablename__ = 'chat_attachments' # <-- THÊM: Đồng bộ tên bảng
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('chat_messages.id'), nullable=False)
    name = db.Column(db.String(255))
    data_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)