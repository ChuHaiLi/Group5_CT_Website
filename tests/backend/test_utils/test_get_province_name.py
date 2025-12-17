"""
Tests for get_province_name_by_id function.
Requires database setup, so tested with app fixture.
"""
import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# Add backend to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import with mocking
with patch('utils.env_loader.load_backend_env', MagicMock()):
    with patch('dotenv.load_dotenv', MagicMock()):
        from app import get_province_name_by_id


class TestGetProvinceNameById:
    """Tests for get_province_name_by_id function."""
    
    def test_valid_province_id(self, app, test_province):
        """Test with valid province ID."""
        with app.app_context():
            name = get_province_name_by_id(test_province.id)
            assert name == "Hà Nội"
    
    def test_invalid_province_id(self, app):
        """Test with invalid province ID."""
        with app.app_context():
            name = get_province_name_by_id(99999)
            assert name == "Can't find..."
    
    def test_null_province_id(self, app):
        """Test with null province ID."""
        with app.app_context():
            name = get_province_name_by_id(None)
            assert name == "Can't find..."

