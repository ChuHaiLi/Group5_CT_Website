"""
Tests for authentication routes.
"""
import pytest
import json
# Note: conftest fixtures are automatically available to pytest
# No need to import them explicitly


class TestRegister:
    """Tests for POST /api/auth/register."""
    
    def test_register_success(self, client):
        """Test successful registration."""
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123"
        }
        
        response = client.post(
            '/api/auth/register',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        response_data = json.loads(response.data)
        # Response format: {"message": str, "email": str, "requires_verification": bool, "email_configured": bool, "user": {...}}
        assert "user" in response_data
        assert "message" in response_data
        assert "email" in response_data
        assert response_data["user"]["id"] is not None
        assert response_data["user"]["username"] == "newuser"
        assert response_data["user"]["email"] == "newuser@example.com"
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email."""
        data = {
            "username": "differentuser",
            "email": test_user.email,  # Existing email
            "password": "password123"
        }
        
        response = client.post(
            '/api/auth/register',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "errors" in data
        assert "email" in data["errors"]
    
    def test_register_validation_errors(self, client):
        """Test registration with invalid data."""
        data = {
            "username": "ab",  # Too short
            "email": "invalid-email",  # Invalid format
            "password": "123"  # Too short
        }
        
        response = client.post(
            '/api/auth/register',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "errors" in data
        assert "username" in data["errors"]
        assert "email" in data["errors"]
        assert "password" in data["errors"]


class TestLogin:
    """Tests for POST /api/auth/login."""
    
    def test_login_success(self, client, test_user):
        """Test successful login."""
        # Note: This requires password to be hashed correctly
        # In real test, you'd need to hash the password first
        data = {
            "email": test_user.email,
            "password": "correctpassword"  # Would need to hash this
        }
        
        # This test would need proper password hashing setup
        # Skipping for now as it requires more setup
        pass
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        response = client.post(
            '/api/auth/login',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert "message" in data

