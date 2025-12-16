"""
Unit tests for OpenAI Rate Limiter
"""
import pytest
import time
from unittest.mock import patch
from utils.openai_rate_limiter import SimpleRateLimiter, get_shared_openai_limiter


class TestSimpleRateLimiter:
    """Tests for SimpleRateLimiter class"""

    def test_init_valid_params(self):
        """Test initializing with valid parameters"""
        limiter = SimpleRateLimiter(max_calls=5, window_seconds=60.0)
        assert limiter.max_calls == 5
        assert limiter.window_seconds == 60.0

    def test_init_invalid_max_calls(self):
        """Test initializing with invalid max_calls"""
        with pytest.raises(ValueError) as exc_info:
            SimpleRateLimiter(max_calls=0, window_seconds=60.0)
        assert "max_calls must be positive" in str(exc_info.value)

    def test_init_invalid_window_seconds(self):
        """Test initializing with invalid window_seconds"""
        with pytest.raises(ValueError) as exc_info:
            SimpleRateLimiter(max_calls=5, window_seconds=0)
        assert "window_seconds must be positive" in str(exc_info.value)

    def test_acquire_allows_calls_within_limit(self):
        """Test acquire allows calls within the limit"""
        limiter = SimpleRateLimiter(max_calls=3, window_seconds=1.0)
        
        # Should allow 3 calls immediately
        limiter.acquire()
        limiter.acquire()
        limiter.acquire()
        
        # All should succeed without blocking

    def test_acquire_blocks_when_limit_exceeded(self):
        """Test acquire blocks when limit is exceeded"""
        limiter = SimpleRateLimiter(max_calls=2, window_seconds=1.0)
        
        # Use up the limit
        limiter.acquire()
        limiter.acquire()
        
        # Third call should block (we can't easily test blocking, but we can verify it doesn't raise)
        start_time = time.time()
        limiter.acquire()  # Should wait
        elapsed = time.time() - start_time
        
        # Should have waited at least a small amount
        assert elapsed >= 0.05  # Minimum sleep time

    def test_acquire_clears_old_timestamps(self):
        """Test that old timestamps are cleared from window"""
        limiter = SimpleRateLimiter(max_calls=2, window_seconds=0.1)  # Very short window
        
        # Use up the limit
        limiter.acquire()
        limiter.acquire()
        
        # Wait for window to expire
        time.sleep(0.15)
        
        # Should be able to acquire again
        start_time = time.time()
        limiter.acquire()
        elapsed = time.time() - start_time
        
        # Should not have waited long (window expired)
        assert elapsed < 0.1


class TestGetSharedOpenAILimiter:
    """Tests for get_shared_openai_limiter function"""

    def test_get_shared_limiter_returns_singleton(self):
        """Test that function returns the same instance"""
        limiter1 = get_shared_openai_limiter()
        limiter2 = get_shared_openai_limiter()
        
        assert limiter1 is limiter2

    @patch.dict('os.environ', {'OPENAI_RPM_LIMIT': '10', 'OPENAI_RPM_WINDOW': '120'})
    def test_get_shared_limiter_uses_env_vars(self):
        """Test that limiter uses environment variables"""
        # Reset the global limiter
        import utils.openai_rate_limiter
        utils.openai_rate_limiter._shared_limiter = None
        
        limiter = get_shared_openai_limiter()
        
        assert limiter.max_calls == 10
        assert limiter.window_seconds == 120.0

    @patch.dict('os.environ', {}, clear=True)
    def test_get_shared_limiter_defaults(self):
        """Test that limiter uses defaults when env vars not set"""
        # Reset the global limiter
        import utils.openai_rate_limiter
        utils.openai_rate_limiter._shared_limiter = None
        
        limiter = get_shared_openai_limiter()
        
        assert limiter.max_calls == 3  # Default from code
        assert limiter.window_seconds == 60.0  # Default from code

