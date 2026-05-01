from __future__ import annotations

import random
import secrets
import string
from datetime import datetime, timedelta
from typing import Any

from flask_login import UserMixin
from sqlalchemy import String, and_, asc, cast, desc, or_
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


def generate_object_id() -> str:
    """Generate a compact 24-char hex id for backward compatibility."""
    return secrets.token_hex(12)


class Q:
    """Minimal query expression with OR/AND composition."""

    def __init__(self, **conditions: Any):
        self.conditions = conditions
        self.children: list[Q] = []
        self.operator = "leaf"

    def __or__(self, other: "Q") -> "Q":
        node = Q()
        node.operator = "or"
        node.children = [self, other]
        return node

    def __and__(self, other: "Q") -> "Q":
        node = Q()
        node.operator = "and"
        node.children = [self, other]
        return node


class QuerySet:
    def __init__(self, model: type[db.Model], query=None):
        self.model = model
        self.query = query if query is not None else model.query

    def filter(self, *args: Any, **kwargs: Any) -> "QuerySet":
        query = self.query
        for arg in args:
            if isinstance(arg, Q):
                query = query.filter(_compile_q(self.model, arg))
        if kwargs:
            expressions = [_compile_condition(self.model, key, value) for key, value in kwargs.items()]
            query = query.filter(and_(*expressions))
        return QuerySet(self.model, query)

    def order_by(self, *fields: str) -> "QuerySet":
        query = self.query
        clauses = []
        for field in fields:
            direction = asc
            column_name = field
            if field.startswith("-"):
                direction = desc
                column_name = field[1:]

            column = getattr(self.model, column_name, None)
            if column is not None:
                clauses.append(direction(column))

        if clauses:
            query = query.order_by(*clauses)
        return QuerySet(self.model, query)

    def limit(self, value: int) -> "QuerySet":
        return QuerySet(self.model, self.query.limit(value))

    def first(self):
        return self.query.first()

    def count(self) -> int:
        return self.query.count()

    def delete(self) -> int:
        objects = self.query.all()
        for obj in objects:
            db.session.delete(obj)
        db.session.commit()
        return len(objects)

    def all(self):
        return self.query.all()

    def __iter__(self):
        return iter(self.query.all())

    def __len__(self) -> int:
        return self.query.count()

    def __bool__(self) -> bool:
        return self.query.first() is not None


class ObjectsManager:
    def __init__(self, model: type[db.Model]):
        self.model = model

    def __call__(self, *args: Any, **kwargs: Any) -> QuerySet:
        queryset = QuerySet(self.model)
        if args or kwargs:
            return queryset.filter(*args, **kwargs)
        return queryset

    def __getattr__(self, item: str):
        return getattr(QuerySet(self.model), item)


class ObjectsDescriptor:
    def __get__(self, instance, owner):
        return ObjectsManager(owner)


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(db.String(24), primary_key=True, default=generate_object_id)
    objects = ObjectsDescriptor()

    def save(self, *args, **kwargs):
        db.session.add(self)
        db.session.commit()
        return self

    def delete(self, *args, **kwargs):
        db.session.delete(self)
        db.session.commit()


class User(UserMixin, BaseModel):
    __tablename__ = "users"

    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    team_id = db.Column(db.String(24), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)

    verification_token = db.Column(db.String(6), nullable=True)
    verification_token_expires = db.Column(db.DateTime, nullable=True)

    reset_token = db.Column(db.String(6), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)

    @property
    def password(self):
        raise AttributeError("password is not a readable attribute")

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def generate_reset_token(self):
        self.reset_token = "".join(random.choices(string.digits, k=6))
        self.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)
        self.save()
        return self.reset_token

    def verify_reset_token(self, token):
        return (
            self.reset_token == token
            and self.reset_token_expires
            and datetime.utcnow() < self.reset_token_expires
        )

    def clear_reset_token(self):
        self.reset_token = None
        self.reset_token_expires = None
        self.save()

    def generate_verification_token(self):
        self.verification_token = "".join(random.choices(string.digits, k=6))
        self.verification_token_expires = datetime.utcnow() + timedelta(minutes=30)
        self.save()
        return self.verification_token

    def verify_email_token(self, token):
        return (
            self.verification_token == token
            and self.verification_token_expires
            and datetime.utcnow() < self.verification_token_expires
        )

    def complete_email_verification(self):
        self.is_verified = True
        self.verification_token = None
        self.verification_token_expires = None
        self.save()

    def get_id(self):
        return str(self.id)


