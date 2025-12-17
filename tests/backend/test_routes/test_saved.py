"""
Unit tests for Saved Destinations routes
"""
import pytest
from flask import json
from models import SavedDestination, Destination, Province, Region, User, db


class TestSaveDestination:
    """Tests for POST /api/saved/add endpoint"""

    def test_save_destination_success(self, client, auth_headers, test_user, test_destination):
        """Test saving a destination"""
        data = {'destination_id': test_destination.id}
        
        response = client.post('/api/saved/add',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'Saved successfully'
        
        with client.application.app_context():
            saved = SavedDestination.query.filter_by(
                user_id=test_user.id,
                destination_id=test_destination.id
            ).first()
            assert saved is not None

    def test_save_destination_already_saved(self, client, auth_headers, test_user, test_destination):
        """Test saving a destination that's already saved"""
        with client.application.app_context():
            saved = SavedDestination(
                user_id=test_user.id,
                destination_id=test_destination.id
            )
            db.session.add(saved)
            db.session.commit()
        
        data = {'destination_id': test_destination.id}
        
        response = client.post('/api/saved/add',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Already saved'

    def test_save_destination_missing_id(self, client, auth_headers):
        """Test saving destination without destination_id"""
        data = {}
        
        response = client.post('/api/saved/add',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    def test_save_destination_unauthorized(self, client, test_destination):
        """Test saving destination without authentication"""
        data = {'destination_id': test_destination.id}
        
        response = client.post('/api/saved/add',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 401


class TestRemoveSaved:
    """Tests for DELETE /api/saved/remove endpoint"""

    def test_remove_saved_success(self, client, auth_headers, test_user, test_destination):
        """Test removing a saved destination"""
        with client.application.app_context():
            saved = SavedDestination(
                user_id=test_user.id,
                destination_id=test_destination.id
            )
            db.session.add(saved)
            db.session.commit()
        
        data = {'destination_id': test_destination.id}
        
        response = client.delete('/api/saved/remove',
                               json=data,
                               headers=auth_headers,
                               content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Removed from saved list'
        
        with client.application.app_context():
            saved = SavedDestination.query.filter_by(
                user_id=test_user.id,
                destination_id=test_destination.id
            ).first()
            assert saved is None

    def test_remove_saved_not_found(self, client, auth_headers, test_destination):
        """Test removing a destination that's not saved"""
        data = {'destination_id': test_destination.id}
        
        response = client.delete('/api/saved/remove',
                               json=data,
                               headers=auth_headers,
                               content_type='application/json')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['message'] == 'Not in saved list'

    def test_remove_saved_unauthorized(self, client, test_destination):
        """Test removing saved destination without authentication"""
        data = {'destination_id': test_destination.id}
        
        response = client.delete('/api/saved/remove',
                               json=data,
                               content_type='application/json')
        
        assert response.status_code == 401


class TestGetSavedList:
    """Tests for GET /api/saved/list endpoint"""

    def test_get_saved_list_empty(self, client, auth_headers):
        """Test getting saved list when empty"""
        response = client.get('/api/saved/list',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_saved_list_with_items(self, client, auth_headers, test_user, test_destination, test_province):
        """Test getting saved list with items"""
        with client.application.app_context():
            saved = SavedDestination(
                user_id=test_user.id,
                destination_id=test_destination.id
            )
            db.session.add(saved)
            db.session.commit()
        
        response = client.get('/api/saved/list',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]['id'] == test_destination.id
        assert data[0]['name'] == test_destination.name

    def test_get_saved_list_includes_weather(self, client, auth_headers, test_user, test_destination, test_province):
        """Test saved list includes weather information"""
        with client.application.app_context():
            # Ensure province has region
            if not test_province.region_id:
                region = Region(name='Miền Bắc')
                db.session.add(region)
                db.session.commit()
                test_province.region_id = region.id
                db.session.commit()
            
            saved = SavedDestination(
                user_id=test_user.id,
                destination_id=test_destination.id
            )
            db.session.add(saved)
            db.session.commit()
        
        response = client.get('/api/saved/list',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) > 0
        assert 'weather' in data[0]
        assert '°C' in data[0]['weather']  # Weather format check

    def test_get_saved_list_includes_all_fields(self, client, auth_headers, test_user, test_destination, test_province):
        """Test saved list includes all required fields"""
        with client.application.app_context():
            saved = SavedDestination(
                user_id=test_user.id,
                destination_id=test_destination.id
            )
            db.session.add(saved)
            db.session.commit()
        
        response = client.get('/api/saved/list',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) > 0
        item = data[0]
        
        # Check all required fields
        required_fields = [
            'id', 'name', 'province_name', 'region_name',
            'description', 'latitude', 'longitude', 'rating',
            'category', 'tags', 'weather', 'images'
        ]
        for field in required_fields:
            assert field in item

    def test_get_saved_list_unauthorized(self, client):
        """Test getting saved list without authentication"""
        response = client.get('/api/saved/list')
        assert response.status_code == 401

    def test_get_saved_list_only_user_saved(self, client, auth_headers, test_user, test_destination, app):
        """Test saved list only returns current user's saved items"""
        with app.app_context():
            # Create another user
            other_user = User(
                username='otheruser',
                email='other@example.com',
                password='hashed'
            )
            db.session.add(other_user)
            db.session.commit()
            
            # Create saved item for other user
            other_saved = SavedDestination(
                user_id=other_user.id,
                destination_id=test_destination.id
            )
            db.session.add(other_saved)
            db.session.commit()
        
        response = client.get('/api/saved/list',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        # Should be empty since test_user hasn't saved anything
        assert len(data) == 0

