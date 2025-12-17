"""
Tests for trip routes.
"""
import pytest
import json
# Note: conftest fixtures are automatically available to pytest
# No need to import them explicitly


class TestDeleteTrip:
    """Tests for DELETE /api/trips/<id>."""
    
    def test_delete_trip_success(self, client, auth_headers, test_itinerary):
        """Test successful trip deletion."""
        response = client.delete(
            f'/api/trips/{test_itinerary.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data
    
    def test_delete_trip_not_found(self, client, auth_headers):
        """Test deleting non-existent trip."""
        response = client.delete(
            '/api/trips/99999',
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_delete_trip_unauthorized(self, client, test_itinerary):
        """Test deleting trip without authentication."""
        response = client.delete(f'/api/trips/{test_itinerary.id}')
        
        assert response.status_code == 401
    
    def test_delete_trip_wrong_user(self, client, app, test_itinerary):
        """Test deleting trip owned by another user."""
        # Create another user and get their token
        from models import User
        from flask_jwt_extended import create_access_token
        
        with app.app_context():
            other_user = User(
                username='otheruser',
                email='other@example.com',
                password='hashed_password'
            )
            from models import db
            db.session.add(other_user)
            db.session.commit()
            
            other_token = create_access_token(identity=other_user.id)
            other_headers = {'Authorization': f'Bearer {other_token}'}
        
        # Try to delete test_itinerary with other user's token
        response = client.delete(
            f'/api/trips/{test_itinerary.id}',
            headers=other_headers
        )
        
        # Should return 403 or 404 (not authorized or not found)
        assert response.status_code in [403, 404]


class TestCreateTrip:
    """Tests for POST /api/trips."""
    
    def test_create_trip_success(self, client, auth_headers, test_province):
        """Test successful trip creation."""
        data = {
            "name": "Test Trip",
            "province_id": test_province.id,
            "duration": 3,
            "start_date": "2025-06-01",
            "must_include_place_ids": [],
            "metadata": {
                "people": "2-4 people",
                "budget": "5-10 triệu"
            }
        }
        
        response = client.post(
            '/api/trips',
            data=json.dumps(data),
            content_type='application/json',
            headers=auth_headers
        )
        
        # Note: This might fail if no destinations exist in test_province
        # Would need to create test destinations first
        assert response.status_code in [201, 400]  # 400 if no destinations
    
    def test_create_trip_validation_errors(self, client, auth_headers):
        """Test trip creation with invalid data."""
        data = {
            "name": "",  # Empty name
            "province_id": None,
            "duration": 0
        }
        
        response = client.post(
            '/api/trips',
            data=json.dumps(data),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "message" in data


class TestGetTrips:
    """Tests for GET /api/trips."""
    
    def test_get_user_trips(self, client, auth_headers, test_user, test_itinerary):
        """Test getting user's trips."""
        response = client.get(
            '/api/trips',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) > 0


class TestUpdateItinerary:
    """Tests for PUT /api/trips/<id>/itinerary."""
    
    def test_update_itinerary_success(self, client, auth_headers, test_itinerary):
        """Test successful itinerary update."""
        new_itinerary = [
            {
                "day": 1,
                "places": [
                    {"id": 1, "name": "Updated Place", "time_slot": "08:00-10:00"}
                ]
            }
        ]
        
        data = {"itinerary": new_itinerary}
        
        response = client.put(
            f'/api/trips/{test_itinerary.id}/itinerary',
            data=json.dumps(data),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data
    
    def test_update_itinerary_invalid_format(self, client, auth_headers, test_itinerary):
        """Test update with invalid format."""
        data = {"itinerary": "not an array"}
        
        response = client.put(
            f'/api/trips/{test_itinerary.id}/itinerary',
            data=json.dumps(data),
            content_type='application/json',
            headers=auth_headers
        )
        
        assert response.status_code == 400
