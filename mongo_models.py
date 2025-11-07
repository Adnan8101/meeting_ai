from mongoengine import Document, StringField, EmailField, DateTimeField, ReferenceField, IntField, BooleanField
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import random
import string

class User(UserMixin, Document):
    username = StringField(required=True, unique=True, max_length=150)
    email = EmailField(required=True, unique=True)
    password_hash = StringField(required=True, max_length=256)  # Increased length for password hash
    team_id = StringField(max_length=24)  # Reference to Team ID
    created_at = DateTimeField(default=datetime.utcnow)
    is_verified = BooleanField(default=False)  # Email verification status
    
    # Email verification fields
    verification_token = StringField(max_length=6)
    verification_token_expires = DateTimeField()
    
    # Password reset fields
    reset_token = StringField(max_length=6)
    reset_token_expires = DateTimeField()
    
    # Collection name
    meta = {
        'collection': 'users',
        'indexes': ['username', 'email']
    }

    @property
    def password(self):
        raise AttributeError('password is not a readable attribute')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def generate_reset_token(self):
        """Generate a 6-digit OTP for password reset"""
        self.reset_token = ''.join(random.choices(string.digits, k=6))
        from datetime import timedelta
        self.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)  # 15 minutes expiry
        self.save()
        return self.reset_token
    
    def verify_reset_token(self, token):
        """Verify the reset token and check if it's not expired"""
        return (self.reset_token == token and 
                self.reset_token_expires and 
                datetime.utcnow() < self.reset_token_expires)
    
    def clear_reset_token(self):
        """Clear the reset token after successful password reset"""
        self.reset_token = None
        self.reset_token_expires = None
        self.save()

    def generate_verification_token(self):
        """Generate a 6-digit OTP for email verification"""
        self.verification_token = ''.join(random.choices(string.digits, k=6))
        from datetime import timedelta
        self.verification_token_expires = datetime.utcnow() + timedelta(minutes=30)  # 30 minutes expiry
        self.save()
        return self.verification_token
    
    def verify_email_token(self, token):
        """Verify the email verification token and check if it's not expired"""
        return (self.verification_token == token and 
                self.verification_token_expires and 
                datetime.utcnow() < self.verification_token_expires)
    
    def complete_email_verification(self):
        """Complete email verification process"""
        self.is_verified = True
        self.verification_token = None
        self.verification_token_expires = None
        self.save()

    def get_id(self):
        """Required by Flask-Login"""
        return str(self.id)

class Team(Document):
    name = StringField(required=True, max_length=100)
    owner_id = StringField(required=True, max_length=24)  # User ID
    created_at = DateTimeField(default=datetime.utcnow)
    slack_webhook_url = StringField(max_length=500)
    
    meta = {
        'collection': 'teams'
    }

class TrelloCredentials(Document):
    user_id = StringField(required=True, unique=True, max_length=24)
    token = StringField(required=True, max_length=200)
    trello_username = StringField(max_length=100)
    created_at = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'trello_credentials'
    }

class TrelloCard(Document):
    card_id = StringField(required=True, unique=True, max_length=100)
    user_id = StringField(required=True, max_length=24)
    board_id = StringField(required=True, max_length=100)
    list_id = StringField(required=True, max_length=100)
    task_description = StringField(required=True)
    assignee = StringField(max_length=150)
    due_date_str = StringField(max_length=100)
    created_at = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'trello_cards'
    }

class JiraCredentials(Document):
    user_id = StringField(required=True, unique=True, max_length=24)
    jira_url = StringField(required=True, max_length=255)
    email = EmailField(required=True)
    api_token = StringField(required=True, max_length=200)
    created_at = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'jira_credentials'
    }
