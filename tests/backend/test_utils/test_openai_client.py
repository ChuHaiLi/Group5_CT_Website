"""
Unit tests for OpenAI Client utility
"""
import pytest
import os
from unittest.mock import patch, MagicMock, Mock
from utils.openai_client import OpenAIChatClient


class TestOpenAIChatClient:
    """Tests for OpenAIChatClient class"""

    def test_is_ready_with_api_key(self):
        """Test is_ready returns True when API key is set"""
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            with patch('utils.openai_client.OpenAI'):
                client = OpenAIChatClient()
                assert client.is_ready() is True

    def test_is_ready_without_api_key(self):
        """Test is_ready returns False when API key is missing"""
        with patch.dict(os.environ, {}, clear=True):
            client = OpenAIChatClient()
            assert client.is_ready() is False

    @patch('utils.openai_client.OpenAI')
    def test_generate_reply_success(self, mock_openai_class):
        """Test generating reply successfully"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Test AI response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            client = OpenAIChatClient()
            messages = [{'role': 'user', 'content': 'Hello'}]
            
            result = client.generate_reply(messages)
            
            assert result == "Test AI response"
            mock_client.chat.completions.create.assert_called_once()

    @patch('utils.openai_client.OpenAI')
    def test_generate_reply_without_api_key(self, mock_openai_class):
        """Test generate_reply raises error without API key"""
        with patch.dict(os.environ, {}, clear=True):
            client = OpenAIChatClient()
            messages = [{'role': 'user', 'content': 'Hello'}]
            
            with pytest.raises(RuntimeError) as exc_info:
                client.generate_reply(messages)
            
            assert 'OPENAI_API_KEY' in str(exc_info.value)

    @patch('utils.openai_client.OpenAI')
    @patch('utils.openai_client.get_shared_openai_limiter')
    def test_generate_reply_uses_rate_limiter(self, mock_limiter, mock_openai_class):
        """Test that generate_reply uses rate limiter"""
        mock_limiter_instance = MagicMock()
        mock_limiter.return_value = mock_limiter_instance
        
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            client = OpenAIChatClient()
            messages = [{'role': 'user', 'content': 'Hello'}]
            
            client.generate_reply(messages)
            
            mock_limiter_instance.acquire.assert_called()

    @patch('utils.openai_client.OpenAI')
    def test_generate_multimodal_reply_success(self, mock_openai_class):
        """Test generating multimodal reply with images"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Image analysis response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            client = OpenAIChatClient()
            image_urls = ['data:image/jpeg;base64,test123']
            
            result = client.generate_multimodal_reply(
                system_prompt="Analyze this image",
                user_prompt="What is this?",
                image_data_urls=image_urls
            )
            
            assert result == "Image analysis response"
            call_args = mock_client.chat.completions.create.call_args
            assert call_args is not None
            messages = call_args[1]['messages']
            assert len(messages) == 2
            assert messages[1]['role'] == 'user'
            assert len(messages[1]['content']) > 1  # Should have text + image

    @patch('utils.openai_client.OpenAI')
    def test_generate_multimodal_reply_filters_empty_urls(self, mock_openai_class):
        """Test multimodal reply filters empty image URLs"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            client = OpenAIChatClient()
            image_urls = ['data:image/jpeg;base64,test123', '', None, 'data:image/jpeg;base64,test456']
            
            client.generate_multimodal_reply(
                system_prompt="Test",
                user_prompt="Test",
                image_data_urls=image_urls
            )
            
            call_args = mock_client.chat.completions.create.call_args
            messages = call_args[1]['messages']
            user_content = messages[1]['content']
            # Should only have 2 images (non-empty ones)
            image_count = sum(1 for item in user_content if item.get('type') == 'image_url')
            assert image_count == 2

