"""
Pytest configuration and shared fixtures for backend tests.
"""
import pytest
import sys
import os
import json
from unittest.mock import Mock, patch, MagicMock

# Add backend directory to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Mock environment loader BEFORE importing app
# This prevents errors when app.py tries to load .env files
mock_env_loader = patch('utils.env_loader.load_backend_env', MagicMock())
mock_dotenv = patch('dotenv.load_dotenv', MagicMock())

mock_env_loader.start()
mock_dotenv.start()

try:
    # Now import app and models
    from app import app as flask_app
    from models import db, User, Itinerary, Destination, Province, Region
except Exception as e:
    # If import fails, stop mocks and re-raise
    mock_env_loader.stop()
    mock_dotenv.stop()
    raise


@pytest.fixture
def app():
    """Create a test Flask application."""
    # Use in-memory SQLite database for tests
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    flask_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    flask_app.config['JWT_SECRET_KEY'] = 'test-secret-key'
    flask_app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # No expiration for tests
    
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()


@pytest.fixture
def auth_headers(app, test_user):
    """Generate JWT token headers for authenticated requests."""
    from flask_jwt_extended import create_access_token
    
    with app.app_context():
        token = create_access_token(identity=test_user.id)
        return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def test_user(app):
    """Create a test user."""
    with app.app_context():
        user = User(
            username='testuser',
            email='test@example.com',
            password='hashed_password',
            is_email_verified=True
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        return user


@pytest.fixture
def test_province(app):
    """Create a test province."""
    with app.app_context():
        region = Region(name='Miền Bắc')
        db.session.add(region)
        db.session.commit()
        
        province = Province(
            name='Hà Nội',
            name_unaccented='Ha Noi',
            region_id=region.id
        )
        db.session.add(province)
        db.session.commit()
        db.session.refresh(province)
        return province


@pytest.fixture
def test_destination(app, test_province):
    """Create a test destination."""
    with app.app_context():
        destination = Destination(
            name='Vịnh Hạ Long',
            name_unaccented='Vinh Ha Long',
            province_id=test_province.id,
            category='Sightseeing',
            latitude=20.9101,
            longitude=107.1839,
            rating=4.5,
            description='["Di sản thiên nhiên thế giới"]',
            tags='["Beach", "Adventure"]'
        )
        db.session.add(destination)
        db.session.commit()
        db.session.refresh(destination)
        return destination


@pytest.fixture
def test_itinerary(app, test_user, test_province):
    """Create a test itinerary."""
    with app.app_context():
        itinerary_data = [
            {
                "day": 1,
                "places": [
                    {
                        "id": 1,
                        "name": "Vịnh Hạ Long",
                        "category": "Sightseeing",
                        "time_slot": "08:00-10:00",
                        "duration_hours": 2.0
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
            metadata_json=json.dumps({"people": "2-4", "budget": "5-10 triệu"}, ensure_ascii=False)
        )
        db.session.add(itinerary)
        db.session.commit()
        db.session.refresh(itinerary)
        return itinerary


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client."""
    with patch('utils.openai_client.OpenAIChatClient') as mock:
        instance = mock.return_value
        instance.generate_reply.return_value = '{"score": 85, "decision": "ok"}'
        yield instance


@pytest.fixture
def mock_smtp():
    """Mock SMTP server for email tests."""
    with patch('smtplib.SMTP') as mock_smtp:
        mock_server = Mock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        yield mock_server

