"""
Tests for destination routes.
"""
import pytest
import json


class TestGetDestinationDetails:
    """Tests for GET /api/destinations/<id>."""
    
    def test_get_destination_success(self, client, auth_headers, test_destination):
        """Test getting destination details."""
        response = client.get(
            f'/api/destinations/{test_destination.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["id"] == test_destination.id
        assert "name" in data
        assert "description" in data or "images" in data
    
    def test_get_destination_not_found(self, client, auth_headers):
        """Test getting non-existent destination."""
        response = client.get(
            '/api/destinations/99999',
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert "message" in data
    
    def test_get_destination_unauthorized(self, client):
        """Test getting destination without authentication."""
        response = client.get('/api/destinations/1')
        
        assert response.status_code == 401


class TestGetDestinationsByProvince:
    """Tests for GET /api/destinations/by-province/<province_id>."""
    
    def test_get_destinations_by_province_success(self, client, auth_headers, test_province, test_destination):
        """Test getting destinations by province."""
        response = client.get(
            f'/api/destinations/by-province/{test_province.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
    
    def test_get_destinations_by_province_not_found(self, client, auth_headers):
        """Test getting destinations for non-existent province."""
        response = client.get(
            '/api/destinations/by-province/99999',
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert "message" in data
    
    def test_get_destinations_by_province_unauthorized(self, client):
        """Test getting destinations without authentication."""
        response = client.get('/api/destinations/by-province/1')
        
        assert response.status_code == 401

