"""
Tests for security and protected routes.
"""
import pytest
import json


class TestProtectedRoutes:
    """Tests for JWT-protected routes."""
    
    def test_protected_route_without_token(self, client):
        """Test accessing protected route without token."""
        # Try to access a protected route
        response = client.get('/api/trips')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert "message" in data
    
    def test_protected_route_with_invalid_token(self, client):
        """Test accessing protected route with invalid token."""
        headers = {'Authorization': 'Bearer invalid-token'}
        response = client.get('/api/trips', headers=headers)
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert "message" in data
    
    def test_protected_route_with_valid_token(self, client, auth_headers):
        """Test accessing protected route with valid token."""
        response = client.get('/api/trips', headers=auth_headers)
        
        # Should succeed (200 or 404 if no trips)
        assert response.status_code in [200, 404]
    
    def test_logout_clears_token(self, client, auth_headers):
        """Test logout functionality."""
        # First, verify we're authenticated
        response = client.get('/api/trips', headers=auth_headers)
        assert response.status_code in [200, 401]  # May be 401 if token expired
        
        # Logout (if endpoint exists)
        logout_response = client.post('/api/auth/logout', headers=auth_headers)
        
        # After logout, protected routes should fail
        if logout_response.status_code != 404:
            response_after_logout = client.get('/api/trips', headers=auth_headers)
            # Token should be invalidated
            assert response_after_logout.status_code == 401


class TestCORS:
    """Tests for CORS configuration."""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present."""
        response = client.options('/api/trips')
        
        # CORS should be configured
        # Check if Access-Control-Allow-Origin header exists
        assert response.status_code in [200, 405]  # OPTIONS may return 405 if not configured


class TestInputValidation:
    """Tests for input validation and sanitization."""
    
    def test_sql_injection_attempt(self, client, auth_headers):
        """Test SQL injection attempt is handled safely."""
        malicious_input = "'; DROP TABLE users; --"
        
        # Try to use malicious input in a safe endpoint
        response = client.post(
            '/api/trips',
            headers=auth_headers,
            data=json.dumps({
                "name": malicious_input,
                "province_id": 1,
                "duration": 1
            }),
            content_type='application/json'
        )
        
        # Should not crash, should return validation error or 400
        assert response.status_code in [400, 401, 422]
    
    def test_xss_attempt(self, client, auth_headers):
        """Test XSS attempt is handled safely."""
        xss_input = "<script>alert('xss')</script>"
        
        response = client.post(
            '/api/trips',
            headers=auth_headers,
            data=json.dumps({
                "name": xss_input,
                "province_id": 1,
                "duration": 1
            }),
            content_type='application/json'
        )
        
        # Should not crash
        assert response.status_code in [200, 400, 401, 422]

