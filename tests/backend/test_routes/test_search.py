"""
Unit tests for Search routes
"""
import pytest
from flask import json
from unittest.mock import patch, MagicMock
from models import Destination, Province, Region, db


class TestSearchDestinations:
    """Tests for GET /api/search endpoint"""

    def test_search_destinations_success(self, client, test_destination):
        """Test searching destinations by query"""
        response = client.get('/api/search?q=Vịnh')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) > 0
        assert any('Vịnh' in item['name'] for item in data)

    def test_search_destinations_empty_query(self, client):
        """Test searching with empty query"""
        response = client.get('/api/search?q=')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)

    def test_search_destinations_no_results(self, client):
        """Test searching with no matching results"""
        response = client.get('/api/search?q=NonexistentPlace12345')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0


class TestRecommend:
    """Tests for POST /api/search/recommend endpoint"""

    @patch('routes.search.get_ai_recommendations')
    def test_recommend_success(self, mock_recommend, client):
        """Test getting AI recommendations"""
        mock_recommend.return_value = [
            {'name': 'Destination 1', 'reason': 'Great place'},
            {'name': 'Destination 2', 'reason': 'Amazing views'}
        ]
        
        data = {'preferences': 'beach, relaxing'}
        
        response = client.post('/api/search/recommend',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 2

    @patch('routes.search.get_ai_recommendations')
    def test_recommend_empty_result(self, mock_recommend, client):
        """Test recommendations with empty result"""
        mock_recommend.return_value = []
        
        data = {'preferences': 'unknown'}
        
        response = client.post('/api/search/recommend',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0


class TestSearchByText:
    """Tests for POST /api/search/text endpoint"""

    @patch('routes.search.chat_client')
    def test_search_by_text_success(self, mock_chat_client, client, auth_headers):
        """Test text-based search"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = '{"analysis": "Test", "suggestions": [{"name": "Hạ Long", "confidence": 0.8, "reason": "Beautiful"}], "trip_profile": {}}'
        
        data = {'query': 'Where should I visit in Vietnam?'}
        
        response = client.post('/api/search/text',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'analysis' in data
        assert 'suggestions' in data
        assert 'trip_profile' in data

    @patch('routes.search.chat_client')
    def test_search_by_text_missing_query(self, mock_chat_client, client, auth_headers):
        """Test text search without query"""
        mock_chat_client.is_ready.return_value = True
        
        data = {}
        
        response = client.post('/api/search/text',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    @patch('routes.search.chat_client')
    def test_search_by_text_not_ready(self, mock_chat_client, client, auth_headers):
        """Test text search when OpenAI is not configured"""
        mock_chat_client.is_ready.return_value = False
        
        data = {'query': 'Test query'}
        
        response = client.post('/api/search/text',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 500

    @patch('routes.search.chat_client')
    def test_search_by_text_invalid_json(self, mock_chat_client, client, auth_headers):
        """Test text search with invalid AI response"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = 'Invalid JSON response'
        
        data = {'query': 'Test query'}
        
        response = client.post('/api/search/text',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        # Should fallback to text search
        data = json.loads(response.data)
        assert 'suggestions' in data

    def test_search_by_text_unauthorized(self, client):
        """Test text search without authentication"""
        data = {'query': 'Test'}
        
        response = client.post('/api/search/text',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 401


class TestSearchByPhoto:
    """Tests for POST /api/search/vision endpoint"""

    @patch('routes.search.vision_client')
    def test_search_by_photo_success(self, mock_vision_client, client, auth_headers):
        """Test photo-based search"""
        mock_vision_client.is_ready.return_value = True
        mock_vision_client.describe_location_structured.return_value = {
            'summary': 'Beautiful beach scene',
            'predictions': [
                {'place': 'Nha Trang', 'confidence': 0.85, 'reason': 'Beach and clear water'}
            ],
            'suggestions': [
                {'name': 'Phú Quốc', 'confidence': 0.75, 'reason': 'Similar beach destination'}
            ]
        }
        
        data = {
            'images': [
                {'data_url': 'data:image/jpeg;base64,test123'}
            ]
        }
        
        response = client.post('/api/search/vision',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'summary' in data
        assert 'predictions' in data
        assert 'suggestions' in data

    @patch('routes.search.vision_client')
    def test_search_by_photo_missing_images(self, mock_vision_client, client, auth_headers):
        """Test photo search without images"""
        mock_vision_client.is_ready.return_value = True
        
        data = {'images': []}
        
        response = client.post('/api/search/vision',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    @patch('routes.search.vision_client')
    def test_search_by_photo_invalid_payload(self, mock_vision_client, client, auth_headers):
        """Test photo search with invalid image payload"""
        mock_vision_client.is_ready.return_value = True
        
        data = {'images': 'not a list'}
        
        response = client.post('/api/search/vision',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    @patch('routes.search.vision_client')
    def test_search_by_photo_not_ready(self, mock_vision_client, client, auth_headers):
        """Test photo search when vision service is not configured"""
        mock_vision_client.is_ready.return_value = False
        
        data = {
            'images': [{'data_url': 'data:image/jpeg;base64,test'}]
        }
        
        response = client.post('/api/search/vision',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 500

    @patch('routes.search.vision_client')
    def test_search_by_photo_multiple_images(self, mock_vision_client, client, auth_headers):
        """Test photo search with multiple images"""
        mock_vision_client.is_ready.return_value = True
        mock_vision_client.describe_location_structured.return_value = {
            'summary': 'Multiple beach scenes',
            'predictions': [],
            'suggestions': []
        }
        
        data = {
            'images': [
                {'data_url': 'data:image/jpeg;base64,test1'},
                {'data_url': 'data:image/jpeg;base64,test2'},
                {'data_url': 'data:image/jpeg;base64,test3'},
                {'data_url': 'data:image/jpeg;base64,test4'},
                {'data_url': 'data:image/jpeg;base64,test5'}  # Should limit to 4
            ]
        }
        
        response = client.post('/api/search/vision',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        # Should only process MAX_VISION_IMAGES (4)
        assert mock_vision_client.describe_location_structured.call_count == 1

    def test_search_by_photo_unauthorized(self, client):
        """Test photo search without authentication"""
        data = {'images': [{'data_url': 'data:image/jpeg;base64,test'}]}
        
        response = client.post('/api/search/vision',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 401

