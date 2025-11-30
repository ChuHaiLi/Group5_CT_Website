import base64
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
for path in (ROOT, BACKEND):
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.app import app, db
from backend.utils.image_recognition import OpenAIImageRecognizer
from backend.routes.search import _build_destination_snapshot

def main():
    img_path = "frontend/public/logo192.png"
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"
    client = OpenAIImageRecognizer()
    print("ready:", client.is_ready())
    with app.app_context():
        db.create_all()  # ensure tables exist when running the script standalone
        context = _build_destination_snapshot()
    text = client.describe_location_text(
        user_prompt="Nhận dạng giúp mình",
        image_data_urls=[data_url],
        destination_context=context,
    )
    print(text)

if __name__ == "__main__":
    main()
