"""
Tests for User model.
"""
import pytest
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
        from models import User, db

# Note: conftest fixtures (app, test_user, etc.) are automatically available to pytest
# No need to import them explicitly


class TestUserModel:
    """Tests for User model."""
    
    def test_create_user(self, app):
        """Test creating a user."""
        with app.app_context():
            user = User(
                username='testuser',
                email='test@example.com',
                password='hashed_password'
            )
            db.session.add(user)
            db.session.commit()
            
            assert user.id is not None
            assert user.username == 'testuser'
            assert user.email == 'test@example.com'
    
    def test_user_to_dict(self, app):
        """Test user.to_dict() method."""
        with app.app_context():
            user = User(
                username='testuser',
                email='test@example.com',
                password='hashed_password'
            )
            db.session.add(user)
            db.session.commit()
            
            user_dict = user.to_dict()
            
            assert 'id' in user_dict
            assert 'username' in user_dict
            assert 'email' in user_dict
            assert 'password' not in user_dict  # Should not include password
    
    def test_user_relationships(self, app, test_user, test_itinerary):
        """Test user relationships."""
        with app.app_context():
            # Query user again to get fresh relationship with eager loading
            # This ensures the relationship is loaded in the same session
            user = User.query.filter_by(id=test_user.id).first()
            assert user is not None
            assert len(user.itineraries) > 0
            assert user.itineraries[0].id == test_itinerary.id

