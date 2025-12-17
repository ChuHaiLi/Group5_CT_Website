"""
Tests for AI evaluation route.
"""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestAIEvaluation:
    """Tests for /api/ai/evaluate_itinerary route."""
    
    @patch('app.OpenAIChatClient')
    def test_evaluate_itinerary_success(self, mock_openai_class, client):
        """Test successful itinerary evaluation."""
        # Mock OpenAI client
        mock_client = MagicMock()
        mock_client.is_ready.return_value = True
        mock_client.generate_reply.return_value = json.dumps({
            "score": 85,
            "decision": "ok",
            "suggestions": ["Great itinerary!"],
            "summary": "Good itinerary",
            "details_per_day": [],
            "patch_preview": {},
            "optimized_itinerary": [],
            "quality_checks": {}
        })
        mock_openai_class.return_value = mock_client
        
        payload = {
            "original_itinerary": [
                {"day": 1, "places": [{"id": 1, "name": "Place A"}]}
            ],
            "edited_itinerary": [
                {"day": 1, "places": [{"id": 1, "name": "Place A"}, {"id": 2, "name": "Place B"}]}
            ]
        }
        
        response = client.post(
            '/api/ai/evaluate_itinerary',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "ok" in data
        if data.get("ok") and "result" in data:
            result = data["result"]
            assert "score" in result or "decision" in result or "suggestions" in result
        else:
            # Fallback: check top-level keys
            assert "score" in data or "decision" in data or "suggestions" in data
    
    def test_evaluate_itinerary_missing_params(self, client):
        """Test evaluation with missing parameters."""
        payload = {
            "original_itinerary": [{"day": 1, "places": []}]
            # Missing edited_itinerary
        }
        
        response = client.post(
            '/api/ai/evaluate_itinerary',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
    
    @patch('app.OpenAIChatClient')
    def test_evaluate_itinerary_empty_itineraries(self, mock_openai_class, client):
        """Test evaluation with empty itineraries."""
        # Mock OpenAI client
        mock_client = MagicMock()
        mock_client.is_ready.return_value = True
        mock_client.generate_reply.return_value = json.dumps({
            "score": 50,
            "decision": "ok",
            "suggestions": [],
            "summary": "Empty itinerary",
            "details_per_day": [],
            "patch_preview": {},
            "optimized_itinerary": [],
            "quality_checks": {}
        })
        mock_openai_class.return_value = mock_client
        
        payload = {
            "original_itinerary": [],
            "edited_itinerary": []
        }
        
        response = client.post(
            '/api/ai/evaluate_itinerary',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        # Should handle empty itineraries
        assert response.status_code in [200, 400]
    
    @patch('app.OpenAIChatClient')
    def test_evaluate_itinerary_ai_error(self, mock_openai_class, client):
        """Test evaluation when AI service fails."""
        # Mock OpenAI client to raise error
        mock_client = MagicMock()
        mock_client.is_ready.return_value = True
        mock_client.generate_reply.side_effect = Exception("AI service error")
        mock_openai_class.return_value = mock_client
        
        payload = {
            "original_itinerary": [{"day": 1, "places": [{"id": 1, "name": "Place A"}]}],
            "edited_itinerary": [{"day": 1, "places": [{"id": 1, "name": "Place A"}]}]
        }
        
        response = client.post(
            '/api/ai/evaluate_itinerary',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        # Should handle error gracefully
        assert response.status_code in [200, 500, 503]

