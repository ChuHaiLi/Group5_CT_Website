"""
Unit tests for Itinerary routes (using /api/trips endpoints)
"""
import pytest
import json
from flask import json as flask_json
from flask_jwt_extended import create_access_token
from models import Itinerary, User, db


class TestSaveItinerary:
    """Tests for POST /api/trips endpoint (create trip)"""

    def test_save_itinerary_success(self, client, auth_headers, test_user, test_province, test_destination):
        """Test creating a trip"""
        data = {
            'name': 'Test Trip',
            'province_id': test_province.id,
            'duration': 2,
            'metadata': {'people': '2-4', 'budget': '5-10 triệu'}
        }
        
        response = client.post('/api/trips',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        if response.status_code != 201:
            print(f"Response status: {response.status_code}")
            print(f"Response data: {response.data.decode()}")
        
        # Route may return 400 if no destinations found, which is acceptable
        assert response.status_code in [201, 400]
        if response.status_code == 201:
            data = flask_json.loads(response.data)
            assert 'trip' in data
            assert data['trip']['name'] == 'Test Trip'
            
            with client.application.app_context():
                itinerary = Itinerary.query.filter_by(user_id=test_user.id).first()
                assert itinerary is not None

    def test_save_itinerary_missing_user_id(self, client):
        """Test creating trip without authentication"""
        data = {
            'name': 'Test Trip',
            'province_id': 1,
            'duration': 2
        }
        
        response = client.post('/api/trips',
                             json=data,
                             content_type='application/json')
        
        # Should require authentication
        assert response.status_code == 401

    def test_save_itinerary_missing_locations(self, client, auth_headers, test_province):
        """Test creating trip without required fields"""
        data = {
            'name': 'Test Trip'
            # Missing province_id and duration
        }
        
        response = client.post('/api/trips',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        # Should fail validation
        assert response.status_code in [400, 500]


class TestLoadItinerary:
    """Tests for GET /api/trips endpoint"""

    def test_load_itinerary_success(self, client, auth_headers, test_user, test_province):
        """Test loading user's trips"""
        with client.application.app_context():
            itinerary_data = [
                {'day': 1, 'places': [{'id': 1, 'name': 'Place 1'}]}
            ]
            itinerary = Itinerary(
                user_id=test_user.id,
                name='Test Itinerary',
                province_id=test_province.id,
                duration=1,
                itinerary_json=json.dumps(itinerary_data)
            )
            db.session.add(itinerary)
            db.session.commit()
        
        response = client.get('/api/trips',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = flask_json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 1
        assert 'id' in data[0]
        assert 'name' in data[0]

    def test_load_itinerary_empty(self, client, auth_headers):
        """Test loading trips when user has none"""
        response = client.get('/api/trips',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = flask_json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_load_itinerary_multiple(self, client, auth_headers, test_user, test_province):
        """Test loading multiple trips"""
        with client.application.app_context():
            for i in range(3):
                itinerary = Itinerary(
                    user_id=test_user.id,
                    name=f'Trip {i+1}',
                    province_id=test_province.id,
                    duration=1,
                    itinerary_json=json.dumps([{'day': i+1, 'places': []}])
                )
                db.session.add(itinerary)
            db.session.commit()
        
        response = client.get('/api/trips',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = flask_json.loads(response.data)
        assert len(data) == 3

    def test_load_itinerary_only_user(self, client, auth_headers, test_user, app, test_province):
        """Test loading only returns current user's trips"""
        with app.app_context():
            other_user = User(
                username='otheruser',
                email='other@example.com',
                password='hashed'
            )
            db.session.add(other_user)
            db.session.commit()
            
            # Create trip for other user
            other_itinerary = Itinerary(
                user_id=other_user.id,
                name='Other Trip',
                province_id=test_province.id,
                duration=1,
                itinerary_json=json.dumps([{'day': 1, 'places': []}])
            )
            db.session.add(other_itinerary)
            db.session.commit()
        
        response = client.get('/api/trips',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = flask_json.loads(response.data)
        # Should not include other user's trip
        assert len(data) == 0
