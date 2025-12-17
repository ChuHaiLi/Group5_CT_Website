"""
Unit tests for Image Recognition utility
"""
import pytest
import os
from unittest.mock import patch, MagicMock
from utils.image_recognition import OpenAIImageRecognizer


class TestOpenAIImageRecognizer:
    """Tests for OpenAIImageRecognizer class"""

    def test_is_ready_with_api_key(self):
        """Test is_ready returns True when API key is set"""
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            with patch('utils.image_recognition.OpenAI'):
                recognizer = OpenAIImageRecognizer()
                assert recognizer.is_ready() is True

    def test_is_ready_without_api_key(self):
        """Test is_ready returns False when API key is missing"""
        with patch.dict(os.environ, {}, clear=True):
            recognizer = OpenAIImageRecognizer()
            assert recognizer.is_ready() is False

    @patch('utils.image_recognition.OpenAI')
    def test_describe_location_text_success(self, mock_openai_class):
        """Test describing location from text"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Beautiful beach scene in Nha Trang"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            image_urls = ['data:image/jpeg;base64,test123']
            
            result = recognizer.describe_location_text(
                user_prompt="What is this place?",
                image_data_urls=image_urls
            )
            
            assert "Nha Trang" in result
            mock_client.chat.completions.create.assert_called_once()

    @patch('utils.image_recognition.OpenAI')
    def test_describe_location_text_requires_images(self, mock_openai_class):
        """Test describe_location_text raises error without images"""
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            
            with pytest.raises(ValueError) as exc_info:
                recognizer.describe_location_text(
                    user_prompt="Test",
                    image_data_urls=[]
                )
            
            assert "At least one image is required" in str(exc_info.value)

    @patch('utils.image_recognition.OpenAI')
    def test_describe_location_structured_success(self, mock_openai_class):
        """Test describing location with structured output"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"summary": "Beach scene", "predictions": [{"place": "Nha Trang", "confidence": 0.85, "reason": "Clear water"}], "suggestions": []}'
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            image_urls = ['data:image/jpeg;base64,test123']
            
            result = recognizer.describe_location_structured(
                user_prompt="Identify this place",
                image_data_urls=image_urls
            )
            
            assert 'summary' in result
            assert 'predictions' in result
            assert 'suggestions' in result
            assert result['predictions'][0]['place'] == 'Nha Trang'

    @patch('utils.image_recognition.OpenAI')
    def test_describe_location_structured_invalid_json(self, mock_openai_class):
        """Test describe_location_structured handles invalid JSON"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Invalid JSON response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            image_urls = ['data:image/jpeg;base64,test123']
            
            with pytest.raises(RuntimeError) as exc_info:
                recognizer.describe_location_structured(
                    user_prompt="Test",
                    image_data_urls=image_urls
                )
            
            assert 'không hợp lệ' in str(exc_info.value) or 'invalid' in str(exc_info.value).lower()

    @patch('utils.image_recognition.OpenAI')
    def test_describe_location_structured_with_context(self, mock_openai_class):
        """Test structured description includes destination context"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"summary": "Test", "predictions": [], "suggestions": []}'
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            image_urls = ['data:image/jpeg;base64,test123']
            context = "Destination list: Nha Trang, Phú Quốc"
            
            recognizer.describe_location_structured(
                user_prompt="Test",
                image_data_urls=image_urls,
                destination_context=context
            )
            
            call_args = mock_client.chat.completions.create.call_args
            system_prompt = call_args[1]['messages'][0]['content']
            assert context in system_prompt

    @patch('utils.image_recognition.OpenAI')
    @patch('utils.image_recognition.get_shared_openai_limiter')
    def test_describe_location_uses_rate_limiter(self, mock_limiter, mock_openai_class):
        """Test that describe_location uses rate limiter"""
        mock_limiter_instance = MagicMock()
        mock_limiter.return_value = mock_limiter_instance
        
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"summary": "Test", "predictions": [], "suggestions": []}'
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            recognizer = OpenAIImageRecognizer()
            image_urls = ['data:image/jpeg;base64,test123']
            
            recognizer.describe_location_structured(
                user_prompt="Test",
                image_data_urls=image_urls
            )
            
            mock_limiter_instance.acquire.assert_called()

