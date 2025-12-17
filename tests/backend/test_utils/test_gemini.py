"""
Unit tests for Gemini utility functions
"""
import pytest
from utils.gemini import get_ai_recommendations


class TestGetAIRecommendations:
    """Tests for get_ai_recommendations function"""

    def test_get_ai_recommendations_returns_list(self):
        """Test that function returns a list"""
        user_input = {
            'budget': '5-10 triệu',
            'duration': 3,
            'interests': ['beach', 'relaxing']
        }
        
        result = get_ai_recommendations(user_input)
        
        assert isinstance(result, list)
        assert len(result) > 0

    def test_get_ai_recommendations_has_required_fields(self):
        """Test that recommendations have required fields"""
        user_input = {
            'budget': '5-10 triệu',
            'duration': 3,
            'interests': ['beach']
        }
        
        result = get_ai_recommendations(user_input)
        
        assert len(result) > 0
        for item in result:
            assert 'id' in item
            assert 'name' in item
            assert 'description' in item
            assert 'image_url' in item

    def test_get_ai_recommendations_with_empty_input(self):
        """Test function with empty input"""
        user_input = {}
        
        result = get_ai_recommendations(user_input)
        
        assert isinstance(result, list)
        assert len(result) > 0

    def test_get_ai_recommendations_returns_consistent_format(self):
        """Test that function returns consistent format"""
        user_input = {
            'budget': '10-20 triệu',
            'duration': 5,
            'interests': ['adventure', 'mountain']
        }
        
        result = get_ai_recommendations(user_input)
        
        # Should return demo data
        assert len(result) == 2
        assert result[0]['name'] == 'Beach Paradise'
        assert result[1]['name'] == 'Mountain Trek'

