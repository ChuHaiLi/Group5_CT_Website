"""
Tests for utility functions in app.py
"""
import pytest
import sys
import os
import json
import math
from unittest.mock import patch, MagicMock

# Add backend to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Mock environment loader and dotenv before importing app
# This prevents errors when app.py tries to load .env files
with patch('utils.env_loader.load_backend_env', MagicMock()):
    with patch('dotenv.load_dotenv', MagicMock()):
        # Import functions from app
        from app import (
            is_valid_email,
            generate_random_weather,
            decode_db_json_string,
            haversine_distance,
            estimate_travel_time_km,
            generate_otp,
            get_province_name_by_id
        )


class TestIsValidEmail:
    """Tests for is_valid_email function."""
    
    def test_valid_emails(self):
        """Test valid email formats."""
        valid_emails = [
            "user@example.com",
            "test.user@domain.co.uk",
            "user+tag@example.com",
            "user123@test-domain.com"
        ]
        for email in valid_emails:
            assert is_valid_email(email) is not None
    
    def test_invalid_emails(self):
        """Test invalid email formats."""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user@.com",
            "user@domain"
        ]
        for email in invalid_emails:
            assert is_valid_email(email) is None
    
    def test_edge_cases(self):
        """Test edge cases."""
        # is_valid_email doesn't handle None, it will raise TypeError
        # So we test that it raises TypeError for None
        import pytest
        with pytest.raises(TypeError):
            is_valid_email(None)
        
        # Empty string returns None (no match)
        assert is_valid_email("") is None
        # Whitespace returns None (no match)
        assert is_valid_email("   ") is None


class TestGenerateRandomWeather:
    """Tests for generate_random_weather function."""
    
    def test_mien_bac_weather(self):
        """Test weather generation for Miền Bắc."""
        weather = generate_random_weather("Miền Bắc")
        
        # Check format: "WeatherType Temperature°C"
        assert "°C" in weather
        
        # Extract temperature
        temp_str = weather.split()[-1].replace("°C", "")
        temp = int(temp_str)
        
        # Check temperature range [15, 35]
        assert 15 <= temp <= 35
        
        # Check weather type
        weather_type = weather.split()[0]
        assert weather_type in ["Sunny", "Cloudy", "Rainy"]
    
    def test_mien_trung_weather(self):
        """Test weather generation for Miền Trung."""
        weather = generate_random_weather("Miền Trung")
        temp_str = weather.split()[-1].replace("°C", "")
        temp = int(temp_str)
        
        assert 27 <= temp <= 39
        weather_type = weather.split()[0]
        assert weather_type in ["Sunny", "Hot", "Clear"]
    
    def test_unknown_region_fallback(self):
        """Test fallback to Miền Nam for unknown region."""
        weather = generate_random_weather("Unknown Region")
        temp_str = weather.split()[-1].replace("°C", "")
        temp = int(temp_str)
        
        # Should fallback to Miền Nam config [25, 36]
        assert 25 <= temp <= 36
    
    def test_randomness(self):
        """Test that weather is random (not always same)."""
        results = [generate_random_weather("Miền Bắc") for _ in range(10)]
        # Should have some variation
        assert len(set(results)) > 1


class TestDecodeDbJsonString:
    """Tests for decode_db_json_string function."""
    
    def test_valid_json_list(self):
        """Test decoding valid JSON list."""
        json_str = '["tag1", "tag2", "tag3"]'
        result = decode_db_json_string(json_str, default_type='list')
        assert result == ["tag1", "tag2", "tag3"]
        assert isinstance(result, list)
    
    def test_invalid_json_fallback(self):
        """Test fallback for invalid JSON."""
        invalid_json = "not a json string"
        result = decode_db_json_string(invalid_json, default_type='list')
        assert result == ["not a json string"]
        assert isinstance(result, list)
    
    def test_null_empty_string(self):
        """Test with null or empty string."""
        assert decode_db_json_string(None, default_type='list') == []
        assert decode_db_json_string("", default_type='list') == []
        assert decode_db_json_string(None, default_type='text') is None
    
    def test_default_type_text(self):
        """Test with default_type='text'."""
        assert decode_db_json_string(None, default_type='text') is None
        assert decode_db_json_string("", default_type='text') is None


