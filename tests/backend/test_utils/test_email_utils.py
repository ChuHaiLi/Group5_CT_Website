"""
Tests for email utilities.
"""
import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add backend to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
sys.path.insert(0, backend_path)

from utils.email_utils import send_email, generate_otp


class TestSendEmail:
    """Tests for send_email function."""
    
    @patch('utils.email_utils.os.getenv')
    @patch('utils.email_utils.smtplib.SMTP')
    def test_send_email_success(self, mock_smtp, mock_getenv):
        """Test successful email sending."""
        # Mock environment variables
        mock_getenv.side_effect = lambda key: {
            'EMAIL_USER': 'test@gmail.com',
            'EMAIL_PASSWORD': 'test_password'
        }.get(key)
        
        # Mock SMTP
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        
        result = send_email('recipient@example.com', 'Test Subject', '<h1>Test</h1>')
        
        # send_email returns a dict, not bool
        assert isinstance(result, dict)
        assert result["success"] is True
        assert result["email_configured"] is True
        assert "message" in result
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with('test@gmail.com', 'test_password')
        mock_server.send_message.assert_called_once()
    
    @patch('utils.email_utils.os.getenv')
    def test_no_email_credentials(self, mock_getenv):
        """Test when EMAIL_USER or EMAIL_PASSWORD not configured."""
        mock_getenv.return_value = None
        
        result = send_email('recipient@example.com', 'Test Subject', '<h1>Test</h1>')
        
        # send_email returns a dict
        assert isinstance(result, dict)
        assert result["success"] is True
        assert result["email_configured"] is False
        assert "message" in result
    
    @patch('utils.email_utils.os.getenv')
    @patch('utils.email_utils.smtplib.SMTP')
    def test_smtp_error_handling(self, mock_smtp, mock_getenv):
        """Test error handling when SMTP fails."""
        mock_getenv.side_effect = lambda key: {
            'EMAIL_USER': 'test@gmail.com',
            'EMAIL_PASSWORD': 'test_password'
        }.get(key)
        
        # Mock SMTP to raise exception
        mock_smtp.side_effect = Exception("SMTP connection failed")
        
        result = send_email('recipient@example.com', 'Test Subject', '<h1>Test</h1>')
        
        # send_email returns a dict
        assert isinstance(result, dict)
        assert result["success"] is False
        assert result["email_configured"] is True
        assert "message" in result
        assert "SMTP connection failed" in result["message"]
    
    @patch('utils.email_utils.os.getenv')
    @patch('utils.email_utils.smtplib.SMTP')
    def test_email_message_format(self, mock_smtp, mock_getenv):
        """Test email message format."""
        mock_getenv.side_effect = lambda key: {
            'EMAIL_USER': 'test@gmail.com',
            'EMAIL_PASSWORD': 'test_password'
        }.get(key)
        
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        
        send_email('recipient@example.com', 'Test Subject', '<h1>Test Content</h1>')
        
        # Verify send_message was called
        assert mock_server.send_message.called
        sent_message = mock_server.send_message.call_args[0][0]
        
        assert sent_message['From'] == 'test@gmail.com'
        assert sent_message['To'] == 'recipient@example.com'
        assert sent_message['Subject'] == 'Test Subject'


class TestGenerateOtp:
    """Tests for generate_otp function."""
    
    def test_default_length(self):
        """Test OTP with default length (6)."""
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()
    
    def test_custom_length(self):
        """Test OTP with custom length."""
        otp = generate_otp(4)
        assert len(otp) == 4
        assert otp.isdigit()
    
    def test_randomness(self):
        """Test that OTPs are random."""
        otps = [generate_otp() for _ in range(10)]
        assert len(set(otps)) > 1
    
    def test_only_digits(self):
        """Test that OTP contains only digits."""
        otp = generate_otp(10)
        assert all(c in '0123456789' for c in otp)

