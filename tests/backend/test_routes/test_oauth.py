"""
Unit tests for OAuth routes (Google and GitHub login)
"""
import pytest
from flask import json
from flask_jwt_extended import create_access_token
from models import User, db


class TestGoogleLogin:
    """Tests for Google OAuth login endpoint"""

    def test_google_login_new_user(self, client):
        """Test Google login creates new user"""
        data = {
            'google_id': 'google123',
            'email': 'newuser@gmail.com',
            'name': 'New User',
            'picture': 'https://example.com/avatar.jpg'
        }
        
        response = client.post('/api/auth/google-login', 
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['email'] == 'newuser@gmail.com'
        # google_id is not returned in user object, but user is created
        with client.application.app_context():
            user = User.query.filter_by(email='newuser@gmail.com').first()
            assert user is not None
            assert user.google_id == 'google123'

    def test_google_login_existing_user(self, client, test_user):
        """Test Google login with existing user"""
        # Update test_user to have Google ID
        with client.application.app_context():
            test_user.google_id = 'google123'
            test_user.is_email_verified = True
            db.session.commit()
        
        data = {
            'google_id': 'google123',
            'email': test_user.email,
            'name': 'Updated Name',
            'picture': 'https://example.com/new-avatar.jpg'
        }
        
        response = client.post('/api/auth/google-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'access_token' in data
        assert data['user']['id'] == test_user.id

    def test_google_login_missing_required_fields(self, client):
        """Test Google login with missing required fields"""
        data = {'email': 'test@example.com'}  # Missing google_id
        
        response = client.post('/api/auth/google-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'Google ID and email are required' in data['message']

    def test_google_login_updates_existing_user_info(self, client, test_user):
        """Test Google login updates user info when picture changes"""
        with client.application.app_context():
            test_user.google_id = 'google123'
            test_user.picture = 'https://example.com/old-avatar.jpg'
            db.session.commit()
        
        data = {
            'google_id': 'google123',
            'email': test_user.email,
            'name': test_user.name,
            'picture': 'https://example.com/new-avatar.jpg'
        }
        
        response = client.post('/api/auth/google-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 200
        with client.application.app_context():
            updated_user = db.session.get(User, test_user.id)
            assert updated_user.picture == 'https://example.com/new-avatar.jpg'
            assert updated_user.avatar_url == 'https://example.com/new-avatar.jpg'


class TestGitHubLogin:
    """Tests for GitHub OAuth login endpoint"""

    def test_github_login_new_user(self, client):
        """Test GitHub login creates new user"""
        data = {
            'github_id': 'github123',
            'email': 'githubuser@example.com',
            'name': 'GitHub User',
            'username': 'githubuser',
            'picture': 'https://example.com/github-avatar.jpg'
        }
        
        response = client.post('/api/auth/github-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['github_id'] == 'github123'

    def test_github_login_existing_user(self, client, test_user):
        """Test GitHub login with existing user"""
        with client.application.app_context():
            test_user.github_id = 'github123'
            test_user.is_email_verified = True
            db.session.commit()
        
        data = {
            'github_id': 'github123',
            'email': test_user.email,
            'name': 'Updated GitHub Name',
            'picture': 'https://example.com/github-avatar.jpg'
        }
        
        response = client.post('/api/auth/github-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'access_token' in data
        assert data['user']['id'] == test_user.id

    def test_github_login_missing_github_id(self, client):
        """Test GitHub login with missing GitHub ID"""
        data = {'email': 'test@example.com'}  # Missing github_id
        
        response = client.post('/api/auth/github-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'GitHub ID is required' in data['message']

    def test_github_login_creates_unique_username(self, client, test_user):
        """Test GitHub login creates unique username when conflict"""
        with client.application.app_context():
            # Create user with username that will conflict
            existing_user = User(
                username='githubuser',
                email='existing@example.com',
                password='hashed'
            )
            db.session.add(existing_user)
            db.session.commit()
        
        data = {
            'github_id': 'github456',
            'email': 'newgithub@example.com',
            'username': 'githubuser',  # This will conflict
            'picture': 'https://example.com/avatar.jpg'
        }
        
        response = client.post('/api/auth/github-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        # Should create username with suffix
        assert data['user']['username'] != 'githubuser'
        assert 'githubuser' in data['user']['username']

    def test_github_login_without_email(self, client):
        """Test GitHub login without email (creates temp email)"""
        data = {
            'github_id': 'github789',
            'name': 'GitHub User No Email',
            'username': 'githubuser789',
            'picture': 'https://example.com/avatar.jpg'
        }
        
        response = client.post('/api/auth/github-login',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert '@github.temp' in data['user']['email']