class TestHaversineDistance:
    """Tests for haversine_distance function."""
    
    def test_valid_coordinates(self):
        """Test distance calculation with valid coordinates."""
        # Hà Nội to TP.HCM (approximately 1130 km)
        lat1, lon1 = 21.0285, 105.8542  # Hà Nội
        lat2, lon2 = 10.8231, 106.6297  # TP.HCM
        
        distance = haversine_distance(lat1, lon1, lat2, lon2)
        
        # Should be approximately 1130 km (allow ±50 km tolerance)
        assert 1080 <= distance <= 1180
        assert isinstance(distance, float)
    
    def test_close_points(self):
        """Test distance between close points."""
        # Two points in Hà Nội (approximately 1-2 km apart)
        lat1, lon1 = 21.0285, 105.8542  # Hoàn Kiếm
        lat2, lon2 = 21.0245, 105.8412  # Ba Đình
        
        distance = haversine_distance(lat1, lon1, lat2, lon2)
        
        assert 1.0 <= distance <= 3.0
    
    def test_null_coordinates(self):
        """Test with null coordinates."""
        assert haversine_distance(None, 105.8542, 10.8231, 106.6297) is None
        assert haversine_distance(21.0285, None, 10.8231, 106.6297) is None
        assert haversine_distance(21.0285, 105.8542, None, 106.6297) is None
        assert haversine_distance(21.0285, 105.8542, 10.8231, None) is None
    
    def test_same_point(self):
        """Test distance from point to itself."""
        lat, lon = 21.0285, 105.8542
        distance = haversine_distance(lat, lon, lat, lon)
        assert abs(distance) < 0.01  # Should be approximately 0


class TestEstimateTravelTimeKm:
    """Tests for estimate_travel_time_km function."""
    
    def test_car_mode(self):
        """Test travel time with car (50 km/h)."""
        distance = 100  # km
        time_minutes = estimate_travel_time_km(distance, "car")
        
        # 100 km / 50 km/h * 60 = 120 minutes
        assert time_minutes == 120
        assert isinstance(time_minutes, int)
    
    def test_walk_mode(self):
        """Test travel time with walk (5 km/h)."""
        distance = 5  # km
        time_minutes = estimate_travel_time_km(distance, "walk")
        
        # 5 km / 5 km/h * 60 = 60 minutes
        assert time_minutes == 60
    
    def test_bike_mode(self):
        """Test travel time with bike (15 km/h)."""
        distance = 15  # km
        time_minutes = estimate_travel_time_km(distance, "bike")
        
        # 15 km / 15 km/h * 60 = 60 minutes
        assert time_minutes == 60
    
    def test_zero_or_negative_distance(self):
        """Test with zero or negative distance."""
        assert estimate_travel_time_km(0, "car") == 0
        assert estimate_travel_time_km(-10, "car") == 0
    
    def test_null_distance(self):
        """Test with null distance."""
        assert estimate_travel_time_km(None, "car") == 0
    
    def test_invalid_transport_mode_fallback(self):
        """Test fallback to car speed for invalid mode."""
        distance = 50
        time_minutes = estimate_travel_time_km(distance, "plane")
        
        # Should fallback to car speed (50 km/h)
        assert time_minutes == 60  # 50 km / 50 km/h * 60 = 60 minutes


class TestGenerateOtp:
    """Tests for generate_otp function."""
    
    def test_default_length(self):
        """Test OTP with default length (6)."""
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()
        assert isinstance(otp, str)
    
    def test_custom_length(self):
        """Test OTP with custom length."""
        otp = generate_otp(4)
        assert len(otp) == 4
        assert otp.isdigit()
    
    def test_randomness(self):
        """Test that OTPs are random."""
        otps = [generate_otp() for _ in range(10)]
        # Should have some variation
        assert len(set(otps)) > 1
    
    def test_zero_length(self):
        """Test with length = 0."""
        otp = generate_otp(0)
        assert otp == ""
    
    def test_only_digits(self):
        """Test that OTP contains only digits."""
        otp = generate_otp(10)
        assert otp.isdigit()
        assert all(c in '0123456789' for c in otp)


class TestGetProvinceNameById:
    """Tests for get_province_name_by_id function."""
    
    def test_valid_province_id(self, app, test_province):
        """Test with valid province ID."""
        with app.app_context():
            name = get_province_name_by_id(test_province.id)
            assert name == "Hà Nội"
    
    def test_invalid_province_id(self, app):
        """Test with invalid province ID."""
        with app.app_context():
            name = get_province_name_by_id(99999)
            assert name == "Can't find..."
    
    def test_null_province_id(self, app):
        """Test with null province ID."""
        with app.app_context():
            name = get_province_name_by_id(None)
            assert name == "Can't find..."

