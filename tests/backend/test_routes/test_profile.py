"""
Unit tests for Profile routes
"""
import pytest
from flask import json
from werkzeug.security import generate_password_hash
from models import User, db


class TestGetProfile:
    """Tests for GET /api/profile endpoint"""

    def test_get_profile_success(self, client, auth_headers, test_user):
        """Test getting profile with valid token"""
        response = client.get('/api/profile',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == test_user.id
        assert data['username'] == test_user.username
        assert data['email'] == test_user.email

    def test_get_profile_unauthorized(self, client):
        """Test getting profile without token"""
        response = client.get('/api/profile')
        assert response.status_code == 401

    def test_get_profile_user_not_found(self, client, app):
        """Test getting profile for non-existent user"""
        from flask_jwt_extended import create_access_token
        with app.app_context():
            token = create_access_token(identity=99999)  # Non-existent user ID
        
        response = client.get('/api/profile',
                            headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 404


class TestUpdateProfile:
    """Tests for PUT /api/profile endpoint"""

    def test_update_username(self, client, auth_headers, test_user):
        """Test updating username"""
        data = {'username': 'newusername'}
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['username'] == 'newusername'
        
        with client.application.app_context():
            updated_user = db.session.get(User, test_user.id)
            assert updated_user.username == 'newusername'

    def test_update_username_too_short(self, client, auth_headers):
        """Test updating username with invalid length"""
        data = {'username': 'ab'}  # Too short
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'username' in data['errors']

    def test_update_email(self, client, auth_headers, test_user):
        """Test updating email"""
        data = {'email': 'newemail@example.com'}
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['email'] == 'newemail@example.com'

    def test_update_email_invalid_format(self, client, auth_headers):
        """Test updating email with invalid format"""
        data = {'email': 'invalid-email'}
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'email' in data['errors']

    def test_update_email_duplicate(self, client, auth_headers, test_user, app):
        """Test updating email to existing email"""
        with app.app_context():
            other_user = User(
                username='otheruser',
                email='existing@example.com',
                password='hashed'
            )
            db.session.add(other_user)
            db.session.commit()
        
        data = {'email': 'existing@example.com'}
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'email' in data['errors']

    def test_update_tagline(self, client, auth_headers, test_user):
        """Test updating tagline"""
        data = {'tagline': 'Trip'}  # Will become #VNTrip (4 chars, valid)
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['tagline'] == '#VNTrip'

    def test_update_tagline_invalid_length(self, client, auth_headers):
        """Test updating tagline with invalid length"""
        data = {'tagline': 'VN'}  # Too short
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'tagline' in data['errors']

    def test_update_password_oauth_user_first_time(self, client, auth_headers, test_user):
        """Test OAuth user setting password for first time"""
        with client.application.app_context():
            # Refresh user to ensure it's in session
            user = db.session.get(User, test_user.id)
            user.google_id = 'google123'
            user.password = None
            db.session.commit()
            db.session.refresh(user)
        
        data = {
            'newPassword': 'newpassword123'
        }
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        with client.application.app_context():
            updated_user = db.session.get(User, test_user.id)
            assert updated_user.password is not None

    def test_update_password_regular_user_requires_current(self, client, auth_headers, test_user):
        """Test regular user must provide current password"""
        with client.application.app_context():
            test_user.password = generate_password_hash('oldpassword')
            db.session.commit()
        
        data = {
            'newPassword': 'newpassword123'
            # Missing currentPassword
        }
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'currentPassword' in data['errors']

    def test_update_password_wrong_current(self, client, auth_headers, test_user):
        """Test updating password with wrong current password"""
        with client.application.app_context():
            test_user.password = generate_password_hash('oldpassword')
            db.session.commit()
        
        data = {
            'currentPassword': 'wrongpassword',
            'newPassword': 'newpassword123'
        }
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'currentPassword' in data['errors']

    def test_update_password_success(self, client, auth_headers, test_user):
        """Test successfully updating password"""
        from werkzeug.security import check_password_hash
        
        with client.application.app_context():
            # Refresh user to ensure it's in session
            user = db.session.get(User, test_user.id)
            user.password = generate_password_hash('oldpassword')
            db.session.commit()
            db.session.refresh(user)
        
        data = {
            'currentPassword': 'oldpassword',
            'newPassword': 'newpassword123'
        }
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        with client.application.app_context():
            updated_user = db.session.get(User, test_user.id)
            assert check_password_hash(updated_user.password, 'newpassword123')

    def test_update_avatar(self, client, auth_headers, test_user):
        """Test updating avatar URL"""
        data = {'avatarUrl': 'https://example.com/new-avatar.jpg'}
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['avatar'] == 'https://example.com/new-avatar.jpg'

    def test_update_no_changes(self, client, auth_headers, test_user):
        """Test updating with no actual changes"""
        data = {'username': test_user.username}  # Same value
        
        response = client.put('/api/profile',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'No changes detected'


class TestRequestEmailChange:
    """Tests for POST /api/profile/request-email-change endpoint"""

    def test_request_email_change_success(self, client, auth_headers, test_user, mock_smtp):
        """Test requesting email change"""
        data = {'new_email': 'newemail@example.com'}
        
        response = client.post('/api/profile/request-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'message' in data
        assert data['new_email'] == 'newemail@example.com'
        assert data['requires_verification'] is True

    def test_request_email_change_invalid_format(self, client, auth_headers):
        """Test requesting email change with invalid format"""
        data = {'new_email': 'invalid-email'}
        
        response = client.post('/api/profile/request-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    def test_request_email_change_duplicate(self, client, auth_headers, test_user, app):
        """Test requesting email change to existing email"""
        with app.app_context():
            other_user = User(
                username='otheruser',
                email='existing@example.com',
                password='hashed'
            )
            db.session.add(other_user)
            db.session.commit()
        
        data = {'new_email': 'existing@example.com'}
        
        response = client.post('/api/profile/request-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400


class TestVerifyEmailChange:
    """Tests for POST /api/profile/verify-email-change endpoint"""

    def test_verify_email_change_success(self, client, auth_headers, test_user):
        """Test verifying email change with valid OTP"""
        from datetime import datetime, timedelta
        from utils.email_utils import generate_otp
        
        with client.application.app_context():
            # Refresh user to ensure it's in session
            user = db.session.get(User, test_user.id)
            otp_code = generate_otp(6)
            user.pending_email = 'newemail@example.com'
            user.verification_token = otp_code
            user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
            db.session.commit()
            db.session.refresh(user)
        
        data = {'otp_code': otp_code}
        
        response = client.post('/api/profile/verify-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['new_email'] == 'newemail@example.com'
        
        with client.application.app_context():
            updated_user = db.session.get(User, test_user.id)
            assert updated_user.email == 'newemail@example.com'
            assert updated_user.pending_email is None

    def test_verify_email_change_invalid_otp(self, client, auth_headers, test_user):
        """Test verifying email change with invalid OTP"""
        from datetime import datetime, timedelta
        
        with client.application.app_context():
            # Refresh user to ensure it's in session
            user = db.session.get(User, test_user.id)
            user.pending_email = 'newemail@example.com'
            user.verification_token = '123456'
            user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
            db.session.commit()
            db.session.refresh(user)
        
        data = {'otp_code': 'wrongcode'}
        
        response = client.post('/api/profile/verify-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error_type' in data
        assert data['error_type'] == 'invalid_otp'

    def test_verify_email_change_expired_otp(self, client, auth_headers, test_user):
        """Test verifying email change with expired OTP"""
        from datetime import datetime, timedelta
        
        with client.application.app_context():
            # Refresh user to ensure it's in session
            user = db.session.get(User, test_user.id)
            user.pending_email = 'newemail@example.com'
            user.verification_token = '123456'
            user.reset_token_expiry = datetime.utcnow() - timedelta(minutes=1)  # Expired
            db.session.commit()
            db.session.refresh(user)
        
        data = {'otp_code': '123456'}
        
        response = client.post('/api/profile/verify-email-change',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error_type' in data
        assert data['error_type'] == 'otp_expired'

