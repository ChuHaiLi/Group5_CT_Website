import os

API_KEY = os.getenv("GEMINI_API_KEY")

def get_ai_recommendations(user_input):
    """
    user_input = {budget, duration, interests}
    TODO: call Gemini API here
    """
    # Demo dummy data
    return [
        {"id": 1, "name": "Beach Paradise", "description": "Sunny beach", "image_url": "https://example.com/beach.jpg"},
        {"id": 2, "name": "Mountain Trek", "description": "Adventure hike", "image_url": "https://example.com/mountain.jpg"}
    ]
