"""
Unit tests for Chat routes
"""
import pytest
from flask import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from models import ChatSession, ChatMessage, ChatAttachment, User, db


class TestListSessions:
    """Tests for GET /api/chat/sessions endpoint"""

    def test_list_sessions_empty(self, client, auth_headers):
        """Test listing sessions when user has none"""
        response = client.get('/api/chat/sessions',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_sessions_with_data(self, client, auth_headers, test_user):
        """Test listing sessions with messages"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id, title="Test Session")
            db.session.add(session)
            db.session.commit()
            db.session.refresh(session)
            session_id = session.id
            
            message = ChatMessage(
                session_id=session_id,
                user_id=test_user.id,
                role='user',
                content='Hello'
            )
            db.session.add(message)
            db.session.commit()
        
        response = client.get('/api/chat/sessions',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 1
        assert data[0]['id'] == session_id
        assert 'last_message' in data[0]

    def test_list_sessions_removes_empty(self, client, auth_headers, test_user):
        """Test that empty sessions are removed"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id, title="Empty Session")
            db.session.add(session)
            db.session.commit()
            db.session.refresh(session)
        
        response = client.get('/api/chat/sessions',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        # Empty session should be deleted
        assert len(data) == 0

    def test_list_sessions_unauthorized(self, client):
        """Test listing sessions without authentication"""
        response = client.get('/api/chat/sessions')
        assert response.status_code == 401


class TestCreateSession:
    """Tests for POST /api/chat/sessions endpoint"""

    def test_create_session_success(self, client, auth_headers, test_user):
        """Test creating a new chat session"""
        data = {'title': 'New Chat Session'}
        
        response = client.post('/api/chat/sessions',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'id' in data
        assert data['title'] == 'New Chat Session'

    def test_create_session_default_title(self, client, auth_headers):
        """Test creating session with default title"""
        data = {}
        
        response = client.post('/api/chat/sessions',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'title' in data

    def test_create_session_unauthorized(self, client):
        """Test creating session without authentication"""
        data = {'title': 'Test'}
        
        response = client.post('/api/chat/sessions',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 401


class TestWidgetHistory:
    """Tests for GET /api/chat/widget/history endpoint"""

    def test_widget_history_empty(self, client, auth_headers, test_user):
        """Test getting widget history when empty"""
        response = client.get('/api/chat/widget/history',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_widget_history_with_messages(self, client, auth_headers, test_user):
        """Test getting widget history with messages"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id)
            db.session.add(session)
            db.session.commit()
            
            msg1 = ChatMessage(
                session_id=session.id,
                user_id=test_user.id,
                role='user',
                content='Hello'
            )
            msg2 = ChatMessage(
                session_id=session.id,
                user_id=test_user.id,
                role='assistant',
                content='Hi there!'
            )
            db.session.add(msg1)
            db.session.add(msg2)
            db.session.commit()
        
        response = client.get('/api/chat/widget/history',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['role'] == 'user'
        assert data[1]['role'] == 'assistant'

    def test_widget_history_creates_session(self, client, auth_headers, test_user):
        """Test widget history creates session if none exists"""
        response = client.get('/api/chat/widget/history',
                            headers=auth_headers)
        
        assert response.status_code == 200
        # Session should be created
        with client.application.app_context():
            session = ChatSession.query.filter_by(user_id=test_user.id).first()
            assert session is not None

    def test_widget_history_unauthorized(self, client):
        """Test getting widget history without authentication"""
        response = client.get('/api/chat/widget/history')
        assert response.status_code == 401


class TestWidgetMessage:
    """Tests for POST /api/chat/widget/message endpoint"""

    @patch('routes.chat.chat_client')
    def test_widget_message_success(self, mock_chat_client, client, auth_headers, test_user):
        """Test sending widget message successfully"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = "Mock AI response"
        
        data = {
            'message': 'Hello AI',
            'page_context': 'Test page'
        }
        
        response = client.post('/api/chat/widget/message',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['role'] == 'assistant'
        assert 'content' in data

    def test_widget_message_missing_content(self, client, auth_headers):
        """Test sending widget message without content"""
        data = {}
        
        response = client.post('/api/chat/widget/message',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400

    @patch('routes.chat.chat_client')
    def test_widget_message_with_attachments(self, mock_chat_client, client, auth_headers, test_user):
        """Test sending widget message with attachments"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = "Mock AI response"
        
        data = {
            'message': 'Check this image',
            'attachments': [
                {
                    'data_url': 'data:image/jpeg;base64,test123',
                    'name': 'test.jpg'
                }
            ]
        }
        
        response = client.post('/api/chat/widget/message',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 201
        # Check attachment was saved
        with client.application.app_context():
            attachment = ChatAttachment.query.first()
            assert attachment is not None
            assert attachment.name == 'test.jpg'

    def test_widget_message_openai_not_ready(self, client, auth_headers, test_user):
        """Test widget message when OpenAI is not configured"""
        with patch('routes.chat.chat_client') as mock_client:
            mock_client.is_ready.return_value = False
            data = {'message': 'Hello'}
            
            response = client.post('/api/chat/widget/message',
                                json=data,
                                headers=auth_headers,
                                content_type='application/json')
            
            assert response.status_code == 500

    def test_widget_message_unauthorized(self, client):
        """Test sending widget message without authentication"""
        data = {'message': 'Hello'}
        
        response = client.post('/api/chat/widget/message',
                            json=data,
                            content_type='application/json')
        
        assert response.status_code == 401


class TestWidgetLogMessages:
    """Tests for POST /api/chat/widget/log endpoint"""

    def test_widget_log_messages_success(self, client, auth_headers, test_user):
        """Test logging multiple messages"""
        data = {
            'messages': [
                {'role': 'user', 'content': 'Message 1'},
                {'role': 'assistant', 'content': 'Response 1'},
                {'role': 'user', 'content': 'Message 2'}
            ]
        }
        
        response = client.post('/api/chat/widget/log',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        # Response is a list of messages, not a dict with 'created' key
        assert isinstance(data, list)
        assert len(data) == 3

    def test_widget_log_messages_invalid_payload(self, client, auth_headers):
        """Test logging messages with invalid payload"""
        data = {'messages': 'not a list'}
        
        response = client.post('/api/chat/widget/log',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    def test_widget_log_messages_empty_list(self, client, auth_headers):
        """Test logging messages with empty list"""
        data = {'messages': []}
        
        response = client.post('/api/chat/widget/log',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 400

    def test_widget_log_messages_filters_invalid(self, client, auth_headers, test_user):
        """Test logging filters invalid entries"""
        data = {
            'messages': [
                {'role': 'user', 'content': 'Valid message'},
                {'role': 'invalid', 'content': 'Invalid role'},
                {'role': 'user', 'content': ''},  # Empty content
                {'role': 'assistant', 'content': 'Valid response'}
            ]
        }
        
        response = client.post('/api/chat/widget/log',
                             json=data,
                             headers=auth_headers,
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        # Response is a list, should only create 2 valid messages
        assert isinstance(data, list)
        assert len(data) == 2

    def test_widget_log_messages_unauthorized(self, client):
        """Test logging messages without authentication"""
        data = {'messages': [{'role': 'user', 'content': 'Test'}]}
        
        response = client.post('/api/chat/widget/log',
                             json=data,
                             content_type='application/json')
        
        assert response.status_code == 401


class TestDeleteSession:
    """Tests for DELETE /api/chat/sessions/<id> endpoint"""

    def test_delete_session_success(self, client, auth_headers, test_user):
        """Test deleting a chat session"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id, title="Test Session")
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        response = client.delete(f'/api/chat/sessions/{session_id}',
                               headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Session deleted'
        
        with client.application.app_context():
            deleted = db.session.get(ChatSession, session_id)
            assert deleted is None

    def test_delete_session_not_found(self, client, auth_headers):
        """Test deleting non-existent session"""
        response = client.delete('/api/chat/sessions/99999',
                               headers=auth_headers)
        
        assert response.status_code == 404

    def test_delete_session_other_user(self, client, auth_headers, test_user, app):
        """Test cannot delete other user's session"""
        with app.app_context():
            other_user = User(
                username='otheruser',
                email='other@example.com',
                password='hashed'
            )
            db.session.add(other_user)
            db.session.commit()
            
            session = ChatSession(user_id=other_user.id, title="Other Session")
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        response = client.delete(f'/api/chat/sessions/{session_id}',
                               headers=auth_headers)
        
        assert response.status_code == 404  # Should not find other user's session


class TestUpdateSession:
    """Tests for PUT /api/chat/sessions/<id> endpoint"""

    def test_update_session_title(self, client, auth_headers, test_user):
        """Test updating session title"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id, title="Old Title")
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        data = {'title': 'New Title'}
        
        response = client.put(f'/api/chat/sessions/{session_id}',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['title'] == 'New Title'

    def test_update_session_missing_title(self, client, auth_headers, test_user):
        """Test updating session without title"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id)
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        data = {}
        
        response = client.put(f'/api/chat/sessions/{session_id}',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400

    def test_update_session_not_found(self, client, auth_headers):
        """Test updating non-existent session"""
        data = {'title': 'New Title'}
        
        response = client.put('/api/chat/sessions/99999',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 404


class TestGetSessionMessages:
    """Tests for GET /api/chat/sessions/<id>/messages endpoint"""

    def test_get_session_messages(self, client, auth_headers, test_user):
        """Test getting messages from a session"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id)
            db.session.add(session)
            db.session.commit()
            
            msg1 = ChatMessage(
                session_id=session.id,
                user_id=test_user.id,
                role='user',
                content='Message 1'
            )
            msg2 = ChatMessage(
                session_id=session.id,
                user_id=test_user.id,
                role='assistant',
                content='Response 1'
            )
            db.session.add(msg1)
            db.session.add(msg2)
            db.session.commit()
            session_id = session.id
        
        response = client.get(f'/api/chat/sessions/{session_id}/messages',
                            headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2

    def test_get_session_messages_not_found(self, client, auth_headers):
        """Test getting messages from non-existent session"""
        response = client.get('/api/chat/sessions/99999/messages',
                            headers=auth_headers)
        
        assert response.status_code == 404


class TestSendSessionMessage:
    """Tests for POST /api/chat/sessions/<id>/messages endpoint"""

    @patch('routes.chat.chat_client')
    def test_send_session_message_success(self, mock_chat_client, client, auth_headers, test_user):
        """Test sending message to a session"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = "Mock AI response"
        
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id)
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        data = {'message': 'Hello'}
        
        response = client.post(f'/api/chat/sessions/{session_id}/messages',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'reply' in data
        assert 'session' in data

    @patch('routes.chat.chat_client')
    def test_send_session_message_updates_title(self, mock_chat_client, client, auth_headers, test_user):
        """Test sending first message updates session title"""
        mock_chat_client.is_ready.return_value = True
        mock_chat_client.generate_reply.return_value = "Mock AI response"
        
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id, title="Cuộc trò chuyện mới")
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        data = {'message': 'This is a long message that should become the title'}
        
        response = client.post(f'/api/chat/sessions/{session_id}/messages',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 200
        with client.application.app_context():
            updated_session = db.session.get(ChatSession, session_id)
            assert updated_session.title != "Cuộc trò chuyện mới"

    def test_send_session_message_missing_content(self, client, auth_headers, test_user):
        """Test sending message without content"""
        with client.application.app_context():
            session = ChatSession(user_id=test_user.id)
            db.session.add(session)
            db.session.commit()
            session_id = session.id
        
        data = {}
        
        response = client.post(f'/api/chat/sessions/{session_id}/messages',
                            json=data,
                            headers=auth_headers,
                            content_type='application/json')
        
        assert response.status_code == 400