class Team(BaseModel):
    __tablename__ = "teams"

    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.String(24), nullable=False, index=True)
    join_code = db.Column(db.String(12), unique=True, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    slack_webhook_url = db.Column(db.String(500), nullable=True)


class TrelloCredentials(BaseModel):
    __tablename__ = "trello_credentials"

    user_id = db.Column(db.String(24), unique=True, nullable=False, index=True)
    token = db.Column(db.String(200), nullable=False)
    trello_username = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class TrelloCard(BaseModel):
    __tablename__ = "trello_cards"

    card_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    user_id = db.Column(db.String(24), nullable=False, index=True)
    board_id = db.Column(db.String(100), nullable=False)
    list_id = db.Column(db.String(100), nullable=False)
    task_description = db.Column(db.Text, nullable=False)
    assignee = db.Column(db.String(150), nullable=True)
    due_date_str = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class JiraCredentials(BaseModel):
    __tablename__ = "jira_credentials"

    user_id = db.Column(db.String(24), unique=True, nullable=False, index=True)
    jira_url = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    api_token = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    user_id = db.Column(db.String(24), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    selected_model = db.Column(db.String(100), nullable=True)
    actual_model = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)


class MeetingInsight(BaseModel):
    __tablename__ = "meeting_insights"

    user_id = db.Column(db.String(24), nullable=False, index=True)
    team_id = db.Column(db.String(24), nullable=True, index=True)
    title = db.Column(db.String(200), nullable=False)
    transcript_excerpt = db.Column(db.Text, nullable=True)
    summary = db.Column(db.Text, nullable=False)
    topics = db.Column(db.JSON, default=list, nullable=False)
    decisions = db.Column(db.JSON, default=list, nullable=False)
    participants = db.Column(db.JSON, default=list, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)


class WorkActionItem(BaseModel):
    __tablename__ = "work_action_items"

    user_id = db.Column(db.String(24), nullable=False, index=True)
    meeting_id = db.Column(db.String(24), nullable=True, index=True)
    task = db.Column(db.String(500), nullable=False)
    assignee = db.Column(db.String(150), nullable=True)
    due_date_str = db.Column(db.String(120), nullable=True)
    due_date = db.Column(db.DateTime, nullable=True, index=True)
    priority = db.Column(db.String(10), default="medium", nullable=False, index=True)
    status = db.Column(db.String(20), default="pending", nullable=False, index=True)
    context_notes = db.Column(db.Text, nullable=True)
    source = db.Column(db.String(60), default="meeting_ai", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    def save(self, *args, **kwargs):
        self.updated_at = datetime.utcnow()
        if self.status == "done" and not self.completed_at:
            self.completed_at = datetime.utcnow()
        if self.status != "done":
            self.completed_at = None
        return super().save(*args, **kwargs)


def _compile_q(model: type[db.Model], q: Q):
    if q.operator == "leaf":
        expressions = [_compile_condition(model, key, value) for key, value in q.conditions.items()]
        return and_(*expressions) if expressions else True

    compiled_children = [_compile_q(model, child) for child in q.children]
    if q.operator == "or":
        return or_(*compiled_children)
    return and_(*compiled_children)


def _compile_condition(model: type[db.Model], key: str, value: Any):
    if "__" in key:
        field_name, op = key.split("__", 1)
    else:
        field_name, op = key, "eq"

    column = getattr(model, field_name)

    if op == "eq":
        return column == value
    if op == "ne":
        return column != value
    if op == "lt":
        return column < value
    if op == "lte":
        return column <= value
    if op == "gt":
        return column > value
    if op == "gte":
        return column >= value
    if op == "icontains":
        return cast(column, String).ilike(f"%{value}%")

    return column == value
