# backend/seed.py
from app import app
from models import db, Destination

# Danh sách địa điểm demo
demo_destinations = [
    {
        "name": "Ha Long Bay",
        "description": "Famous for its emerald waters and limestone islands",
        "image_url": "/static/images/halong.png",
        "rating": 4.7
    },
    {
        "name": "Hoi An Ancient Town",
        "description": "Charming historic town with lanterns",
        "image_url": "/static/images/hoian.png",
        "rating": 4.5
    },
    {
        "name": "Phu Quoc Island",
        "description": "Tropical paradise known for crystal-clear beaches and sunsets",
        "image_url": "/static/images/phuquoc.png",
        "rating": 4.6
    },
    {
        "name": "Da Nang City",
        "description": "Vibrant coastal city famous for beaches and the Golden Bridge",
        "image_url": "/static/images/danang.png",
        "rating": 4.7
    },
    {
        "name": "Vung Tau",
        "description": "Popular beach destination with sea breeze and coastal views",
        "image_url": "/static/images/vungtau.png",
        "rating": 4.3
    },
    {
        "name": "Sa Pa",
        "description": "Mountain town known for terraced fields and cool climate",
        "image_url": "/static/images/sapa.png",
        "rating": 4.8
    },
]

with app.app_context():
    # Thêm vào database
    for dest in demo_destinations:
        exists = Destination.query.filter_by(name=dest["name"]).first()
        if not exists:
            d = Destination(
                name=dest["name"],
                description=dest["description"],
                image_url=dest["image_url"],
                rating=dest["rating"]
            )
            db.session.add(d)
    db.session.commit()
    print("Seeded database with demo destinations!")
