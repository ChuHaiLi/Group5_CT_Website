"""
Tests for Itinerary model.
"""
import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add backend to path for imports
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Mock env loader before importing
with patch('utils.env_loader.load_backend_env', MagicMock()):
    with patch('dotenv.load_dotenv', MagicMock()):
        from models import Itinerary, db

# Note: conftest fixtures (app, test_user, test_province, etc.) are automatically available to pytest
# No need to import them explicitly


class TestItineraryModel:
    """Tests for Itinerary model."""
    
    def test_create_itinerary(self, app, test_user, test_province):
        """Test creating an itinerary."""
        with app.app_context():
            itinerary_data = [
                {
                    "day": 1,
                    "places": [
                        {
                            "id": 1,
                            "name": "Vịnh Hạ Long",
                            "category": "Sightseeing",
                            "time_slot": "08:00-10:00"
                        }
                    ]
                }
            ]
            
            itinerary = Itinerary(
                user_id=test_user.id,
                name='Test Trip',
                province_id=test_province.id,
                duration=1,
                itinerary_json=json.dumps(itinerary_data, ensure_ascii=False),
                metadata_json=json.dumps({"people": "2-4"}, ensure_ascii=False)
            )
            db.session.add(itinerary)
            db.session.commit()
            
            assert itinerary.id is not None
            assert itinerary.name == 'Test Trip'
            assert itinerary.duration == 1
            assert itinerary.user_id == test_user.id
    
    def test_itinerary_json_serialization(self, app, test_user, test_province):
        """Test itinerary_json serialization/deserialization."""
        with app.app_context():
            itinerary_data = [
                {"day": 1, "places": [{"id": 1, "name": "Place A"}]}
            ]
            
            itinerary = Itinerary(
                user_id=test_user.id,
                name='Test',
                province_id=test_province.id,
                duration=1,
                itinerary_json=json.dumps(itinerary_data, ensure_ascii=False)
            )
            db.session.add(itinerary)
            db.session.commit()
            
            # Deserialize
            parsed = json.loads(itinerary.itinerary_json)
            assert isinstance(parsed, list)
            assert parsed[0]['day'] == 1
    
    def test_metadata_json_serialization(self, app, test_user, test_province):
        """Test metadata_json serialization."""
        with app.app_context():
            metadata = {"people": "2-4", "budget": "5-10 triệu"}
            
            itinerary = Itinerary(
                user_id=test_user.id,
                name='Test',
                province_id=test_province.id,
                duration=1,
                metadata_json=json.dumps(metadata, ensure_ascii=False)
            )
            db.session.add(itinerary)
            db.session.commit()
            
            parsed = json.loads(itinerary.metadata_json)
            assert parsed['people'] == "2-4"
            assert parsed['budget'] == "5-10 triệu"
    
    def test_itinerary_relationships(self, app, test_user, test_province):
        """Test itinerary relationships."""
        with app.app_context():
            itinerary = Itinerary(
                user_id=test_user.id,
                name='Test',
                province_id=test_province.id,
                duration=1
            )
            db.session.add(itinerary)
            db.session.commit()
            
            assert itinerary.user.id == test_user.id
            assert itinerary.province.id == test_province.id

