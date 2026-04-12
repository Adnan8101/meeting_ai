import os
import json
import logging
import importlib.util
from difflib import SequenceMatcher
import requests
from io import BytesIO
from jira import JIRA  # Make sure this is imported
from jira.exceptions import JIRAError  # Import specific Jira errors
import time
from datetime import datetime, timedelta
import re
from urllib.parse import urlencode

from flask import Flask, request, redirect, url_for, flash, jsonify, send_from_directory
from flask_login import login_user, logout_user, login_required, current_user
import google.generativeai as genai
from trello import TrelloClient
from sqlalchemy import text, create_engine

from extensions import bcrypt, db, login_manager
from models import ChatMessage, JiraCredentials, MeetingInsight, Q, Team, TrelloCard, TrelloCredentials, User, WorkActionItem
from email_service import send_welcome_email, send_integration_success_email, send_password_reset_email, send_email_verification, send_email
from dotenv import load_dotenv

# Import logging configuration
from logger_config import (
    app_logger, database_logger, integration_logger, security_logger, access_logger,
    log_request, log_response, log_error, log_security_event, log_integration_operation
)

load_dotenv()
app_logger.info("Starting AI Meeting Agent application initialization")


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def normalize_database_url(raw_url: str) -> str:
    value = (raw_url or "").strip().strip('"').strip("'")
    if value.startswith("postgres://"):
        return "postgresql://" + value[len("postgres://") :]
    return value


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def apply_available_postgres_driver(database_url: str) -> str:
    if not database_url.startswith("postgresql://"):
        return database_url

    for module_name, driver_name in (("pg8000", "pg8000"), ("psycopg2", "psycopg2"), ("psycopg", "psycopg")):
        if _module_available(module_name):
            return f"postgresql+{driver_name}://" + database_url[len("postgresql://") :]

    return database_url


def sqlite_fallback_uri(app_root: str) -> str:
    if _is_truthy(os.environ.get("VERCEL")):
        fallback_path = "/tmp/meeting_agent.db"
    else:
        instance_dir = os.path.join(app_root, "instance")
        os.makedirs(instance_dir, exist_ok=True)
        fallback_path = os.path.join(instance_dir, "meeting_agent.db")
    return f"sqlite:///{fallback_path}"


def resolve_runtime_database_uri(app_root: str) -> tuple[str, str]:
    if not DATABASE_URL:
        return sqlite_fallback_uri(app_root), ""

    candidate_url = apply_available_postgres_driver(DATABASE_URL)
    try:
        # Driver import and URL parsing happen here. If this fails, we can safely degrade.
        create_engine(candidate_url).dispose()
        return candidate_url, ""
    except Exception as exc:
        fallback_url = sqlite_fallback_uri(app_root)
        details = f"Primary database unavailable ({type(exc).__name__}: {exc}). Falling back to SQLite."
        return fallback_url, details

# --- CONFIGURATION ---
# Get environment variables with fallbacks
TRELLO_API_KEY = os.environ.get("TRELLO_API_KEY", "")
TRELLO_API_SECRET = os.environ.get("TRELLO_API_SECRET", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL_20 = os.environ.get("GEMINI_MODEL_20", "gemini-2.0-flash")
GEMINI_MODEL_25 = os.environ.get("GEMINI_MODEL_25", "gemini-2.5-flash")
GEMINI_MODEL_3 = os.environ.get("GEMINI_MODEL_3", "gemini-3-flash")
GEMINI_ANALYSIS_MODEL = os.environ.get("GEMINI_ANALYSIS_MODEL", "gemini-2.5-flash")
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_CLIENT_ID = os.environ.get("GMAIL_CLIENT_ID", "")
GMAIL_CLIENT_SECRET = os.environ.get("GMAIL_CLIENT_SECRET", "")
GMAIL_REFRESH_TOKEN = os.environ.get("GMAIL_REFRESH_TOKEN", "")
EMAIL_CONFIGURED = bool(GMAIL_USER and GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN)
FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "ai-meeting-secret-key")
DATABASE_URL = normalize_database_url(
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL")
    or os.environ.get("PRISMA_DATABASE_URL", "")
)
MAX_TRANSCRIPT_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TRANSCRIPT_EXTENSIONS = {'.txt', '.doc', '.docx', '.pdf'}
MAX_TRANSCRIPT_WORDS = 500

# Log configuration status (without exposing secrets)
app_logger.info("="*60)
app_logger.info("CONFIGURATION STATUS")
app_logger.info("="*60)
app_logger.info(f"TRELLO_API_KEY: {'✓ Set' if TRELLO_API_KEY else '✗ Missing'}")
app_logger.info(f"GEMINI_API_KEY: {'✓ Set' if GEMINI_API_KEY else '✗ Missing'}")
app_logger.info(f"DATABASE_URL: {'✓ Set' if DATABASE_URL else '✗ Missing'}")
app_logger.info(f"EMAIL: {'✓ Set' if EMAIL_CONFIGURED else '✗ Missing'}")
app_logger.info("="*60)


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = FLASK_SECRET_KEY
    app.config['DATABASE_ERROR'] = ''

    frontend_dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    frontend_assets_dir = os.path.join(frontend_dist_dir, 'assets')

    def serve_frontend_app(*_args, **_kwargs):
        index_file = os.path.join(frontend_dist_dir, 'index.html')
        if os.path.exists(index_file):
            response = send_from_directory(frontend_dist_dir, 'index.html', max_age=0)
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        return jsonify({
            'success': False,
            'error': 'Frontend build not found. Run: cd frontend && npm run build'
        }), 503

    # Compatibility shim: existing routes still call render_template in many places.
    # This keeps backend logic intact while serving the React SPA for UI routes.
    def render_template(*_args, **_kwargs):
        return serve_frontend_app()
    
    app_logger.info("Creating Flask application instance")
    
    # Session configuration for better compatibility with serverless
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True if using HTTPS in production
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour
    app_logger.info("Session configuration applied")

    # Keep runtime logs readable by suppressing noisy HTTP access logs.
    quiet_http_logs = _is_truthy(os.environ.get('QUIET_HTTP_LOGS')) or _is_truthy(os.environ.get('VERCEL'))
    app.config['ENABLE_ACCESS_LOGS'] = _is_truthy(os.environ.get('ENABLE_ACCESS_LOGS'))

    if quiet_http_logs:
        for logger_name in ('werkzeug', 'gunicorn.access', 'uvicorn.access'):
            http_logger = logging.getLogger(logger_name)
            http_logger.handlers.clear()
            http_logger.propagate = False
            http_logger.disabled = True

    runtime_database_uri, boot_database_error = resolve_runtime_database_uri(app.root_path)
    app.config['SQLALCHEMY_DATABASE_URI'] = runtime_database_uri
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 280,
    }
    if boot_database_error:
        database_logger.warning(boot_database_error)
        app.config['DATABASE_ERROR'] = boot_database_error
    db.init_app(app)

    # --- PostgreSQL Configuration ---
    database_connected = False
    with app.app_context():
        try:
            start_time = time.time()
            db.create_all()
            db.session.execute(text('SELECT 1'))
            db.session.commit()
            connection_time = (time.time() - start_time) * 1000
            database_connected = True
            app.config['DATABASE_ERROR'] = ''
            database_logger.info(f"PostgreSQL connected in {connection_time:.2f}ms")
        except Exception as e:
            app.config['DATABASE_ERROR'] = str(e)
            database_logger.error(f"PostgreSQL connection failed: {type(e).__name__} - {str(e)}")
            log_error(database_logger, e)
            database_logger.warning("Continuing in limited mode without database connectivity")

    app.config['DATABASE_CONNECTED'] = database_connected

    bcrypt.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'login'
    app_logger.info("Flask extensions initialized (bcrypt, login_manager)")

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return User.objects(id=str(user_id)).first()
        except Exception as e:
            security_logger.error(f"Error loading user {user_id}: {str(e)}")
            return None

    # --- AI MODEL AND HELPER FUNCTIONS ---
    model_cache = {}
    chat_model_map = {
        "gemini-2.0-flash": GEMINI_MODEL_20,
        "gemini-2.5-flash": GEMINI_MODEL_25,
        "gemini-3-flash": GEMINI_MODEL_3
    }

    try:
        if GEMINI_API_KEY:
            app_logger.info("Configuring Gemini AI service...")
            genai.configure(api_key=GEMINI_API_KEY)
            app_logger.info("Gemini AI service configured successfully")
        else:
            app_logger.warning("Gemini API Key not provided, AI features disabled")
    except Exception as e:
        app_logger.error(f"Failed to configure Gemini AI: {str(e)}")
        log_error(app_logger, e)
        print(f"[WARN] Failed to configure Gemini AI: {e}")

    def get_ordered_model_names(preferred_model_key):
        """Return a deduplicated model fallback chain."""
        candidates = []

        preferred_name = chat_model_map.get(preferred_model_key, preferred_model_key)
        if preferred_name:
            candidates.append(preferred_name)

        candidates.extend([
            chat_model_map.get("gemini-3-flash"),
            chat_model_map.get("gemini-2.5-flash"),
            chat_model_map.get("gemini-2.0-flash"),
            "gemini-2.5-flash-lite"
        ])

        seen = set()
        ordered = []
        for name in candidates:
            if name and name not in seen:
                ordered.append(name)
                seen.add(name)
        return ordered

    def generate_with_gemini(prompt, preferred_model_key="gemini-3-flash"):
        """Generate text with model fallback across Gemini 3/2.5/2.0 flash families."""
        if not GEMINI_API_KEY:
            return None, None, "Gemini API key is missing. Set GEMINI_API_KEY in environment."

        errors = []
        for model_name in get_ordered_model_names(preferred_model_key):
            try:
                if model_name not in model_cache:
                    model_cache[model_name] = genai.GenerativeModel(model_name)
                response = model_cache[model_name].generate_content(prompt)
                output = getattr(response, "text", "")
                if output and output.strip():
                    return output.strip(), model_name, None
                errors.append(f"{model_name}: empty response")
            except Exception as exc:
                errors.append(f"{model_name}: {str(exc)}")

        return None, None, " | ".join(errors[:3]) if errors else "Unknown AI error"

    def analyze_transcript_with_ai(transcript_text, preferred_model_key=None):
        """Analyze meeting transcript using AI"""
        app_logger.info("Starting AI transcript analysis")
        start_time = time.time()
        
        # Ask the model for structured execution-ready output, not just extraction.
        prompt = f"""
        Analyze the following meeting transcript and return ONLY a valid JSON object. Do not add markdown.

        Required top-level keys:
        - "summary": string
        - "decisions": array of strings
        - "topics": array of strings
        - "action_items": array of objects
        - "ai_insight": array of strings
        - "suggested_execution_order": array of strings
        - "risks": array of strings

        Each object in "action_items" must include:
        - "task": string
        - "assignee": string ("Unassigned" if unknown)
        - "due_date": string ("Not specified" if unknown)
        - "priority": one of HIGH, MEDIUM, LOW (must not all be MEDIUM if urgency differs)
        - "status": one of Pending, In Progress, Done (default Pending)
        - "context": array of strings explaining why this task exists

        Quality rules:
        - Include concrete context, not generic text.
        - Respect urgency and dependency signals from transcript.
        - Avoid duplicated one-word lines in context (e.g., repeated "Medium").
        - Keep lists concise and actionable.

        Transcript:
        ---
        {transcript_text}
        ---

        JSON Analysis:
        """
        try:
            app_logger.debug(f"Sending {len(transcript_text)} characters to AI model")
            model_to_use = (preferred_model_key or GEMINI_ANALYSIS_MODEL or "gemini-2.5-flash").strip()
            ai_text, actual_model, error_message = generate_with_gemini(prompt, model_to_use)
            if error_message:
                app_logger.error(f"AI analysis failed: {error_message}")
                return {"error": error_message}
            
            analysis_time = (time.time() - start_time) * 1000
            app_logger.info(f"AI analysis completed in {analysis_time:.2f}ms")
            app_logger.debug(f"AI model used for analysis: {actual_model}")
            app_logger.debug(f"Raw AI response: {ai_text[:200]}...")
            
            print(f"Raw AI: {ai_text}")
            json_text = ai_text.strip().replace('```json', '').replace('```', '').strip()
            
            if not json_text:
                app_logger.error("AI returned empty response")
                return {"error": "AI empty response."}
            
            raw_result = json.loads(json_text)
            result = normalize_analysis_result(raw_result, transcript_text)
            app_logger.info(f"AI analysis successful: {len(result.get('action_items', []))} action items, {len(result.get('decisions', []))} decisions")
            return result
            
        except json.JSONDecodeError as e:
            app_logger.error(f"AI JSON parse error: {str(e)}")
            log_error(app_logger, e, {"raw_response": json_text[:500] if 'json_text' in locals() else ""})
            return {"error": f"AI JSON Parse Error: {e}. Raw: '{json_text if 'json_text' in locals() else 'N/A'}'"}
        except Exception as e:
            app_logger.error(f"AI analysis error: {str(e)}")
            log_error(app_logger, e)
            return {"error": f"AI Error: {e}"}

    def normalize_priority_value(priority):
        value = str(priority or '').strip().lower().replace('priority', '').strip()
        mapping = {
            'high': 'high',
            'critical': 'high',
            'urgent': 'high',
            'p0': 'high',
            'p1': 'high',
            'medium': 'medium',
            'normal': 'medium',
            'moderate': 'medium',
            'p2': 'medium',
            'low': 'low',
            'optional': 'low',
            'minor': 'low',
            'p3': 'low',
        }
        return mapping.get(value, '')

    def is_metadata_only_line(text):
        cleaned = str(text or '').strip().lower()
        if not cleaned:
            return True

        metadata_values = {
            'high', 'medium', 'low', 'pending', 'in progress', 'done',
            'priority', 'status', 'assignee', 'due', 'due date', 'context'
        }
        if cleaned in metadata_values:
            return True

        return bool(re.match(r'^(priority|status|assignee|due date|due|context)\s*[:\-]?$', cleaned))

    def tokenize_keywords(text):
        tokens = set(re.findall(r'[a-z]{3,}', str(text or '').lower()))
        stop_words = {
            'the', 'and', 'for', 'with', 'that', 'this', 'will', 'should', 'from', 'into',
            'task', 'tasks', 'item', 'items', 'start', 'work', 'working', 'update', 'create'
        }
        return {token for token in tokens if token not in stop_words}

    def task_domain_tags(text):
        value = str(text or '').lower()
        tags = set()
        if any(token in value for token in ['ui', 'ux', 'frontend', 'front-end', 'interface', 'design']):
            tags.add('ui')
        if any(token in value for token in ['backend', 'api', 'endpoint', 'service', 'server']):
            tags.add('backend')
        if any(token in value for token in ['database', 'db', 'schema', 'migration', 'model']):
            tags.add('database')
        if any(token in value for token in ['ai', 'llm', 'briefing', 'assistant logic', 'prompt']):
            tags.add('ai')
        return tags

    def extract_priority_hints_from_transcript(transcript_text):
        hints = []
        if not transcript_text:
            return hints

        matches = re.findall(r'([A-Za-z][A-Za-z\s\-/]{1,50})\s*(?:->|:|=)\s*(HIGH|MEDIUM|LOW)\b', transcript_text, flags=re.IGNORECASE)
        for subject, priority in matches:
            normalized_priority = normalize_priority_value(priority)
            subject_text = str(subject or '').strip()
            if not normalized_priority or not subject_text:
                continue
            hints.append({
                'subject': subject_text,
                'priority': normalized_priority,
                'tags': task_domain_tags(subject_text),
                'keywords': tokenize_keywords(subject_text),
            })
        return hints

    def resolve_priority_from_hints(task_text, priority_hints):
        if not priority_hints:
            return ''

        task_tags = task_domain_tags(task_text)
        task_keywords = tokenize_keywords(task_text)
        for hint in priority_hints:
            if task_tags and hint['tags'] and (task_tags & hint['tags']):
                return hint['priority']
            if task_keywords and hint['keywords'] and (task_keywords & hint['keywords']):
                return hint['priority']
        return ''

    def derive_context_from_transcript(task_text, transcript_text, decisions=None):
        if not transcript_text:
            return []

        task_keywords = tokenize_keywords(task_text)
        if not task_keywords:
            return []

        snippets = []
        for line in transcript_text.splitlines():
            cleaned = line.strip()
            if not cleaned:
                continue
            if ':' in cleaned:
                prefix, content = cleaned.split(':', 1)
                if len(prefix.strip()) <= 40:
                    cleaned = content.strip()
            for sentence in re.split(r'(?<=[.!?])\s+', cleaned):
                sentence = sentence.strip()
                if sentence:
                    snippets.append(sentence)

        scored = []
        for snippet in snippets:
            score = len(task_keywords & tokenize_keywords(snippet))
            if score > 0:
                scored.append((score, snippet))

        scored.sort(key=lambda item: item[0], reverse=True)
        context = []
        seen = set()
        for _, snippet in scored:
            lowered = snippet.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            context.append(snippet[:180])
            if len(context) >= 2:
                break

        for decision in decisions or []:
            decision_text = str(decision or '').strip()
            if not decision_text:
                continue
            if task_keywords & tokenize_keywords(decision_text):
                lowered = decision_text.lower()
                if lowered not in seen:
                    context.append(f"Decision: {decision_text}")
                    seen.add(lowered)
                if len(context) >= 3:
                    break

        return context

    def normalize_action_item(raw_item, transcript_text='', decisions=None, priority_hints=None):
        """Normalize mixed AI action-item payloads into a consistent object."""
        if isinstance(raw_item, dict):
            task = (raw_item.get('task') or raw_item.get('description') or '').strip()
            assignee = (raw_item.get('assignee') or '').strip()
            due_date = (raw_item.get('due_date') or raw_item.get('deadline') or '').strip()
            priority = (raw_item.get('priority') or '').strip()
            status = (raw_item.get('status') or '').strip()
            raw_context = raw_item.get('context')
            if raw_context is None:
                raw_context = raw_item.get('details') or raw_item.get('notes')
        else:
            task = str(raw_item or '').strip()
            assignee = ''
            due_date = ''
            priority = ''
            status = ''
            raw_context = []

        if not task or is_metadata_only_line(task):
            return None

        context_items = []
        if isinstance(raw_context, list):
            context_items = [str(item).strip() for item in raw_context if str(item).strip()]
        elif isinstance(raw_context, str):
            context_items = [
                line.strip('- ').strip()
                for line in re.split(r'[\n;]+', raw_context)
                if line and line.strip()
            ]

        unique_context = []
        seen = set()
        noisy_singletons = {'high', 'medium', 'low', 'pending', 'in progress', 'done'}
        for line in context_items:
            lowered = line.lower()
            if lowered in noisy_singletons:
                continue
            if lowered in seen:
                continue
            seen.add(lowered)
            unique_context.append(line)

        normalized_status = status.lower().replace(' ', '_') if status else 'pending'
        if normalized_status not in {'pending', 'in_progress', 'done'}:
            normalized_status = 'pending'

        if not unique_context:
            unique_context = derive_context_from_transcript(task, transcript_text, decisions)

        provided_priority = normalize_priority_value(priority)
        hinted_priority = resolve_priority_from_hints(task, priority_hints)

        return {
            'task': task,
            'assignee': assignee or 'Unassigned',
            'due_date': due_date or 'Not specified',
            'priority': provided_priority or hinted_priority,
            'status': normalized_status,
            'context': unique_context,
        }

    def parse_due_date_text(due_date_str):
        """Best-effort parser for due-date strings extracted by AI."""
        if not due_date_str:
            return None

        normalized = due_date_str.strip().lower()
        if normalized in ['n/a', 'na', 'not specified', 'none', 'unknown', '-']:
            return None

        now = datetime.utcnow()
        if 'today' in normalized:
            return now
        if 'tomorrow' in normalized:
            return now + timedelta(days=1)

        weekdays = {
            'monday': 0,
            'tuesday': 1,
            'wednesday': 2,
            'thursday': 3,
            'friday': 4,
            'saturday': 5,
            'sunday': 6,
        }
        for name, idx in weekdays.items():
            if name in normalized:
                days_ahead = (idx - now.weekday()) % 7
                if days_ahead == 0:
                    days_ahead = 7
                return now + timedelta(days=days_ahead)

        cleaned_input = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', due_date_str.strip(), flags=re.IGNORECASE)
        cleaned_input = cleaned_input.replace(',', '')
        cleaned_input = re.sub(r'\s+', ' ', cleaned_input).strip()

        supported_formats = [
            '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d',
            '%b %d, %Y', '%B %d, %Y', '%d %b %Y', '%d %B %Y',
            '%d %b', '%d %B', '%b %d', '%B %d'
        ]
        for fmt in supported_formats:
            try:
                parsed = datetime.strptime(cleaned_input, fmt)
                if '%Y' not in fmt:
                    parsed = parsed.replace(year=now.year)
                    if parsed < now - timedelta(days=30):
                        parsed = parsed.replace(year=now.year + 1)
                return parsed
            except ValueError:
                continue
        return None

    def infer_priority(task_text, due_date_obj, due_date_str, context_lines=None, provided_priority=''):
        normalized_input = (provided_priority or '').strip().lower()
        if normalized_input in {'high', 'medium', 'low'}:
            return normalized_input

        context_blob = ' '.join(context_lines or [])
        text = f"{task_text or ''} {due_date_str or ''} {context_blob}".lower()
        high_markers = ['urgent', 'asap', 'critical', 'blocker', 'immediately', 'high priority']
        low_markers = ['low priority', 'later', 'whenever', 'optional']

        score = 0

        if any(marker in text for marker in high_markers):
            score += 2
        if any(marker in text for marker in low_markers):
            score -= 2

        category_high = ['frontend', 'ui', 'backend', 'api', 'integration page']
        category_medium = ['database schema', 'schema', 'database', 'ai logic', 'briefing', 'morning brief']
        if any(marker in text for marker in category_high):
            score += 2
        elif any(marker in text for marker in category_medium):
            score += 1

        if due_date_obj:
            remaining = due_date_obj - datetime.utcnow()
            if remaining <= timedelta(days=1):
                score += 2
            elif remaining <= timedelta(days=3):
                score += 1

        if score >= 3:
            return 'high'
        if score <= -1:
            return 'low'
        return 'medium'

    def normalize_analysis_result(raw_result, transcript_text=''):
        """Normalize and enrich AI analysis output into a stable API contract."""
        if not isinstance(raw_result, dict):
            return {
                'summary': 'Summary not available.',
                'decisions': [],
                'topics': [],
                'action_items': [],
                'ai_insight': [],
                'suggested_execution_order': [],
                'risks': [],
            }

        summary = str(raw_result.get('summary') or '').strip() or 'Summary not available.'
        decisions = [str(item).strip() for item in (raw_result.get('decisions') or []) if str(item).strip()]
        topics = [str(item).strip() for item in (raw_result.get('topics') or []) if str(item).strip()]
        priority_hints = extract_priority_hints_from_transcript(transcript_text)

        normalized_items = []
        for raw_item in raw_result.get('action_items', []) or []:
            item = normalize_action_item(raw_item, transcript_text, decisions, priority_hints)
            if not item:
                continue

            due_obj = parse_due_date_text(item['due_date'])
            item['priority'] = infer_priority(
                item['task'],
                due_obj,
                item['due_date'],
                item.get('context') or [],
                item.get('priority') or ''
            )
            normalized_items.append(item)

        priority_rank = {'high': 0, 'medium': 1, 'low': 2}
        ordered_items = sorted(
            normalized_items,
            key=lambda item: (
                priority_rank.get(item.get('priority') or 'medium', 1),
                parse_due_date_text(item.get('due_date') or '') or datetime.max,
                item.get('task', '')
            )
        )

        # Keep schema work before backend/API and backend before AI when both exist.
        def enforce_order(before_tag, after_tag):
            before_idx = next((idx for idx, value in enumerate(ordered_items) if before_tag in task_domain_tags(value.get('task'))), None)
            after_idx = next((idx for idx, value in enumerate(ordered_items) if after_tag in task_domain_tags(value.get('task'))), None)
            if before_idx is None or after_idx is None:
                return
            if before_idx > after_idx:
                move_item = ordered_items.pop(before_idx)
                ordered_items.insert(after_idx, move_item)

        enforce_order('database', 'backend')
        enforce_order('backend', 'ai')

        ai_insight = [str(item).strip() for item in (raw_result.get('ai_insight') or []) if str(item).strip()]
        suggested_execution_order = [
            str(item).strip() for item in (raw_result.get('suggested_execution_order') or []) if str(item).strip()
        ]
        risks = [str(item).strip() for item in (raw_result.get('risks') or []) if str(item).strip()]

        if not ai_insight:
            high_count = sum(1 for item in ordered_items if item.get('priority') == 'high')
            ai_insight.append(f"{high_count} high-priority task(s) detected.")

            with_due = [item for item in ordered_items if parse_due_date_text(item.get('due_date') or '')]
            if with_due:
                earliest = min(with_due, key=lambda item: parse_due_date_text(item.get('due_date') or '') or datetime.max)
                ai_insight.append(f"Earliest deadline: {earliest['task']} ({earliest['due_date']}).")

            has_backend = any('backend' in item['task'].lower() or 'api' in item['task'].lower() for item in ordered_items)
            has_schema = any('schema' in item['task'].lower() or 'database' in item['task'].lower() for item in ordered_items)
            if has_backend and has_schema:
                ai_insight.append('Backend/API work depends on database schema readiness.')

            ui_tasks = [item for item in ordered_items if 'ui' in task_domain_tags(item.get('task'))]
            if ui_tasks:
                ai_insight.append(f"UI task is highly visible to users: {ui_tasks[0]['task']}.")

        if not suggested_execution_order:
            suggested_execution_order = [f"{index}. {item['task']}" for index, item in enumerate(ordered_items[:6], start=1)]

        if not risks:
            has_near_term_high = any(
                item.get('priority') == 'high' and parse_due_date_text(item.get('due_date') or '') and
                (parse_due_date_text(item.get('due_date') or '') - datetime.utcnow()) <= timedelta(days=2)
                for item in ordered_items
            )
            if has_near_term_high:
                risks.append('High-priority near-term tasks may impact release timelines if delayed.')

            has_backend = any('backend' in item['task'].lower() or 'api' in item['task'].lower() for item in ordered_items)
            has_schema = any('schema' in item['task'].lower() or 'database' in item['task'].lower() for item in ordered_items)
            if has_backend and has_schema:
                risks.append('Backend implementation may be blocked if database schema is delayed.')

            has_ui = any('ui' in task_domain_tags(item.get('task')) for item in ordered_items)
            if has_ui:
                risks.append('UI delay may impact release quality and stakeholder confidence.')

        return {
            'summary': summary,
            'decisions': decisions,
            'topics': topics,
            'action_items': ordered_items,
            'ai_insight': ai_insight,
            'suggested_execution_order': suggested_execution_order,
            'risks': risks,
            'task_board': {
                'title': 'Task Board (AI Enhanced)',
                'items': [
                    {
                        'task': item.get('task'),
                        'assignee': item.get('assignee'),
                        'due': item.get('due_date'),
                        'priority': str(item.get('priority') or 'medium').upper(),
                        'status': str(item.get('status') or 'pending').replace('_', ' ').title(),
                        'context': item.get('context') or [],
                    }
                    for item in ordered_items
                ],
            },
        }

    def extract_participants(transcript_text):
        participants = []
        seen = set()
        for line in (transcript_text or '').splitlines():
            if ':' not in line:
                continue
            candidate = line.split(':', 1)[0].strip()
            if not candidate or len(candidate) > 40:
                continue
            if len(candidate.split()) > 4:
                continue
            if not candidate[0].isalpha():
                continue
            lowered = candidate.lower()
            if lowered not in seen:
                seen.add(lowered)
                participants.append(candidate)
            if len(participants) >= 12:
                break
        return participants

    def save_meeting_intelligence(user, transcript_text, analysis_result):
        """Persist analyzed meeting intelligence and task board items."""
        if not analysis_result or analysis_result.get('error'):
            return None

        topics = analysis_result.get('topics') or []
        decisions = analysis_result.get('decisions') or []
        summary = (analysis_result.get('summary') or '').strip() or 'Meeting summary not available.'
        participants = extract_participants(transcript_text)

        title = None
        if topics and isinstance(topics, list) and topics[0]:
            title = str(topics[0]).strip()[:180]
        elif decisions and isinstance(decisions, list) and decisions[0]:
            title = str(decisions[0]).strip()[:180]
        if not title:
            title = f"Meeting {datetime.utcnow().strftime('%d %b %Y %H:%M')}"

        meeting = MeetingInsight(
            user_id=str(user.id),
            team_id=str(user.team_id) if user.team_id else None,
            title=title,
            transcript_excerpt=(transcript_text or '')[:2500],
            summary=summary,
            topics=[str(topic) for topic in topics if str(topic).strip()],
            decisions=[str(item) for item in decisions if str(item).strip()],
            participants=participants,
        )
        meeting.save()

        priority_hints = extract_priority_hints_from_transcript(transcript_text)
        for raw_item in analysis_result.get('action_items', []):
            item = normalize_action_item(raw_item, transcript_text, decisions, priority_hints)
            if not item:
                continue

            due_obj = parse_due_date_text(item['due_date'])
            WorkActionItem(
                user_id=str(user.id),
                meeting_id=str(meeting.id),
                task=item['task'],
                assignee=item['assignee'],
                due_date_str=item['due_date'],
                due_date=due_obj,
                priority=infer_priority(
                    item['task'],
                    due_obj,
                    item['due_date'],
                    item.get('context') or [],
                    item.get('priority') or ''
                ),
                status=item.get('status') or 'pending',
                context_notes='; '.join(item.get('context') or []),
                source='meeting_ai',
                updated_at=datetime.utcnow(),
            ).save()

        return meeting

    def build_personal_assistant_context(user, search_query='', board_status='all', board_priority='all', board_query=''):
        user_id = str(user.id)
        now = datetime.utcnow()

        task_qs = WorkActionItem.objects(user_id=user_id)
        pending_count = task_qs.filter(status='pending').count()
        in_progress_count = task_qs.filter(status='in_progress').count()
        done_count = task_qs.filter(status='done').count()
        overdue_count = WorkActionItem.objects(user_id=user_id, status__ne='done', due_date__lt=now).count()

        open_tasks = list(task_qs.filter(status__ne='done').order_by('due_date', '-created_at').limit(60))
        priority_rank = {'high': 0, 'medium': 1, 'low': 2}
        top_priority_tasks = sorted(
            open_tasks,
            key=lambda task: (
                priority_rank.get(task.priority or 'medium', 1),
                task.due_date or datetime.max,
                task.created_at or datetime.min,
            )
        )[:6]

        recent_meetings = MeetingInsight.objects(user_id=user_id).order_by('-created_at').limit(6)

        valid_statuses = {'all', 'pending', 'in_progress', 'done'}
        valid_priorities = {'all', 'high', 'medium', 'low'}
        selected_status = board_status if board_status in valid_statuses else 'all'
        selected_priority = board_priority if board_priority in valid_priorities else 'all'
        board_search = (board_query or '').strip()

        board_task_qs = WorkActionItem.objects(user_id=user_id)
        if selected_status != 'all':
            board_task_qs = board_task_qs.filter(status=selected_status)
        if selected_priority != 'all':
            board_task_qs = board_task_qs.filter(priority=selected_priority)
        if board_search:
            board_task_qs = board_task_qs.filter(
                Q(task__icontains=board_search) |
                Q(assignee__icontains=board_search) |
                Q(due_date_str__icontains=board_search) |
                Q(context_notes__icontains=board_search)
            )
        board_tasks = list(board_task_qs.order_by('status', 'due_date', '-created_at').limit(120))

        query = (search_query or '').strip()
        search_tasks = []
        search_meetings = []
        if query:
            search_tasks = WorkActionItem.objects(
                Q(user_id=user_id) & (
                    Q(task__icontains=query) |
                    Q(assignee__icontains=query) |
                    Q(context_notes__icontains=query)
                )
            ).order_by('-created_at').limit(12)

            search_meetings = MeetingInsight.objects(
                Q(user_id=user_id) & (
                    Q(title__icontains=query) |
                    Q(summary__icontains=query) |
                    Q(transcript_excerpt__icontains=query)
                )
            ).order_by('-created_at').limit(8)

        brief_lines = [
            f"{pending_count} pending tasks and {in_progress_count} in progress.",
        ]
        if overdue_count:
            brief_lines.append(f"{overdue_count} task(s) are overdue and need immediate attention.")
        else:
            brief_lines.append("No overdue tasks right now.")

        if top_priority_tasks:
            top_task = top_priority_tasks[0]
            due_text = top_task.due_date_str or 'No due date'
            brief_lines.append(f"Start with: {top_task.task} ({due_text}).")
        else:
            brief_lines.append("No open tasks. You are clear for now.")

        return {
            'assistant_stats': {
                'pending': pending_count,
                'in_progress': in_progress_count,
                'done': done_count,
                'overdue': overdue_count,
            },
            'assistant_brief_lines': brief_lines,
            'assistant_priority_tasks': top_priority_tasks,
            'assistant_board_tasks': board_tasks,
            'assistant_board_filters': {
                'status': selected_status,
                'priority': selected_priority,
                'query': board_search,
            },
            'assistant_recent_meetings': recent_meetings,
            'assistant_search_query': query,
            'assistant_search_tasks': search_tasks,
            'assistant_search_meetings': search_meetings,
        }

    def get_workspace_snapshot(user):
        """Build DB snapshot so the chat can answer account-specific questions."""
        team_name = None
        member_count = 0
        if user.team_id:
            team_obj = Team.objects(id=user.team_id).first()
            if team_obj:
                team_name = team_obj.name
                member_count = User.objects(team_id=user.team_id).count()

        trello_creds = TrelloCredentials.objects(user_id=str(user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(user.id)).first()
        recent_cards = TrelloCard.objects(user_id=str(user.id)).order_by('-created_at').limit(10)
        recent_meetings = MeetingInsight.objects(user_id=str(user.id)).order_by('-created_at').limit(12)
        assistant_context = build_personal_assistant_context(user)
        all_tasks = WorkActionItem.objects(user_id=str(user.id)).order_by('-updated_at', '-created_at').limit(40)

        return {
            "user_name": user.username,
            "user_email": user.email,
            "team": {
                "name": team_name,
                "member_count": member_count
            },
            "integrations": {
                "trello_connected": bool(trello_creds),
                "trello_account": trello_creds.trello_username if trello_creds else None,
                "jira_connected": bool(jira_creds),
                "jira_account": jira_creds.email if jira_creds else None,
                "jira_url": jira_creds.jira_url if jira_creds else None
            },
            "assistant": {
                "stats": assistant_context['assistant_stats'],
                "brief": assistant_context['assistant_brief_lines'],
                "priority_tasks": [
                    {
                        "task": task.task,
                        "priority": task.priority,
                        "status": task.status,
                        "due_date": task.due_date_str,
                        "context": task.context_notes,
                    }
                    for task in assistant_context['assistant_priority_tasks']
                ],
                "task_board": [
                    {
                        "task": task.task,
                        "assignee": task.assignee,
                        "priority": task.priority,
                        "status": task.status,
                        "due_date": task.due_date_str,
                        "context": task.context_notes,
                        "meeting_id": task.meeting_id,
                    }
                    for task in all_tasks
                ],
            },
            "recent_trello_cards": [
                {
                    "task": card.task_description,
                    "assignee": card.assignee,
                    "due_date": card.due_date_str
                }
                for card in recent_cards
            ],
            "recent_meetings": [
                {
                    "title": meeting.title,
                    "summary": meeting.summary,
                    "topics": meeting.topics or [],
                    "decisions": meeting.decisions or [],
                    "created_at": meeting.created_at.isoformat() if meeting.created_at else None
                }
                for meeting in recent_meetings
            ]
        }

    def get_recent_chat_history(user_id, limit=20):
        records = ChatMessage.objects(user_id=user_id).order_by('-created_at').limit(limit)
        ordered = list(records)[::-1]
        return [
            {
                "role": item.role,
                "content": item.content,
                "selected_model": item.selected_model,
                "actual_model": item.actual_model,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in ordered
        ]

    def save_chat_message(user_id, role, content, selected_model=None, actual_model=None):
        ChatMessage(
            user_id=user_id,
            role=role,
            content=content,
            selected_model=selected_model,
            actual_model=actual_model
        ).save()

    def detect_connection_intent(message_text):
        text = (message_text or "").lower()
        wants_connect = any(keyword in text for keyword in ["connect", "link", "integrate", "setup"])
        return {
            "show_jira": wants_connect and "jira" in text,
            "show_trello": wants_connect and "trello" in text
        }

    TASK_MATCH_STOPWORDS = {
        'the', 'a', 'an', 'to', 'for', 'and', 'or', 'of', 'in', 'on', 'with',
        'task', 'this', 'that', 'is', 'are', 'me', 'my', 'who', 'what', 'when',
        'where', 'why', 'how', 'do', 'does', 'did', 'should', 'start', 'work',
        'working', 'feature', 'please'
    }

    def normalize_task_text(value):
        return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s]', ' ', (value or '').lower())).strip()

    def extract_task_fragment_from_message(message_text):
        text = (message_text or '').strip()
        if not text:
            return ''

        quote_match = re.search(r'"([^"]{8,200})"|\'([^\']{8,200})\'', text)
        if quote_match:
            return (quote_match.group(1) or quote_match.group(2) or '').strip()

        lines = [line.strip(' -\t') for line in text.splitlines() if line.strip()]
        if len(lines) > 1:
            longest = max(lines[1:], key=len)
            if len(longest) >= 12:
                return longest

        lowered = text.lower()
        for marker in ['this', 'task', 'about', 'for']:
            if marker in lowered:
                idx = lowered.rfind(marker)
                candidate = text[idx + len(marker):].strip(' :.-')
                if len(candidate) >= 12:
                    return candidate

        return text

    def _token_overlap_score(query_text, task_text):
        q_tokens = [t for t in normalize_task_text(query_text).split() if t and t not in TASK_MATCH_STOPWORDS]
        t_tokens = [t for t in normalize_task_text(task_text).split() if t and t not in TASK_MATCH_STOPWORDS]
        if not q_tokens or not t_tokens:
            return 0.0

        q_set = set(q_tokens)
        t_set = set(t_tokens)
        overlap = len(q_set & t_set)
        denom = max(1, len(q_set))
        return overlap / denom

    def find_relevant_task_for_message(user_id, message_text):
        tasks = list(WorkActionItem.objects(user_id=user_id).order_by('-updated_at', '-created_at').limit(120))
        if not tasks:
            return None

        query = extract_task_fragment_from_message(message_text)
        query_norm = normalize_task_text(query)
        if not query_norm:
            pending_tasks = [task for task in tasks if (task.status or 'pending') != 'done']
            return pending_tasks[0] if pending_tasks else tasks[0]

        best_task = None
        best_score = -1.0
        for task in tasks:
            task_norm = normalize_task_text(task.task)
            if not task_norm:
                continue

            score = 0.0
            if query_norm in task_norm:
                score += 1.2
            if task_norm in query_norm:
                score += 0.8

            score += 0.9 * _token_overlap_score(query_norm, task_norm)
            score += 0.7 * SequenceMatcher(None, query_norm, task_norm).ratio()

            if score > best_score:
                best_score = score
                best_task = task

        return best_task if best_score >= 0.45 else None

    def infer_assigner_from_task(task, user):
        context = (task.context_notes or '').strip()
        if context:
            context_match = re.search(r'(?i)(?:assigned\s+by|owner)\s*[:\-]?\s*([A-Za-z][A-Za-z .\-]{1,60})', context)
            if context_match:
                return context_match.group(1).strip()

        if not task.meeting_id:
            return None

        meeting = MeetingInsight.objects(id=task.meeting_id, user_id=str(user.id)).first()
        if not meeting or not meeting.transcript_excerpt:
            return None

        task_tokens = [
            tok for tok in normalize_task_text(task.task).split()
            if tok and tok not in TASK_MATCH_STOPWORDS and len(tok) > 2
        ]
        if not task_tokens:
            return None

        best_speaker = None
        best_score = 0
        for raw_line in meeting.transcript_excerpt.splitlines():
            if ':' not in raw_line:
                continue
            speaker, body = raw_line.split(':', 1)
            speaker = speaker.strip()
            body = body.strip()
            if not speaker or len(speaker) > 40 or not body:
                continue

            body_norm = normalize_task_text(body)
            overlap = sum(1 for token in task_tokens if token in body_norm)
            ratio = SequenceMatcher(None, normalize_task_text(task.task), body_norm).ratio()
            score = overlap * 2 + int(ratio * 4)

            if re.search(r'\b(i\'ll|i will|let me|we\'ll|we will|assign|take this)\b', body.lower()):
                score += 2

            if score > best_score:
                best_score = score
                best_speaker = speaker

        return best_speaker if best_score >= 3 else None

    def format_task_detail_line(task):
        return (
            f"Priority: {(task.priority or 'medium').capitalize()} | "
            f"Due: {task.due_date_str or 'Not specified'} | "
            f"Status: {(task.status or 'pending').replace('_', ' ')}"
        )

    integration_pending_actions = {}

    def get_pending_action(user_id):
        pending = integration_pending_actions.get(user_id)
        if not pending:
            return None

        created_at = pending.get('created_at')
        if created_at and (datetime.utcnow() - created_at) > timedelta(minutes=15):
            integration_pending_actions.pop(user_id, None)
            return None
        return pending

    def set_pending_action(user_id, action_type, data=None):
        integration_pending_actions[user_id] = {
            'type': action_type,
            'data': data or {},
            'created_at': datetime.utcnow(),
        }

    def clear_pending_action(user_id):
        integration_pending_actions.pop(user_id, None)

    def mentions_trello(text):
        lowered = (text or '').lower()
        return bool(re.search(r'(trello\w*|trelloe\w*|treollo\w*|trell\w*o\w*)', lowered))

    def mentions_jira(text):
        lowered = (text or '').lower()
        return 'jira' in lowered

    def has_connect_intent(text):
        lowered = (text or '').lower()
        return any(token in lowered for token in ['connect', 'link', 'integrate', 'setup'])

    def extract_requested_priority(text):
        lowered = (text or '').lower()
        if 'high' in lowered:
            return 'high'
        if 'medium' in lowered:
            return 'medium'
        if 'low' in lowered:
            return 'low'
        return None

    def has_disconnect_intent(text):
        lowered = (text or '').lower()
        return any(token in lowered for token in ['disconnect', 'disconect', 'dsconnect', 'remove', 'unlink'])

    def is_affirmative(text):
        lowered = (text or '').strip().lower()
        if lowered in {'yes', 'y', 'confirm', 'confirmed', 'ok', 'okay', 'sure', 'do it'}:
            return True
        return bool(re.search(r'\b(yes|confirm|okay|ok|sure|do it)\b', lowered))

    def is_negative(text):
        lowered = (text or '').strip().lower()
        if lowered in {'no', 'n', 'cancel', 'stop', 'not now'}:
            return True
        return bool(re.search(r'\b(no|cancel|stop|not now)\b', lowered))

    def extract_trello_token(text):
        raw_text = text or ''

        def clean_candidate(value):
            return (value or '').strip().strip('"').strip("'").strip()

        # Prefer explicit "token ..." payload first.
        explicit = re.search(r'(?i)token(?:\s+below)?\s*[:=]?\s*([^\s]+)', raw_text)
        if explicit:
            return clean_candidate(explicit.group(1))

        # Fallback: accept only whole-token candidates, never partial substrings.
        tokens = [clean_candidate(token) for token in re.findall(r'[A-Za-z0-9_\-=]+', raw_text)]
        for token in tokens:
            if token and token.lower().startswith('atta'):
                return token
            if re.fullmatch(r'[a-fA-F0-9]{64}', token or ''):
                return token
        return ''

    def is_valid_trello_token_format(token):
        value = (token or '').strip()
        # Trello token formats can evolve; allow common safe characters and a practical length floor.
        if len(value) < 32:
            return False
        return bool(re.fullmatch(r'[A-Za-z0-9_\-=]+', value))

    def extract_jira_fields(text):
        payload = {'jira_url': '', 'jira_email': '', 'jira_token': ''}
        raw_text = text or ''

        url_match = re.search(r'(https://[\w\-.]+\.atlassian\.net)', raw_text, re.IGNORECASE)
        email_match = re.search(r'([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', raw_text)
        token_match = re.search(r'(?i)token\s*[:=]?\s*([^\s]+)', raw_text)
        fallback_token = re.search(r'(ATATT[^\s]+)', raw_text)

        if url_match:
            payload['jira_url'] = url_match.group(1).rstrip('/')
        if email_match:
            payload['jira_email'] = email_match.group(1).strip()
        if token_match:
            payload['jira_token'] = token_match.group(1).strip()
        elif fallback_token:
            payload['jira_token'] = fallback_token.group(1).strip()
        return payload

    def merge_jira_fields(base_data, new_data):
        merged = dict(base_data or {})
        for key in ['jira_url', 'jira_email', 'jira_token']:
            if new_data.get(key):
                merged[key] = new_data[key]
        return merged

    def missing_jira_fields(data):
        missing = []
        if not data.get('jira_url'):
            missing.append('Jira URL (https://your-company.atlassian.net)')
        if not data.get('jira_email'):
            missing.append('Company email used in Jira')
        if not data.get('jira_token'):
            missing.append('Jira API token')
        return missing

    def connect_jira_with_payload(user, payload):
        jira_url = payload.get('jira_url', '').strip().rstrip('/')
        jira_email = payload.get('jira_email', '').strip()
        jira_token = payload.get('jira_token', '').strip()

        if not jira_url.startswith('https://') or not jira_url.endswith('.atlassian.net'):
            return {'success': False, 'reply': 'Jira URL looks invalid. Use format: https://your-company.atlassian.net'}

        try:
            test_client = JIRA(server=jira_url, basic_auth=(jira_email, jira_token))
            test_client.server_info()

            creds = JiraCredentials.objects(user_id=str(user.id)).first()
            if not creds:
                creds = JiraCredentials(user_id=str(user.id))
            creds.jira_url = jira_url
            creds.email = jira_email
            creds.api_token = jira_token
            creds.save()

            send_integration_success_email(user.email, user.username, 'Jira')
            return {'success': True, 'reply': f'Jira connected successfully for {jira_email} at {jira_url}.'}
        except Exception as exc:
            return {'success': False, 'reply': f'Jira connection failed: {str(exc)}'}

    def connect_trello_with_token(user, token):
        if not TRELLO_API_KEY or not TRELLO_API_SECRET:
            return {'success': False, 'reply': 'Server-side Trello setup is incomplete. Admin must set TRELLO_API_KEY and TRELLO_API_SECRET.'}

        token_value = (token or '').strip()
        if not is_valid_trello_token_format(token_value):
            return {
                'success': False,
                'reply': (
                    'Trello token format looks invalid.\n'
                    'Please copy the full token from https://trello.com/app-key and send:\n'
                    'Connect Trello token YOUR_TRELLO_TOKEN'
                )
            }

        try:
            client = TrelloClient(api_key=TRELLO_API_KEY, api_secret=TRELLO_API_SECRET, token=token_value)
            member = client.get_member('me')

            creds = TrelloCredentials.objects(user_id=str(user.id)).first()
            if not creds:
                creds = TrelloCredentials(user_id=str(user.id))
            creds.token = token_value
            creds.trello_username = member.full_name
            creds.save()

            send_integration_success_email(user.email, user.username, 'Trello')
            return {'success': True, 'reply': f'Trello connected successfully as {member.full_name}.'}
        except Exception as exc:
            error_text = str(exc or '')
            if '401' in error_text or 'invalid app token' in error_text.lower():
                return {
                    'success': False,
                    'reply': (
                        'Trello token is invalid or expired (HTTP 401).\n'
                        'Generate a fresh user token from https://trello.com/app-key and send:\n'
                        'Connect Trello token YOUR_64_CHARACTER_TRELLO_TOKEN'
                    )
                }
            return {'success': False, 'reply': f'Trello connection failed: {error_text}'}

    def execute_assistant_command(user, message_text):
        """Handle high-value assistant commands directly without requiring model inference."""
        text = (message_text or '').strip()
        lower = text.lower()
        user_id = str(user.id)

        pending = get_pending_action(user_id)
        if pending:
            pending_type = pending.get('type')
            pending_data = pending.get('data') or {}

            if is_negative(lower):
                clear_pending_action(user_id)
                return {'reply': 'Cancelled. No integration changes were made.'}

            if pending_type == 'disconnect_trello':
                if is_affirmative(lower):
                    creds = TrelloCredentials.objects(user_id=user_id).first()
                    clear_pending_action(user_id)
                    if not creds:
                        return {'reply': 'Trello is already disconnected for your account.'}
                    creds.delete()
                    return {'reply': 'Trello has been disconnected successfully.'}
                return {'reply': 'Please reply YES to confirm Trello disconnect or NO to cancel.'}

            if pending_type == 'disconnect_jira':
                if is_affirmative(lower):
                    creds = JiraCredentials.objects(user_id=user_id).first()
                    clear_pending_action(user_id)
                    if not creds:
                        return {'reply': 'Jira is already disconnected for your account.'}
                    creds.delete()
                    return {'reply': 'Jira has been disconnected successfully.'}
                return {'reply': 'Please reply YES to confirm Jira disconnect or NO to cancel.'}

            if pending_type == 'connect_trello':
                token = extract_trello_token(text) or pending_data.get('trello_token', '')
                if not token:
                    return {'reply': 'Please send your Trello token to continue. Format: token YOUR_TRELLO_TOKEN'}

                result = connect_trello_with_token(user, token)
                if result.get('success'):
                    clear_pending_action(user_id)
                else:
                    next_data = {'trello_token': token} if is_valid_trello_token_format(token) else {}
                    set_pending_action(user_id, 'connect_trello', next_data)
                return {'reply': result.get('reply')}

            if pending_type == 'connect_jira':
                incoming_fields = extract_jira_fields(text)
                merged = merge_jira_fields(pending_data, incoming_fields)
                missing = missing_jira_fields(merged)
                if missing:
                    set_pending_action(user_id, 'connect_jira', merged)
                    missing_text = '\n'.join([f'- {item}' for item in missing])
                    return {
                        'reply': (
                            'Almost done. I still need:\n'
                            f'{missing_text}\n'
                            'Example: Connect Jira https://your-company.atlassian.net your-email@company.com token YOUR_API_TOKEN'
                        )
                    }

                result = connect_jira_with_payload(user, merged)
                if result.get('success'):
                    clear_pending_action(user_id)
                else:
                    set_pending_action(user_id, 'connect_jira', merged)
                return {'reply': result.get('reply')}

        # --- Integration controls ---
        if has_disconnect_intent(lower) and mentions_trello(lower):
            creds = TrelloCredentials.objects(user_id=user_id).first()
            if not creds:
                return {'reply': 'Trello is already disconnected for your account.'}
            account_name = creds.trello_username or 'Unknown account'
            set_pending_action(user_id, 'disconnect_trello', {'trello_username': account_name})
            return {
                'reply': (
                    f'Trello account detected: {account_name}.\n'
                    'Reply YES to disconnect it, or NO to cancel.'
                )
            }

        if has_disconnect_intent(lower) and mentions_jira(lower):
            creds = JiraCredentials.objects(user_id=user_id).first()
            if not creds:
                return {'reply': 'Jira is already disconnected for your account.'}
            set_pending_action(user_id, 'disconnect_jira', {
                'jira_email': creds.email,
                'jira_url': creds.jira_url,
            })
            return {
                'reply': (
                    f'Jira account detected: {creds.email} at {creds.jira_url}.\n'
                    'Reply YES to disconnect it, or NO to cancel.'
                )
            }

        if has_connect_intent(lower) and mentions_trello(lower):
            token = extract_trello_token(text)
            if not token:
                set_pending_action(user_id, 'connect_trello', {})
                return {
                    'reply': (
                        'To connect Trello, please send your token.\n'
                        'Example: Connect Trello token YOUR_TRELLO_TOKEN'
                    )
                }

            result = connect_trello_with_token(user, token)
            if not result.get('success'):
                next_data = {'trello_token': token} if is_valid_trello_token_format(token) else {}
                set_pending_action(user_id, 'connect_trello', next_data)
            return {'reply': result.get('reply')}

        if has_connect_intent(lower) and mentions_jira(lower):
            fields = extract_jira_fields(text)
            missing = missing_jira_fields(fields)
            if missing:
                set_pending_action(user_id, 'connect_jira', fields)
                missing_text = '\n'.join([f'- {item}' for item in missing])
                return {
                    'reply': (
                        'Got it. I can connect Jira for you. Please send:\n'
                        f'{missing_text}\n'
                        'Example: Connect Jira https://your-company.atlassian.net your-email@company.com token YOUR_API_TOKEN'
                    )
                }

            result = connect_jira_with_payload(user, fields)
            if not result.get('success'):
                set_pending_action(user_id, 'connect_jira', fields)
            return {'reply': result.get('reply')}

        # --- Work intelligence commands ---
        if any(token in lower for token in ['who assigned', 'assigned me', 'assigned this', 'who gave me', 'assigned by']):
            matched_task = find_relevant_task_for_message(user_id, text)
            if not matched_task:
                return {
                    'reply': (
                        'I could not match that to a saved task. '
                        'Please paste the exact task text, and I will identify assignee/assigner details.'
                    )
                }

            current_assignee = (matched_task.assignee or 'Unassigned').strip() or 'Unassigned'
            assigner = infer_assigner_from_task(matched_task, user)
            is_assigned_to_user = current_assignee.lower() == (user.username or '').lower()

            lines = [
                f"Task: {matched_task.task}",
                f"Current assignee: {current_assignee}",
                format_task_detail_line(matched_task),
            ]

            if assigner:
                lines.append(f"Most likely assigned by: {assigner}")
            else:
                lines.append('Assigned-by is not explicitly stored for this task history.')

            if not is_assigned_to_user and current_assignee.lower() != 'unassigned':
                lines.append(f"Note: this task is not assigned to you; it is assigned to {current_assignee}.")

            return {'reply': "\n".join(lines)}

        if any(token in lower for token in ['who is assigned', 'assignee', 'who owns', 'owner of task']):
            matched_task = find_relevant_task_for_message(user_id, text)
            if not matched_task:
                return {'reply': 'Please share the exact task text so I can identify the assignee.'}

            current_assignee = (matched_task.assignee or 'Unassigned').strip() or 'Unassigned'
            return {
                'reply': (
                    f"Task: {matched_task.task}\n"
                    f"Assignee: {current_assignee}\n"
                    f"{format_task_detail_line(matched_task)}"
                )
            }

        priority_requested = extract_requested_priority(lower)
        asks_priority_list = (
            priority_requested is not None and
            ('prio' in lower or 'priorit' in lower) and
            any(token in lower for token in ['list', 'show', 'all', 'my', 'tasks'])
        )
        if asks_priority_list:
            priority_tasks = WorkActionItem.objects(
                user_id=user_id,
                priority=priority_requested
            ).order_by('status', 'due_date', '-created_at').limit(40)

            if not priority_tasks:
                return {'reply': f'No {priority_requested} priority tasks found in your task board.'}

            lines = [f"Here are your {priority_requested} priority tasks ({priority_tasks.count()}):"]
            for idx, task in enumerate(priority_tasks, start=1):
                lines.append(
                    f"{idx}. {task.task} | Assignee: {task.assignee or 'Unassigned'} | "
                    f"Due: {task.due_date_str or 'Not specified'} | Status: {task.status.replace('_', ' ')}"
                )
            return {'reply': "\n".join(lines)}

        if any(phrase in lower for phrase in ['what should i do tomorrow', 'my priorities', 'priority tasks', 'what should i do']):
            context = build_personal_assistant_context(user)
            tasks = context['assistant_priority_tasks'][:5]
            if not tasks:
                return {'reply': 'You have no open tasks right now. Analyze a meeting transcript to generate your task board.'}

            lines = [f"Good morning {user.username}.", f"You have {context['assistant_stats']['pending']} pending tasks."]
            if context['assistant_stats']['overdue']:
                lines.append(f"{context['assistant_stats']['overdue']} task(s) are overdue and should be handled first.")

            due_soon = [
                task for task in tasks
                if task.due_date and (task.due_date - datetime.utcnow()) <= timedelta(days=2)
            ]
            if due_soon:
                lines.append('You have task(s) due soon:')
                for task in due_soon[:2]:
                    lines.append(f"- {task.task} (Due: {task.due_date_str or 'Not specified'})")

            lines.append('Recommended order:')
            for idx, task in enumerate(tasks, start=1):
                lines.append(
                    f"{idx}. {task.task} | Priority: {(task.priority or 'medium').capitalize()} | Due: {task.due_date_str or 'Not specified'} | Status: {task.status.replace('_', ' ')}"
                )

            task_names = [task.task.lower() for task in tasks]
            has_backend = any('backend' in name or 'api' in name for name in task_names)
            has_schema = any('schema' in name or 'database' in name for name in task_names)
            if has_backend and has_schema:
                lines.append('Suggestion: Start database schema first to unblock backend/API implementation.')

            return {'reply': "\n".join(lines)}

        if any(phrase in lower for phrase in ['my tasks', 'pending tasks', 'show tasks']):
            tasks = WorkActionItem.objects(user_id=user_id).order_by('status', 'due_date', '-created_at').limit(12)
            if not tasks:
                return {'reply': 'No tasks found yet. Analyze a meeting transcript to auto-generate tasks.'}

            lines = ['Here are your latest tasks:']
            for idx, task in enumerate(tasks, start=1):
                lines.append(
                    f"{idx}. {task.task} | {task.status.replace('_', ' ')} | Priority: {(task.priority or 'medium').capitalize()} | Due: {task.due_date_str or 'Not specified'}"
                )
                if task.context_notes:
                    lines.append(f"   Context: {task.context_notes}")
            return {'reply': "\n".join(lines)}

        if any(phrase in lower for phrase in ['my meetings', 'recent meetings', 'show meetings']):
            meetings = MeetingInsight.objects(user_id=user_id).order_by('-created_at').limit(8)
            if not meetings:
                return {'reply': 'No saved meetings found yet. Analyze a transcript and I will store it automatically.'}

            lines = ['Recent saved meetings:']
            for idx, meeting in enumerate(meetings, start=1):
                when = meeting.created_at.strftime('%d %b %Y %H:%M') if meeting.created_at else 'Unknown time'
                lines.append(f"{idx}. {meeting.title} ({when})")
            return {'reply': "\n".join(lines)}

        if any(phrase in lower for phrase in ['view my database', 'database status', 'my database']):
            meetings_count = MeetingInsight.objects(user_id=user_id).count()
            tasks_count = WorkActionItem.objects(user_id=user_id).count()
            pending = WorkActionItem.objects(user_id=user_id, status='pending').count()
            in_progress = WorkActionItem.objects(user_id=user_id, status='in_progress').count()
            done = WorkActionItem.objects(user_id=user_id, status='done').count()
            trello_connected = bool(TrelloCredentials.objects(user_id=user_id).first())
            jira_connected = bool(JiraCredentials.objects(user_id=user_id).first())

            reply = (
                'Database snapshot for your account:\n'
                f'- Meetings saved: {meetings_count}\n'
                f'- Tasks saved: {tasks_count} (pending: {pending}, in progress: {in_progress}, done: {done})\n'
                f'- Trello connected: {"Yes" if trello_connected else "No"}\n'
                f'- Jira connected: {"Yes" if jira_connected else "No"}'
            )
            return {'reply': reply}

        if lower.startswith('search '):
            query = text[7:].strip()
            if not query:
                return {'reply': 'Please provide a search query. Example: search client follow-up'}

            context = build_personal_assistant_context(user, query)
            task_results = list(context['assistant_search_tasks'])
            meeting_results = list(context['assistant_search_meetings'])

            if not task_results and not meeting_results:
                return {'reply': f'No results found for "{query}".'}

            lines = [f'Search results for "{query}":']
            if task_results:
                lines.append('Tasks:')
                for task in task_results[:6]:
                    lines.append(f"- {task.task} | {task.status.replace('_', ' ')}")
            if meeting_results:
                lines.append('Meetings:')
                for meeting in meeting_results[:5]:
                    lines.append(f"- {meeting.title}")

            return {'reply': "\n".join(lines)}

        return None

    def sanitize_chat_message_for_storage(message_text):
        """Redact secrets before storing chat history."""
        text = message_text or ''
        text = re.sub(r'([a-fA-F0-9]{64})', '[REDACTED_TOKEN]', text)
        text = re.sub(r'(?i)(token\s+)(\S+)', r'\1[REDACTED]', text)
        text = re.sub(r'(?i)(api[_\s-]?token\s*[:=]?\s*)(\S+)', r'\1[REDACTED]', text)
        return text

    def build_chat_prompt(user_message, history, snapshot):
        history_block = "\n".join([f"{item['role']}: {item['content']}" for item in history[-12:]])
        return f"""
You are an AI operations assistant for the AI Meeting Agent platform.

Rules:
- Be concise and action-oriented.
- Use the user's real name when relevant.
- You can answer questions using provided DB context.
- Handle broad user questions across tasks, meetings, priorities, deadlines, ownership, integrations, and planning.
- If the user asks natural-language variants, infer intent and answer directly without asking for rigid phrasing.
- For analytical questions, provide short reasoning and clear action recommendations.
- For list requests, return clean numbered lists.
- For comparison/tradeoff questions, give pros/cons and a final recommendation.
- For schedule/planning questions, propose an ordered execution plan from highest impact and urgency.
- You can execute direct workflow commands through chat command handling.
- Supported direct commands include:
    - connect my trello <token>
    - disconnect trello
    - connect jira <url> <email> token <api_token>
    - disconnect jira
    - my tasks / high priority tasks / my meetings / database status
- When asked about priorities, tomorrow plan, or missed commitments, use assistant stats and priority_tasks first.
- For assignment or ownership questions, use assistant.task_board assignee as source of truth.
- If assigner is not explicit in context, clearly say assigner is not stored and provide the current assignee + task details.
- Give ranked recommendations (what to do first, what is overdue, what can wait).
- Keep workflows inside chat whenever possible. Avoid telling user to navigate away unless absolutely required.
- If user asks integration actions without enough info, ask for missing token/URL/email in a single concise format.
- Never reveal secrets.
- Never perform actions outside the authenticated user's own data scope.
- Do not mention internal model names unless explicitly asked.

Workspace context JSON:
{json.dumps(snapshot, ensure_ascii=True)}

Recent conversation:
{history_block}

Current user message:
{user_message}

Assistant response:
"""

    def get_trello_client(user):
        """Get Trello client for user"""
        integration_logger.debug(f"Getting Trello client for user: {user.username}")
        try:
            creds = TrelloCredentials.objects(user_id=str(user.id)).first()
            if creds:
                integration_logger.info(f"Trello credentials found for user: {user.username}")
                return TrelloClient(api_key=TRELLO_API_KEY, api_secret=TRELLO_API_SECRET, token=creds.token)
            else:
                integration_logger.warning(f"No Trello credentials found for user: {user.username}")
                return None
        except Exception as e:
            integration_logger.error(f"Error getting Trello client for user {user.username}: {str(e)}")
            log_error(integration_logger, e)
            return None

    def send_summary_email(recipients, analysis):
        if not EMAIL_CONFIGURED:
            return "Email creds not configured."
        if not recipients:
            return "No recipients provided."

        subject = "Meeting Summary & Action Items"
        body = f"<h2>Summary</h2><p>{analysis.get('summary', 'N/A')}</p>"
        body += "<h2>Decisions</h2><ul>" + "".join([f"<li>{d}</li>" for d in analysis.get('decisions', [])]) + "</ul>"
        body += "<h2>Action Items</h2><ul>" + "".join([
                                                          f"<li><b>Task:</b> {i.get('task', 'N/A')} | <b>Assignee:</b> {i.get('assignee', 'N/A')} | <b>Due:</b> {i.get('due_date', 'N/A')}</li>"
                                                          for i in analysis.get('action_items', [])]) + "</ul>"

        failures = []
        for recipient in recipients:
            success, message = send_email(recipient, subject, body)
            if not success:
                failures.append(f"{recipient}: {message}")

        if failures:
            return f"Failed for {len(failures)} recipient(s): {'; '.join(failures)}"
        return f"Email sent successfully to {len(recipients)} recipient(s)."

    def create_trello_cards(client, board_id, list_id, action_items, user_id):
        try:
            target_list = client.get_list(list_id);
            cards_created = 0
            for item in action_items:
                card_name = item.get('task', 'Untitled Task')
                card_desc = f"Assignee: {item.get('assignee', 'N/A')}\nDue Date: {item.get('due_date', 'N/A')}"
                new_card = target_list.add_card(name=card_name, desc=card_desc);
                cards_created += 1
                db_card = TrelloCard(
                    card_id=new_card.id, 
                    user_id=str(user_id), 
                    board_id=board_id, 
                    list_id=list_id,
                    task_description=item.get('task', 'No desc'), 
                    assignee=item.get('assignee'),
                    due_date_str=item.get('due_date')
                )
                db_card.save()
            return f"{cards_created} Trello cards created."
        except Exception as e:
            return f"Failed Trello cards: {e}"

    def send_to_slack(team, analysis):
        if not team or not team.slack_webhook_url:
            return "Slack is not configured for this team."
        webhook_url = team.slack_webhook_url

        # --- SLACK BLOCKS RESTORED ---
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📝 Meeting Summary",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": analysis.get('summary', 'No summary available.')
                }
            },
            {
                "type": "divider"
            }
        ]
        # Add Decisions if any
        decisions = analysis.get('decisions')
        if decisions:
            blocks.extend([
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*⚖️ Key Decisions:*\n" + "\n".join([f"• {d}" for d in decisions])
                    }
                },
                {"type": "divider"}
            ])
        # Add Action Items if any
        action_items = analysis.get('action_items')
        if action_items:
            action_items_text = "*✅ Action Items:*\n"
            for item in action_items:
                action_items_text += f"• *Task:* {item.get('task', 'N/A')} | *Assignee:* {item.get('assignee', 'N/A')} | *Due:* {item.get('due_date', 'N/A')}\n"
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": action_items_text
                }
            })
        # -----------------------------

        payload = {"blocks": blocks}
        try:
            integration_logger.info(f"Sending Slack notification to team: {team.name}")
            integration_logger.debug(f"Slack payload blocks: {len(blocks)} blocks")
            
            response = requests.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()
            
            if response.text == 'ok':
                integration_logger.info("Slack notification sent successfully")
                log_integration_operation(integration_logger, "Slack", "send_notification", success=True)
                return True
            else:
                integration_logger.warning(f"Slack response not 'ok': {response.text}")
                log_integration_operation(integration_logger, "Slack", "send_notification", success=False, error=f"Response: {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            integration_logger.error(f"Slack request failed: {str(e)}")
            log_error(integration_logger, e)
            log_integration_operation(integration_logger, "Slack", "send_notification", success=False, error=str(e))
            print(f"[ERROR] Slack request failed: {e}")
            return False
        except Exception as e:
            integration_logger.error(f"Slack notification failed: {str(e)}")
            log_error(integration_logger, e)
            log_integration_operation(integration_logger, "Slack", "send_notification", success=False, error=str(e))
            print(f"[ERROR] Slack notification failed: {e}")
            return False

    # --- REQUEST/RESPONSE LOGGING MIDDLEWARE ---
    if app.config.get('ENABLE_ACCESS_LOGS', False):
        @app.before_request
        def before_request_logging():
            """Log all incoming requests"""
            request.start_time = time.time()
            log_request(access_logger, request, current_user if current_user.is_authenticated else None)
        
        @app.after_request
        def after_request_logging(response):
            """Log all outgoing responses"""
            if hasattr(request, 'start_time'):
                duration_ms = (time.time() - request.start_time) * 1000
                log_response(access_logger, request, response, duration_ms)
            return response
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        """Log all unhandled exceptions"""
        log_error(app_logger, e, {
            "path": request.path,
            "method": request.method,
            "user": current_user.username if current_user.is_authenticated else "Anonymous"
        })
        wants_json = (
            request.path.startswith('/api/') or
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            'application/json' in request.headers.get('Accept', '')
        )

        if wants_json:
            return jsonify({'success': False, 'error': 'Internal server error. Please try again.'}), 500

        flash('Something went wrong while processing your request.', 'error')
        try:
            return redirect(url_for('dashboard'))
        except Exception:
            return 'Internal server error', 500

    # --- JIRA HELPER FUNCTIONS (Unchanged) ---
    def get_jira_client(user):
        """Get Jira client for user"""
        integration_logger.debug(f"Getting Jira client for user: {user.username}")
        try:
            creds = JiraCredentials.objects(user_id=str(user.id)).first()
            if not creds:
                integration_logger.warning(f"No Jira credentials found for user: {user.username}")
                return None
            
            integration_logger.info(f"Connecting to Jira at {creds.jira_url}")
            jira_client = JIRA(server=creds.jira_url, basic_auth=(creds.email, creds.api_token))
            jira_client.server_info()
            integration_logger.info(f"Jira connection successful for user: {user.username}")
            return jira_client
        except JIRAError as e:
            integration_logger.error(f"Jira connection error for {user.username}: {e.text}")
            log_error(integration_logger, e)
            flash(f"Jira Connection Error: {e.text}", "danger")
            return None
        except Exception as e:
            integration_logger.error(f"Jira initialization error for {user.username}: {str(e)}")
            log_error(integration_logger, e)
            flash(f"Jira Initialization Error: {e}", "danger")
            return None

    def create_jira_issues(user, action_items, project_key, issue_type_name):
        jira_client = get_jira_client(user)
        if not jira_client: return "Failed to connect to Jira. Check credentials."
        if not action_items: return "No action items to create."
        if not project_key or not issue_type_name: return "Jira Project/Issue Type required."

        issues_created = 0;
        failed_items = []
        for item in action_items:
            summary = item.get('task', 'Untitled Meeting Task')
            description = f"Assignee: {item.get('assignee', 'Unassigned')}\nDue Date: {item.get('due_date', 'Not specified')}"
            issue_dict = {'project': {'key': project_key}, 'summary': summary, 'description': description,
                          'issuetype': {'name': issue_type_name}}
            try:
                new_issue = jira_client.create_issue(fields=issue_dict)
                issues_created += 1
            except JIRAError as e:
                failed_items.append(summary)
            except Exception as e:
                failed_items.append(summary)

        if not failed_items:
            return f"{issues_created} Jira issues created in {project_key}."
        else:
            return f"Created {issues_created} issues. Failed for: {', '.join(failed_items)}."

    def extract_plain_text_bytes(file_bytes):
        for encoding in ['utf-8', 'utf-16', 'latin-1', 'cp1252']:
            try:
                return file_bytes.decode(encoding, errors='ignore')
            except Exception:
                continue
        return ''

    def clean_extracted_text(text):
        cleaned = (text or '').replace('\x00', ' ')
        cleaned = re.sub(r'\r\n?', '\n', cleaned)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned)
        return cleaned.strip()

    def count_words(text):
        return len(re.findall(r'\S+', text or ''))

    def trim_to_max_words(text, max_words=MAX_TRANSCRIPT_WORDS):
        tokens = re.findall(r'\S+', text or '')
        if len(tokens) <= max_words:
            return (text or '').strip(), False
        trimmed = ' '.join(tokens[:max_words]).strip()
        return trimmed, True

    def extract_transcript_from_upload(uploaded_file):
        if not uploaded_file or not uploaded_file.filename:
            return '', None

        filename = uploaded_file.filename.strip()
        _, ext = os.path.splitext(filename.lower())
        if ext not in ALLOWED_TRANSCRIPT_EXTENSIONS:
            return '', 'Unsupported file type. Please upload TXT, DOC, DOCX, or PDF.'

        file_bytes = uploaded_file.read() or b''
        uploaded_file.seek(0)

        if len(file_bytes) > MAX_TRANSCRIPT_FILE_SIZE:
            return '', 'File is too large. Maximum allowed size is 10MB.'
        if not file_bytes:
            return '', 'Uploaded file is empty.'

        try:
            extracted_text = ''

            if ext in {'.txt', '.doc'}:
                # Legacy .doc may be binary; best-effort text extraction still helps for many exports.
                extracted_text = extract_plain_text_bytes(file_bytes)

            elif ext == '.docx':
                try:
                    from docx import Document
                except Exception:
                    return '', 'DOCX support is not installed on server. Please install python-docx.'

                document = Document(BytesIO(file_bytes))
                paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text and paragraph.text.strip()]
                extracted_text = '\n'.join(paragraphs)

            elif ext == '.pdf':
                try:
                    from pypdf import PdfReader
                except Exception:
                    return '', 'PDF support is not installed on server. Please install pypdf.'

                reader = PdfReader(BytesIO(file_bytes))
                pages = []
                for page in reader.pages:
                    pages.append((page.extract_text() or '').strip())
                extracted_text = '\n'.join([page for page in pages if page])

            normalized_text = clean_extracted_text(extracted_text)
            if not normalized_text:
                return '', 'Could not extract readable text from the uploaded file.'

            return normalized_text, None
        except Exception as exc:
            app_logger.error(f"File extraction failed for {filename}: {str(exc)}")
            return '', f'Failed to extract file text: {str(exc)}'

    # --- ROUTES ---
    @app.route('/')
    def landing():
        """Landing page for both guests and authenticated users."""
        return render_template('landing.html')
    
    @app.route('/home')
    @app.route('/dashboard')
    @login_required
    def dashboard():
        assistant_query = (request.args.get('assistant_q') or '').strip()
        board_status = (request.args.get('board_status') or 'all').strip().lower()
        board_priority = (request.args.get('board_priority') or 'all').strip().lower()
        board_query = (request.args.get('task_q') or '').strip()
        trello_client = get_trello_client(current_user)
        boards = trello_client.list_boards() if trello_client else []
        
        # Get user's integration credentials for the template
        trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        
        # Get user's team data if they belong to a team
        team_data = None
        if current_user.team_id:
            team_data = Team.objects(id=current_user.team_id).first()

        assistant_context = build_personal_assistant_context(
            current_user,
            assistant_query,
            board_status,
            board_priority,
            board_query,
        )

        next_params = {}
        if assistant_query:
            next_params['assistant_q'] = assistant_query
        if board_status and board_status != 'all':
            next_params['board_status'] = board_status
        if board_priority and board_priority != 'all':
            next_params['board_priority'] = board_priority
        if board_query:
            next_params['task_q'] = board_query
        assistant_board_next_url = url_for('dashboard', **next_params) + '#assistant-board'
        
        return render_template(
            'dashboard.html',
            trello_boards=boards,
            trello_credentials=trello_creds,
            jira_credentials=jira_creds,
            team_data=team_data,
            assistant_board_next_url=assistant_board_next_url,
            **assistant_context
        )

    def is_ajax_request():
        return (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            'application/json' in request.headers.get('Accept', '') or
            request.is_json or
            request.args.get('ajax') == '1'
        )

    def normalize_task_status(value):
        text = str(value or '').strip().lower().replace('-', '_').replace(' ', '_')
        mapping = {
            'pending': 'pending',
            'in_progress': 'in_progress',
            'progress': 'in_progress',
            'inprogress': 'in_progress',
            'done': 'done',
            'complete': 'done',
            'completed': 'done',
        }
        return mapping.get(text, '')

    def normalize_task_priority(value):
        text = str(value or '').strip().lower().replace('priority', '').strip()
        mapping = {
            'high': 'high',
            'critical': 'high',
            'urgent': 'high',
            'medium': 'medium',
            'normal': 'medium',
            'low': 'low',
            'minor': 'low',
        }
        return mapping.get(text, '')

    def serialize_task(task):
        return {
            'id': str(task.id),
            'meeting_id': task.meeting_id,
            'task': task.task,
            'assignee': task.assignee or '',
            'due_date_str': task.due_date_str or '',
            'priority': task.priority or 'medium',
            'status': task.status or 'pending',
            'context_notes': task.context_notes or '',
            'source': task.source or 'meeting_ai',
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
        }

    def serialize_meeting(meeting):
        return {
            'id': str(meeting.id),
            'title': meeting.title,
            'summary': meeting.summary,
            'topics': meeting.topics or [],
            'decisions': meeting.decisions or [],
            'created_at': meeting.created_at.isoformat() if meeting.created_at else None,
        }

    def build_dashboard_payload(user):
        user_id = str(user.id)
        assistant_context = build_personal_assistant_context(user)

        tasks = list(WorkActionItem.objects(user_id=user_id).order_by('-updated_at', '-created_at').limit(200))
        meetings = list(MeetingInsight.objects(user_id=user_id).order_by('-created_at').limit(20))

        high_priority_count = sum(1 for task in tasks if (task.priority or 'medium') == 'high')

        return {
            'stats': {
                'priority': high_priority_count,
                'pending': assistant_context['assistant_stats']['pending'],
                'in_progress': assistant_context['assistant_stats']['in_progress'],
                'completed': assistant_context['assistant_stats']['done'],
                'overdue': assistant_context['assistant_stats']['overdue'],
                'total': len(tasks),
            },
            'highlights': assistant_context.get('assistant_brief_lines') or [],
            'priority_tasks': [serialize_task(task) for task in assistant_context.get('assistant_priority_tasks', [])],
            'tasks': [serialize_task(task) for task in tasks],
            'meetings': [serialize_meeting(meeting) for meeting in meetings],
        }

    @app.route('/api/dashboard/context', methods=['GET'])
    @login_required
    def api_dashboard_context():
        return jsonify({'success': True, 'data': build_dashboard_payload(current_user)})

    @app.route('/api/dashboard/task', methods=['POST'])
    @login_required
    def api_dashboard_create_task():
        payload = request.get_json(silent=True) if request.is_json else request.form
        payload = payload or {}

        task_text = (payload.get('task') or '').strip()
        if not task_text:
            return jsonify({'success': False, 'error': 'Task title is required.'}), 400

        priority = normalize_task_priority(payload.get('priority')) or 'medium'
        status = normalize_task_status(payload.get('status')) or 'pending'

        due_date_str = (payload.get('due_date_str') or payload.get('due_date') or '').strip()
        due_date_obj = parse_due_date_text(due_date_str) if due_date_str else None

        task = WorkActionItem(
            user_id=str(current_user.id),
            task=task_text[:500],
            assignee=(payload.get('assignee') or '').strip()[:150],
            due_date_str=due_date_str[:120],
            due_date=due_date_obj,
            priority=priority,
            status=status,
            context_notes=(payload.get('context_notes') or '').strip(),
            source='manual_dashboard',
            updated_at=datetime.utcnow(),
        )
        task.save()

        return jsonify({
            'success': True,
            'message': 'Task created successfully.',
            'task': serialize_task(task),
            'stats': build_dashboard_payload(current_user)['stats']
        })

    @app.route('/api/dashboard/task/<task_id>', methods=['PATCH', 'PUT'])
    @login_required
    def api_dashboard_update_task(task_id):
        payload = request.get_json(silent=True) if request.is_json else request.form
        payload = payload or {}

        task = WorkActionItem.objects(id=task_id, user_id=str(current_user.id)).first()
        if not task:
            return jsonify({'success': False, 'error': 'Task not found.'}), 404

        if 'task' in payload:
            task_text = (payload.get('task') or '').strip()
            if not task_text:
                return jsonify({'success': False, 'error': 'Task title is required.'}), 400
            task.task = task_text[:500]

        if 'assignee' in payload:
            task.assignee = (payload.get('assignee') or '').strip()[:150]

        if 'context_notes' in payload:
            task.context_notes = (payload.get('context_notes') or '').strip()

        if 'priority' in payload:
            next_priority = normalize_task_priority(payload.get('priority'))
            if not next_priority:
                return jsonify({'success': False, 'error': 'Invalid priority value.'}), 400
            task.priority = next_priority

        if 'status' in payload:
            next_status = normalize_task_status(payload.get('status'))
            if not next_status:
                return jsonify({'success': False, 'error': 'Invalid status value.'}), 400
            task.status = next_status

        if 'due_date_str' in payload or 'due_date' in payload:
            next_due = (payload.get('due_date_str') or payload.get('due_date') or '').strip()
            task.due_date_str = next_due[:120]
            task.due_date = parse_due_date_text(next_due) if next_due else None

        task.updated_at = datetime.utcnow()
        task.save()

        return jsonify({
            'success': True,
            'message': 'Task updated successfully.',
            'task': serialize_task(task),
            'stats': build_dashboard_payload(current_user)['stats']
        })

    @app.route('/api/dashboard/task/<task_id>', methods=['DELETE'])
    @login_required
    def api_dashboard_delete_task(task_id):
        task = WorkActionItem.objects(id=task_id, user_id=str(current_user.id)).first()
        if not task:
            return jsonify({'success': False, 'error': 'Task not found.'}), 404

        task.delete()

        return jsonify({
            'success': True,
            'message': 'Task deleted successfully.',
            'task_id': task_id,
            'stats': build_dashboard_payload(current_user)['stats']
        })

    @app.route('/api/dashboard/meeting/<meeting_id>', methods=['DELETE'])
    @login_required
    def api_dashboard_delete_meeting(meeting_id):
        meeting = MeetingInsight.objects(id=meeting_id, user_id=str(current_user.id)).first()
        if not meeting:
            return jsonify({'success': False, 'error': 'Meeting summary not found.'}), 404

        meeting.delete()

        return jsonify({
            'success': True,
            'message': 'Meeting summary deleted successfully.',
            'meeting_id': meeting_id,
        })

    @app.route('/assistant/task/<task_id>/status', methods=['POST'])
    @login_required
    def update_assistant_task_status(task_id):
        wants_json = is_ajax_request()
        new_status = (request.form.get('status') or '').strip().lower()
        next_url = request.form.get('next') or url_for('dashboard')
        valid_statuses = {'pending', 'in_progress', 'done'}

        if new_status not in valid_statuses:
            if wants_json:
                return jsonify({'success': False, 'error': 'Invalid task status.'}), 400
            flash('Invalid task status.', 'error')
            return redirect(next_url)

        task = WorkActionItem.objects(id=task_id, user_id=str(current_user.id)).first()
        if not task:
            if wants_json:
                return jsonify({'success': False, 'error': 'Task not found.'}), 404
            flash('Task not found.', 'error')
            return redirect(next_url)

        task.status = new_status
        task.updated_at = datetime.utcnow()
        task.completed_at = datetime.utcnow() if new_status == 'done' else None
        task.save()

        if wants_json:
            return jsonify({
                'success': True,
                'message': 'Task board updated successfully.',
                'task': {
                    'id': str(task.id),
                    'task': task.task,
                    'assignee': task.assignee,
                    'due_date_str': task.due_date_str,
                    'priority': task.priority,
                    'status': task.status,
                    'context_notes': task.context_notes,
                }
            })

        flash('Task board updated successfully.', 'success')
        return redirect(next_url)

    @app.route('/assistant/task/<task_id>/priority', methods=['POST'])
    @login_required
    def update_assistant_task_priority(task_id):
        wants_json = is_ajax_request()
        new_priority = (request.form.get('priority') or '').strip().lower()
        next_url = request.form.get('next') or url_for('dashboard')
        valid_priorities = {'high', 'medium', 'low'}

        if new_priority not in valid_priorities:
            if wants_json:
                return jsonify({'success': False, 'error': 'Invalid task priority.'}), 400
            flash('Invalid task priority.', 'error')
            return redirect(next_url)

        task = WorkActionItem.objects(id=task_id, user_id=str(current_user.id)).first()
        if not task:
            if wants_json:
                return jsonify({'success': False, 'error': 'Task not found.'}), 404
            flash('Task not found.', 'error')
            return redirect(next_url)

        task.priority = new_priority
        task.updated_at = datetime.utcnow()
        task.save()

        if wants_json:
            return jsonify({
                'success': True,
                'message': 'Task priority updated.',
                'task': {
                    'id': str(task.id),
                    'task': task.task,
                    'assignee': task.assignee,
                    'due_date_str': task.due_date_str,
                    'priority': task.priority,
                    'status': task.status,
                    'context_notes': task.context_notes,
                }
            })

        flash('Task priority updated.', 'success')
        return redirect(next_url)

    @app.route('/assistant/task/<task_id>/delete', methods=['POST'])
    @login_required
    def delete_assistant_task(task_id):
        wants_json = is_ajax_request()
        next_url = request.form.get('next') or url_for('dashboard')
        task = WorkActionItem.objects(id=task_id, user_id=str(current_user.id)).first()

        if not task:
            if wants_json:
                return jsonify({'success': False, 'error': 'Task not found.'}), 404
            flash('Task not found.', 'error')
            return redirect(next_url)

        task.delete()

        if wants_json:
            return jsonify({'success': True, 'message': 'Task deleted successfully.', 'task_id': task_id})

        flash('Task deleted successfully.', 'success')
        return redirect(next_url)

    @app.route('/assistant/meeting/<meeting_id>/update', methods=['POST'])
    @login_required
    def update_assistant_meeting(meeting_id):
        wants_json = is_ajax_request()
        next_url = request.form.get('next') or url_for('dashboard')
        meeting = MeetingInsight.objects(id=meeting_id, user_id=str(current_user.id)).first()

        if not meeting:
            if wants_json:
                return jsonify({'success': False, 'error': 'Meeting not found.'}), 404
            flash('Meeting not found.', 'error')
            return redirect(next_url)

        new_title = (request.form.get('title') or '').strip()
        new_summary = (request.form.get('summary') or '').strip()

        if not new_title:
            if wants_json:
                return jsonify({'success': False, 'error': 'Meeting title is required.'}), 400
            flash('Meeting title is required.', 'error')
            return redirect(next_url)
        if not new_summary:
            if wants_json:
                return jsonify({'success': False, 'error': 'Meeting summary is required.'}), 400
            flash('Meeting summary is required.', 'error')
            return redirect(next_url)

        meeting.title = new_title[:200]
        meeting.summary = new_summary
        meeting.save()

        if wants_json:
            return jsonify({
                'success': True,
                'message': 'Meeting updated successfully.',
                'meeting': {
                    'id': str(meeting.id),
                    'title': meeting.title,
                    'summary': meeting.summary,
                    'created_at': meeting.created_at.strftime('%d %b %Y, %I:%M %p') if meeting.created_at else ''
                }
            })

        flash('Meeting updated successfully.', 'success')
        return redirect(next_url)

    @app.route('/assistant/meeting/<meeting_id>/delete', methods=['POST'])
    @login_required
    def delete_assistant_meeting(meeting_id):
        wants_json = is_ajax_request()
        next_url = request.form.get('next') or url_for('dashboard')
        meeting = MeetingInsight.objects(id=meeting_id, user_id=str(current_user.id)).first()

        if not meeting:
            if wants_json:
                return jsonify({'success': False, 'error': 'Meeting not found.'}), 404
            flash('Meeting not found.', 'error')
            return redirect(next_url)

        deleted_tasks = WorkActionItem.objects(meeting_id=meeting_id, user_id=str(current_user.id)).count()
        WorkActionItem.objects(meeting_id=meeting_id, user_id=str(current_user.id)).delete()
        meeting.delete()

        if wants_json:
            return jsonify({
                'success': True,
                'message': 'Meeting and related tasks deleted.',
                'meeting_id': meeting_id,
                'deleted_tasks': deleted_tasks
            })

        flash('Meeting and related tasks deleted.', 'success')
        return redirect(next_url)

    # --- GET_LISTS FUNCTION RESTORED ---
    @app.route('/get_lists/<board_id>')
    @login_required
    def get_lists(board_id):
        trello_client = get_trello_client(current_user)
        if not trello_client:
            return jsonify({"error": "Trello not connected"}), 400
        try:
            board = trello_client.get_board(board_id)
            lists = [{"id": lst.id, "name": lst.name} for lst in board.list_lists()]
            return jsonify(lists)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # ----------------------------------

    # --- JIRA DATA ROUTES (Unchanged) ---
    @app.route('/get_jira_projects')
    @login_required
    def get_jira_projects():
        jira_client = get_jira_client(current_user)
        if not jira_client: return jsonify({"error": "Jira not connected or credentials invalid."}), 400
        try:
            projects = jira_client.projects()
            project_list = [{"key": p.key, "name": p.name} for p in projects]
            return jsonify(project_list)
        except JIRAError as e:
            return jsonify({"error": f"Jira API Error: {e.text}"}), 500
        except Exception as e:
            return jsonify({"error": "Could not fetch Jira projects."}), 500

    @app.route('/get_jira_issue_types/<project_key>')
    @login_required
    def get_jira_issue_types(project_key):
        jira_client = get_jira_client(current_user)
        if not jira_client: return jsonify({"error": "Jira not connected or credentials invalid."}), 400
        try:
            project = jira_client.project(project_key)
            issue_types = project.issueTypes
            issue_type_list = [{"id": it.id, "name": it.name, "subtask": it.subtask} for it in issue_types]
            return jsonify(issue_type_list)
        except JIRAError as e:
            return jsonify({"error": f"Jira API Error: {e.text}"}), 500
        except Exception as e:
            return jsonify({"error": f"Could not fetch issue types for {project_key}."}), 500

    @app.route('/api/transcript/extract-file', methods=['POST'])
    @login_required
    def extract_transcript_preview():
        uploaded_file = request.files.get('file')
        extracted_text, file_error = extract_transcript_from_upload(uploaded_file)

        if file_error:
            return jsonify({'success': False, 'error': file_error}), 400

        original_word_count = count_words(extracted_text)
        trimmed_text, was_trimmed = trim_to_max_words(extracted_text, MAX_TRANSCRIPT_WORDS)

        return jsonify({
            'success': True,
            'text': trimmed_text,
            'word_count': min(original_word_count, MAX_TRANSCRIPT_WORDS),
            'original_word_count': original_word_count,
            'max_words': MAX_TRANSCRIPT_WORDS,
            'truncated': was_trimmed,
            'filename': uploaded_file.filename if uploaded_file else ''
        })

    @app.route('/api/auth/status', methods=['GET'])
    def auth_status():
        return jsonify({
            'success': True,
            'authenticated': bool(current_user.is_authenticated),
            'user': {
                'id': str(current_user.id),
                'username': current_user.username,
                'email': current_user.email,
            } if current_user.is_authenticated else None
        })

    @app.route('/api/health/db', methods=['GET'])
    def db_health_status():
        return jsonify({
            'success': True,
            'connected': bool(app.config.get('DATABASE_CONNECTED', False)),
            'database_url_set': bool(DATABASE_URL),
            'error': app.config.get('DATABASE_ERROR', '')
        })

    @app.route('/api/auth/register', methods=['POST'])
    def api_auth_register():
        if current_user.is_authenticated:
            return jsonify({'success': True, 'redirect': url_for('dashboard')})

        if not app.config.get('DATABASE_CONNECTED', False):
            return jsonify({
                'success': False,
                'message': 'Database is temporarily unavailable. Verify DATABASE_URL/POSTGRES_URL in Vercel settings.'
            }), 503

        data = request.get_json(silent=True) or {}
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        confirm_password = (data.get('confirm_password') or '').strip()
        terms_accepted = bool(data.get('terms', False))

        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'All fields are required.'}), 400
        if len(username) < 3:
            return jsonify({'success': False, 'message': 'Username must be at least 3 characters long.'}), 400
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters long.'}), 400
        if not confirm_password:
            return jsonify({'success': False, 'message': 'Please confirm your password.'}), 400
        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match.'}), 400
        if not terms_accepted:
            return jsonify({'success': False, 'message': 'You must agree to the Terms of Service and Privacy Policy.'}), 400

        if User.objects(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists. Please choose another.'}), 400
        if User.objects(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered. Please use another email or try logging in.'}), 400

        try:
            user = User(username=username, email=email)
            user.password = password
            user.save()

            otp_code = user.generate_verification_token()
            try:
                send_email_verification(email, username, otp_code)
            except Exception as email_error:
                app_logger.warning(f"API register verification email failed for {email}: {str(email_error)}")

            return jsonify({
                'success': True,
                'message': 'Account created successfully. Please verify your email.',
                'redirect': url_for('verify_email', email=email),
            })
        except Exception as exc:
            app_logger.error(f"API register failed: {str(exc)}")
            return jsonify({'success': False, 'message': 'An unexpected error occurred during registration. Please try again.'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def api_auth_login():
        if current_user.is_authenticated:
            return jsonify({'success': True, 'redirect': url_for('dashboard')})

        if not app.config.get('DATABASE_CONNECTED', False):
            return jsonify({
                'success': False,
                'message': 'Database is temporarily unavailable. Verify DATABASE_URL/POSTGRES_URL in Vercel settings.'
            }), 503

        data = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        remember = bool(data.get('remember', False))

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required.'}), 400

        user = User.objects(email=email).first()
        if not user or not user.verify_password(password):
            return jsonify({'success': False, 'message': 'Invalid email or password. Please try again.'}), 401

        if not user.is_verified:
            try:
                otp_code = user.generate_verification_token()
                send_email_verification(user.email, user.username, otp_code)
            except Exception as email_error:
                app_logger.warning(f"API login verification resend failed for {user.email}: {str(email_error)}")

            return jsonify({
                'success': False,
                'message': 'Please verify your email before logging in.',
                'redirect': url_for('verify_email', email=email),
                'requires_verification': True,
            }), 403

        login_user(user, remember=remember, duration=None)
        return jsonify({
            'success': True,
            'message': f'Welcome back, {user.username}!',
            'redirect': url_for('dashboard'),
        })

    @app.route('/api/auth/forgot-password', methods=['POST'])
    def api_auth_forgot_password():
        if not app.config.get('DATABASE_CONNECTED', False):
            return jsonify({
                'success': False,
                'message': 'Database is temporarily unavailable. Please try again after connection is restored.'
            }), 503

        data = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()

        if not email:
            return jsonify({'success': False, 'message': 'Email is required.'}), 400

        user = User.objects(email=email).first()
        if user:
            try:
                otp = user.generate_reset_token()
                success, email_result = send_password_reset_email(user.email, user.username, otp)
                if success:
                    return jsonify({
                        'success': True,
                        'message': 'Password reset code sent to your email.',
                        'redirect': url_for('verify_reset_code', email=email),
                    })
                return jsonify({'success': False, 'message': f'Could not send reset code: {email_result}'}), 500
            except Exception as exc:
                app_logger.warning(f"API forgot-password email failed for {email}: {str(exc)}")
                return jsonify({'success': False, 'message': 'Could not send reset code right now.'}), 500

        return jsonify({
            'success': True,
            'message': 'If that email exists, you will receive a reset code.',
        })

    @app.route('/api/auth/logout', methods=['POST'])
    @login_required
    def api_auth_logout():
        logout_user()
        return jsonify({'success': True, 'message': 'Signed out successfully.'})

    @app.route('/api/analyze', methods=['POST'])
    @app.route('/api/analyse', methods=['POST'])
    @app.route('/analyze', methods=['GET', 'POST'])
    @app.route('/analyse', methods=['GET', 'POST'])
    @login_required
    def analyze():
        # Render analyzer page on GET
        if request.method == 'GET':
            trello_client = get_trello_client(current_user)
            boards = trello_client.list_boards() if trello_client else []

            trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
            jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()

            team_data = None
            if current_user.team_id:
                team_data = Team.objects(id=current_user.team_id).first()

            return render_template(
                'index.html',
                trello_boards=boards,
                trello_credentials=trello_creds,
                jira_credentials=jira_creds,
                team_data=team_data,
            )
        
        # Check if this is an AJAX request - improved detection
        is_ajax = (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 
            'application/json' in request.headers.get('Accept', '') or
            request.headers.get('Content-Type') == 'application/json' or
            request.args.get('ajax') == '1'
        )
        try:
            # Debug logging

            transcript_text = (request.form.get('transcript') or '').strip()
            uploaded_file = request.files.get('file')
            file_text = ''
            if uploaded_file and uploaded_file.filename:
                file_text, file_error = extract_transcript_from_upload(uploaded_file)
                if file_error:
                    if is_ajax:
                        response = jsonify({'success': False, 'error': file_error})
                        response.headers['Content-Type'] = 'application/json'
                        return response
                    flash(file_error, 'error')
                    trello_client = get_trello_client(current_user)
                    boards = trello_client.list_boards() if trello_client else []
                    assistant_context = build_personal_assistant_context(current_user, request.args.get('assistant_q'))
                    return render_template('index.html', trello_boards=boards, **assistant_context)

            if file_text and transcript_text:
                transcript_text = f"{transcript_text}\n\n{file_text}"
            elif file_text:
                transcript_text = file_text

            analysis_result, notification = None, None
            selected_model = (request.form.get('model') or GEMINI_ANALYSIS_MODEL or 'gemini-2.5-flash').strip()
            
            if not transcript_text or not transcript_text.strip():
                if is_ajax:
                    response = jsonify({'success': False, 'error': 'Please provide transcript text or upload a supported file (TXT, DOC, DOCX, PDF).'})
                    response.headers['Content-Type'] = 'application/json'
                    return response
                flash("Please provide transcript text or upload a supported file (TXT, DOC, DOCX, PDF).", "error")
                trello_client = get_trello_client(current_user)
                boards = trello_client.list_boards() if trello_client else []
                assistant_context = build_personal_assistant_context(current_user, request.args.get('assistant_q'))
                return render_template('index.html', trello_boards=boards, **assistant_context)

            transcript_word_count = count_words(transcript_text)
            if transcript_word_count > MAX_TRANSCRIPT_WORDS:
                limit_message = f"Transcript exceeds {MAX_TRANSCRIPT_WORDS} words. Please shorten it before running analysis."
                if is_ajax:
                    response = jsonify({'success': False, 'error': limit_message, 'max_words': MAX_TRANSCRIPT_WORDS})
                    response.headers['Content-Type'] = 'application/json'
                    return response
                flash(limit_message, "error")
                trello_client = get_trello_client(current_user)
                boards = trello_client.list_boards() if trello_client else []
                assistant_context = build_personal_assistant_context(current_user, request.args.get('assistant_q'))
                return render_template('index.html', trello_boards=boards, **assistant_context)
            
            if transcript_text:
                analysis_result = analyze_transcript_with_ai(transcript_text, selected_model)
                if analysis_result and not analysis_result.get('error'):
                    try:
                        save_meeting_intelligence(current_user, transcript_text, analysis_result)
                    except Exception as persistence_error:
                        app_logger.error(f"Failed to persist meeting intelligence: {str(persistence_error)}")

                    automation_messages = []
                    action_items_list = analysis_result.get('action_items', [])
                    
                    # Get user's team
                    user_team = None
                    if current_user.team_id:
                        user_team = Team.objects(id=current_user.team_id).first()
                    
                    # Email Automation
                    if request.form.get('send_email') == 'true' and user_team:
                        # Get team members
                        team_members = User.objects(team_id=current_user.team_id)
                        recipients = [m.email for m in team_members if m.email]
                        if recipients:
                            automation_messages.append(f"Email: {send_summary_email(recipients, analysis_result)}")
                        else:
                            automation_messages.append("Email: No emails in team.")
                    elif request.form.get('send_email') == 'true':
                        automation_messages.append("Email: Requires team.")
                    
                    # Trello Automation
                    trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
                    wants_trello = request.form.get('create_trello') == 'true' or request.form.get('create_trello_cards') == 'true'
                    if wants_trello and trello_creds:
                        t_client = get_trello_client(current_user)
                        b_id, l_id = request.form.get('trello_board_id'), request.form.get('trello_list_id')
                        if t_client and b_id and l_id:
                            automation_messages.append(
                                f"Trello: {create_trello_cards(t_client, b_id, l_id, action_items_list, current_user.id)}")
                        elif not b_id or not l_id:
                            automation_messages.append("Trello: Board/List missing.")
                        else:
                            automation_messages.append("Trello: Client error.")
                    elif wants_trello:
                        automation_messages.append("Trello: Not connected.")
                    
                    # Slack Automation
                    if request.form.get('send_slack') == 'true' and user_team and user_team.slack_webhook_url:
                        automation_messages.append(f"Slack: {send_to_slack(user_team, analysis_result)}")
                    elif request.form.get('send_slack') == 'true':
                        if not user_team:
                            automation_messages.append("Slack: Requires team.")
                        else:
                            automation_messages.append("Slack: Not connected.")
                    
                    # JIRA Automation
                    jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
                    wants_jira = request.form.get('create_jira') == 'true' or request.form.get('create_jira_tickets') == 'true'
                    if wants_jira and jira_creds:
                        jira_project_key = request.form.get('jira_project_key')
                        jira_issue_type_name = request.form.get('jira_issue_type_name')
                        if not jira_project_key or not jira_issue_type_name:
                            automation_messages.append("Jira: Project and Issue Type must be selected.")
                        else:
                            jira_status = create_jira_issues(current_user, action_items_list, jira_project_key,
                                                             jira_issue_type_name)
                            automation_messages.append(f"Jira: {jira_status}")
                    elif wants_jira:
                        automation_messages.append("Jira: Integration not connected.")
                    
                    # Return JSON for AJAX requests
                    if is_ajax:
                        response = jsonify({
                            'success': True,
                            'analysis': analysis_result,
                            'selected_model': selected_model,
                            'automation_messages': automation_messages if automation_messages else None
                        })
                        response.headers['Content-Type'] = 'application/json'
                        return response
                    
                    # Notification logic for non-AJAX
                    if automation_messages:
                        overall_type = "success"
                        for msg in automation_messages:
                            if "Failed" in msg or "Error" in msg or "Invalid" in msg or "must be" in msg or "not connected" in msg or "missing" in msg:
                                overall_type = "error"
                                break
                        flash(" | ".join(automation_messages), overall_type)
                elif analysis_result and analysis_result.get('error'):
                    if is_ajax:
                        response = jsonify({'success': False, 'error': f"AI Analysis Error: {analysis_result['error']}"})
                        response.headers['Content-Type'] = 'application/json'
                        return response
                    flash(f"AI Analysis Error: {analysis_result['error']}", "error")

            trello_client = get_trello_client(current_user)
            boards = trello_client.list_boards() if trello_client else []
            
        except Exception as e:
            if is_ajax:
                response = jsonify({'success': False, 'error': f"An error occurred: {str(e)}"})
                response.headers['Content-Type'] = 'application/json'
                return response
            flash(f"An error occurred while processing your request: {str(e)}", "error")
            trello_client = get_trello_client(current_user)
            boards = trello_client.list_boards() if trello_client else []
            analysis_result = None
            
        assistant_context = build_personal_assistant_context(current_user, request.args.get('assistant_q'))
        return render_template('index.html', analysis=analysis_result, transcript=transcript_text, trello_boards=boards, **assistant_context)

    # --- USERNAME AVAILABILITY CHECK ---
    @app.route('/check_username', methods=['POST', 'OPTIONS'])
    def check_username():
        """Check if username is available via AJAX"""
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'POST')
            return response
            
        try:
            # Try to get data from JSON first, then form data
            if request.is_json:
                data = request.get_json()
                username = data.get('username', '').strip() if data else ''
            else:
                username = request.form.get('username', '').strip()
            
            
            if not username:
                return jsonify({'available': False, 'message': 'Username is required'}), 200
            
            if len(username) < 3:
                return jsonify({'available': False, 'message': 'Username must be at least 3 characters'}), 200
            
            if len(username) > 20:
                return jsonify({'available': False, 'message': 'Username must be less than 20 characters'}), 200

            if not app.config.get('DATABASE_CONNECTED', False):
                return jsonify({
                    'available': True,
                    'message': 'Live check is temporarily unavailable. You can still continue registration.'
                }), 200
            
            # Check if username exists
            existing_user = User.objects(username=username).first()
            if existing_user:
                return jsonify({'available': False, 'message': 'Username is already taken'}), 200
            
            return jsonify({'available': True, 'message': 'Username is available'}), 200
        except Exception as e:
            app_logger.warning(f"Username check failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'available': True,
                'message': 'Live check is temporarily unavailable. You can still continue registration.'
            }), 200

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        print("\n" + "="*60)
        print("📝 REGISTRATION REQUEST")
        print("="*60)
        security_logger.info("Registration request received")
        
        if current_user.is_authenticated:
            security_logger.info(f"Already authenticated user {current_user.username} trying to register")
            print("="*60 + "\n")
            return redirect(url_for('dashboard'))
        
        if request.method == 'POST':
            # Check if this is an AJAX request for registration
            is_ajax = request.headers.get('Content-Type') == 'application/json'

            if not app.config.get('DATABASE_CONNECTED', False):
                message = 'Database is temporarily unavailable. Please try again shortly.'
                if is_ajax:
                    return jsonify({'success': False, 'message': message}), 503
                flash(message, 'error')
                return redirect(url_for('register'))
            
            if is_ajax:
                data = request.get_json()
                username = data.get('username', '').strip()
                email = data.get('email', '').strip().lower()
                password = data.get('password', '').strip()
                confirm_password = data.get('confirm_password', '').strip()
                terms_accepted = bool(data.get('terms', False))
            else:
                username = request.form.get('username', '').strip()
                email = request.form.get('email', '').strip().lower()
                password = request.form.get('password', '').strip()
                confirm_password = request.form.get('confirm_password', '').strip()
                terms_accepted = request.form.get('terms') == 'on'
            
            try:
                print(f"    - Username: {username}")
                print(f"    - Email: {email}")
                print(f"    - Password length: {len(password) if password else 0}")
                security_logger.info(f"Registration attempt for username: {username}, email: {email}")
                
                # Validation
                if not username or not email or not password:
                    message = 'All fields are required.'
                    print(f"[✗] Validation failed: {message}")
                    security_logger.warning(f"Registration failed - validation: {message}")
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    print("="*60 + "\n")
                    return redirect(url_for('register'))
                
                if len(username) < 3:
                    message = 'Username must be at least 3 characters long.'
                    print(f"[✗] Validation failed: {message}")
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    print("="*60 + "\n")
                    return redirect(url_for('register'))
                
                if len(password) < 6:
                    message = 'Password must be at least 6 characters long.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message})
                    flash(message, 'error')
                    return redirect(url_for('register'))

                if not confirm_password:
                    message = 'Please confirm your password.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'confirm_password'})
                    flash(message, 'error')
                    return redirect(url_for('register'))

                if password != confirm_password:
                    message = 'Passwords do not match.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'confirm_password'})
                    flash(message, 'error')
                    return redirect(url_for('register'))

                if not terms_accepted:
                    message = 'You must agree to the Terms of Service and Privacy Policy.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'terms'})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                # Check if username or email already exists
                existing_username = User.objects(username=username).first()
                existing_email = User.objects(email=email).first()
                
                if existing_username:
                    message = 'Username already exists. Please choose another.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'username'})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                if existing_email:
                    message = 'Email already registered. Please use another email or try logging in.'
                    if is_ajax:
                        return jsonify({'success': False, 'message': message, 'field': 'email'})
                    flash(message, 'error')
                    return redirect(url_for('register'))
                
                # Create new user
                user = User(username=username, email=email)
                user.password = password  # This will hash the password
                user.save()
                
                # Generate and send verification email
                try:
                    otp_code = user.generate_verification_token()
                    success, email_result = send_email_verification(email, username, otp_code)
                    if success:
                        email_message = " Verification code sent to your email."
                    else:
                        email_message = f" (Verification email failed to send: {email_result})"
                        app_logger.warning(f"Verification email failed for {email}: {email_result}")
                except Exception as email_error:
                    email_message = f" (Verification email failed to send: {str(email_error)})"
                    app_logger.error(f"Verification email exception for {email}: {str(email_error)}")
                
                message = f'Account created successfully!{email_message} Please verify your email.'
                if is_ajax:
                    return jsonify({'success': True, 'message': message, 'redirect': url_for('verify_email', email=email)})
                
                flash(message, 'success')
                return redirect(url_for('verify_email', email=email))
                
            except Exception as e:
                import traceback
                traceback.print_exc()
                message = 'An unexpected error occurred during registration. Please try again.'
                if is_ajax:
                    return jsonify({'success': False, 'message': message})
                flash(message, 'error')
                return redirect(url_for('register'))
        
        return render_template('register.html')

    @app.route('/verify_email/<email>', methods=['GET', 'POST'])
    def verify_email(email):
        email = (email or '').strip().lower()
        if request.method == 'POST':
            otp = request.form.get('otp')
            
            if not otp:
                flash('Verification code is required.', 'error')
                return render_template('verify_email.html', email=email)
            
            user = User.objects(email=email).first()
            if not user:
                flash('User not found.', 'error')
                return redirect(url_for('register'))
            
            if user.is_verified:
                flash('Account already verified! Please log in.', 'success')
                return redirect(url_for('login'))
            
            if user.verify_email_token(otp):
                # Complete verification
                user.complete_email_verification()
                
                # Send welcome email after verification
                try:
                    send_welcome_email(user.email, user.username)
                except Exception as e:
                    print(f"[WARN] Failed to send welcome email: {e}")
                
                flash('Email verified successfully! Welcome to AI Meeting Agent!', 'success')
                return redirect(url_for('login'))
            else:
                flash('Invalid or expired verification code.', 'error')
        
        return render_template('verify_email.html', email=email)

    @app.route('/resend_verification/<email>', methods=['POST'])
    def resend_verification(email):
        email = (email or '').strip().lower()
        user = User.objects(email=email).first()
        if not user:
            flash('User not found.', 'error')
            return redirect(url_for('register'))
        
        if user.is_verified:
            flash('Account already verified! Please log in.', 'success')
            return redirect(url_for('login'))
        
        try:
            otp_code = user.generate_verification_token()
            success, email_result = send_email_verification(email, user.username, otp_code)
            if success:
                flash('Verification code sent successfully! Check your email.', 'success')
            else:
                flash(f'Failed to send verification email: {email_result}', 'error')
                app_logger.warning(f"Resend verification failed for {email}: {email_result}")
        except Exception as e:
            flash(f'An error occurred while resending code: {str(e)}', 'error')
            app_logger.error(f"Resend verification exception for {email}: {str(e)}")
        
        return redirect(url_for('verify_email', email=email))

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        print("\n" + "="*60)
        print("🔐 LOGIN REQUEST")
        print("="*60)
        
        if current_user.is_authenticated:
            print("="*60 + "\n")
            return redirect(url_for('dashboard'))
        
        if request.method == 'POST':
            try:
                email = request.form.get('email')
                email = (email or '').strip().lower()
                password = request.form.get('password')
                remember = request.form.get('remember') == 'on'
                
                
                if not email or not password:
                    print("[✗] Missing email or password")
                    flash('Email and password are required.', 'error')
                    print("="*60 + "\n")
                    return render_template('login.html')
                
                user = User.objects(email=email).first()
                
                if user:
                    print(f"[✓] User found: {user.username} (ID: {user.id})")
                    
                    if user.verify_password(password):
                        print(f"[✓] Password verified successfully")
                        
                        # Check if email is verified
                        if not user.is_verified:
                            try:
                                otp_code = user.generate_verification_token()
                                success, email_result = send_email_verification(user.email, user.username, otp_code)
                                if success:
                                    flash('Please verify your email before logging in. A fresh verification code was sent to your email.', 'warning')
                                else:
                                    flash(f'Please verify your email before logging in. Could not send new code: {email_result}', 'warning')
                                    app_logger.warning(f"Login-triggered verification send failed for {user.email}: {email_result}")
                            except Exception as e:
                                flash(f'Please verify your email before logging in. Could not send code: {str(e)}', 'warning')
                                app_logger.error(f"Login-triggered verification exception for {user.email}: {str(e)}")
                            print("="*60 + "\n")
                            return redirect(url_for('verify_email', email=email))
                        
                        print(f"[✓] Logging in user: {user.username}")
                        login_user(user, remember=remember, duration=None)
                        next_page = request.args.get('next')
                        flash(f'Welcome back, {user.username}!', 'success')
                        print(f"[✓] Login successful! Redirecting to: {next_page or 'dashboard'}")
                        print("="*60 + "\n")
                        return redirect(next_page or url_for('dashboard'))
                    else:
                        print(f"[✗] Password verification failed")
                        flash('Invalid email or password. Please try again.', 'error')
                else:
                    print(f"[✗] No user found with email: {email}")
                    flash('Invalid email or password. Please try again.', 'error')
                    
            except Exception as e:
                print(f"[✗] Error in login: {type(e).__name__}: {str(e)}")
                import traceback
                traceback.print_exc()
                flash('An error occurred during login. Please try again.', 'error')
        
        print("="*60 + "\n")
        return render_template('login.html')

    @app.route('/logout')
    def logout():
        # ... (unchanged) ...
        logout_user();
        return redirect(url_for('login'))

    @app.route('/forgot_password', methods=['GET', 'POST'])
    @app.route('/forgot-password', methods=['GET', 'POST'])
    @app.route('/forget-password', methods=['GET', 'POST'])
    def forgot_password():
        if request.method == 'POST':
            email = (request.form.get('email') or '').strip().lower()
            if not email:
                flash('Email is required.', 'error')
                return render_template('forgot_password.html')
            
            user = User.objects(email=email).first()
            if user:
                # Generate OTP
                otp = user.generate_reset_token()
                # Send email
                try:
                    success, email_result = send_password_reset_email(user.email, user.username, otp)
                except Exception as e:
                    success, email_result = False, str(e)
                if success:
                    flash('Password reset code sent to your email.', 'success')
                    return redirect(url_for('verify_reset_code', email=email))
                app_logger.warning(f"Password reset email failed for {email}: {email_result}")
                flash(f'Could not send reset code: {email_result}', 'error')
                return render_template('forgot_password.html')
            else:
                # Don't reveal if user exists or not for security
                flash('If that email exists, you will receive a reset code.', 'info')
        
        return render_template('forgot_password.html')

    @app.route('/verify_reset_code', methods=['GET', 'POST'])
    @app.route('/verify_reset_code/<email>', methods=['GET', 'POST'])
    def verify_reset_code(email=None):
        # Get email from URL parameter or form data
        if email is None:
            email = request.form.get('email') or request.args.get('email')
        email = (email or '').strip().lower()
        
        if request.method == 'POST':
            # If no email provided, show error
            if not email:
                flash('Email is required.', 'error')
                return render_template('verify_reset_code.html', email=email, step='verify')
            
            # Check if this is step 1 (code verification) or step 2 (password change)
            if 'verify_code' in request.form:
                # Step 1: Verify the code only
                otp = request.form.get('otp')
                
                if not otp:
                    flash('Verification code is required.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
                
                user = User.objects(email=email).first()
                if user and user.verify_reset_token(otp):
                    # Code is valid, show password change form
                    flash('Code verified successfully! Now enter your new password.', 'success')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                else:
                    flash('Invalid or expired verification code.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
            
            elif 'change_password' in request.form:
                # Step 2: Change password after code verification
                otp = request.form.get('verified_code')
                new_password = request.form.get('new_password')
                confirm_password = request.form.get('confirm_password')
                
                if not otp or not new_password or not confirm_password:
                    flash('All fields are required.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                
                if new_password != confirm_password:
                    flash('Passwords do not match.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='change_password', verified_code=otp)
                
                # Verify the code again for security
                user = User.objects(email=email).first()
                if user and user.verify_reset_token(otp):
                    # Update password
                    user.password = new_password  # This will hash the password
                    user.clear_reset_token()
                    flash('Password updated successfully! Please log in with your new password.', 'success')
                    return redirect(url_for('login'))
                else:
                    flash('Session expired. Please request a new verification code.', 'error')
                    return redirect(url_for('forgot_password'))
            
            else:
                # Direct form submission with code and password (simpler flow)
                code = request.form.get('code')
                new_password = request.form.get('new_password')
                confirm_password = request.form.get('confirm_password')
                
                if not code or not new_password or not confirm_password:
                    flash('All fields are required.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
                
                if new_password != confirm_password:
                    flash('Passwords do not match.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
                
                user = User.objects(email=email).first()
                if user and user.verify_reset_token(code):
                    user.password = new_password
                    user.clear_reset_token()
                    flash('Password updated successfully! Please log in with your new password.', 'success')
                    return redirect(url_for('login'))
                else:
                    flash('Invalid or expired verification code.', 'error')
                    return render_template('verify_reset_code.html', email=email, step='verify')
        
        # Default: Show code verification form
        return render_template('verify_reset_code.html', email=email, step='verify')

    # --- ADD THIS MISSING ROUTE ---
    @app.route('/team', methods=['GET', 'POST'])
    @login_required
    def team():
        team_data = None
        team_members = []
        
        if current_user.team_id:
            # Get team data
            team_data = Team.objects(id=current_user.team_id).first()
            # Get team members
            team_members = User.objects(team_id=current_user.team_id)
        
        return render_template('team.html', team=team_data, team_members=team_members)

    # -----------------------------

    @app.route('/create_team', methods=['POST'])
    @login_required
    def create_team():
        # ... (unchanged) ...
        team_name = request.form.get('team_name')
        if team_name:
            if current_user.team_id: 
                flash('Already in a team.', 'warning')
                return redirect(url_for('team'))
            
            new_team = Team(name=team_name, owner_id=str(current_user.id))
            new_team.save()
            current_user.team_id = str(new_team.id)
            current_user.save()
            flash(f'Team "{team_name}" created!', 'success')
        else:
            flash('Team name empty.', 'danger')
        return redirect(url_for('team'))

    @app.route('/invite', methods=['POST'])
    @login_required
    def invite():
        # ... (unchanged) ...
        if not current_user.team_id: 
            flash('Must be in team.', 'danger')
            return redirect(url_for('team'))
        
        email = request.form.get('email')
        user_to_invite = User.objects(email=email).first()
        if user_to_invite:
            if user_to_invite.team_id:
                flash(f'{user_to_invite.username} already in team.', 'warning')
            elif user_to_invite == current_user:
                flash('Cannot invite self.', 'warning')
            else:
                user_to_invite.team_id = current_user.team_id
                user_to_invite.save()
                flash(f'{user_to_invite.username} added.', 'success')
        else:
            flash('User not found.', 'danger')
        return redirect(url_for('team'))

    @app.route('/integrations')
    @login_required
    def integrations():
        # Get user's integration credentials
        trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        trello_server_configured = bool(TRELLO_API_KEY and TRELLO_API_SECRET)
        
        # Get team data for Slack integration
        team_data = None
        if current_user.team_id:
            team_data = Team.objects(id=current_user.team_id).first()
        
        return render_template('integrations.html', 
                             trello_credentials=trello_creds, 
                             jira_credentials=jira_creds,
                             team=team_data,
                             trello_server_configured=trello_server_configured)

    @app.route('/api/integrations/status', methods=['GET'])
    @login_required
    def integrations_status():
        trello_creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        jira_creds = JiraCredentials.objects(user_id=str(current_user.id)).first()

        return jsonify({
            'success': True,
            'integrations': {
                'trello_connected': bool(trello_creds),
                'trello_account': trello_creds.trello_username if trello_creds else None,
                'jira_connected': bool(jira_creds),
                'jira_account': jira_creds.email if jira_creds else None,
                'jira_url': jira_creds.jira_url if jira_creds else None,
            }
        })

    @app.route('/api/integrations/trello-token-url', methods=['GET'])
    @login_required
    def integrations_trello_token_url():
        if not TRELLO_API_KEY:
            return jsonify({'success': False, 'error': 'Trello API key is not configured on server.'}), 400

        params = {
            'key': TRELLO_API_KEY,
            'name': 'AI Meeting Agent',
            'expiration': 'never',
            'response_type': 'token',
            'scope': 'read,write',
        }
        token_url = f"https://trello.com/1/authorize?{urlencode(params)}"

        return jsonify({'success': True, 'url': token_url})

    @app.route('/ai-chat')
    @login_required
    def ai_chat():
        return redirect(url_for('dashboard', open_assistant='1'))

    @app.route('/api/ai-chat/history', methods=['GET'])
    @login_required
    def ai_chat_history():
        history = get_recent_chat_history(str(current_user.id), limit=40)
        return jsonify({'success': True, 'history': history, 'user_name': current_user.username})

    @app.route('/api/ai-chat/send', methods=['POST'])
    @login_required
    def ai_chat_send():
        data = request.get_json(silent=True) or {}
        message = (data.get('message') or '').strip()
        selected_model = (data.get('model') or 'gemini-3-flash').strip()

        if not message:
            return jsonify({'success': False, 'error': 'Message is required.'}), 400

        user_id = str(current_user.id)
        save_chat_message(
            user_id=user_id,
            role='user',
            content=sanitize_chat_message_for_storage(message),
            selected_model=selected_model
        )

        command_result = execute_assistant_command(current_user, message)
        if command_result and command_result.get('reply'):
            assistant_reply = command_result['reply']
            save_chat_message(
                user_id=user_id,
                role='assistant',
                content=assistant_reply,
                selected_model='assistant-command',
                actual_model='assistant-command'
            )
            return jsonify({
                'success': True,
                'reply': assistant_reply,
                'selected_model': 'assistant-command',
                'actual_model': 'assistant-command',
                'user_name': current_user.username,
                'show_connect_jira': False,
                'show_connect_trello': False,
                'integrations': get_workspace_snapshot(current_user)['integrations']
            })

        history = get_recent_chat_history(user_id=user_id, limit=20)
        snapshot = get_workspace_snapshot(current_user)
        prompt = build_chat_prompt(user_message=message, history=history, snapshot=snapshot)

        ai_response, actual_model, model_error = generate_with_gemini(prompt, preferred_model_key=selected_model)
        if model_error:
            return jsonify({'success': False, 'error': model_error}), 500

        save_chat_message(
            user_id=user_id,
            role='assistant',
            content=ai_response,
            selected_model=selected_model,
            actual_model=actual_model
        )

        intent = detect_connection_intent(message)

        return jsonify({
            'success': True,
            'reply': ai_response,
            'selected_model': selected_model,
            'actual_model': actual_model,
            'user_name': current_user.username,
            'show_connect_jira': intent['show_jira'],
            'show_connect_trello': intent['show_trello'],
            'integrations': snapshot['integrations']
        })

    @app.route('/api/ai-chat/clear', methods=['POST'])
    @login_required
    def ai_chat_clear():
        ChatMessage.objects(user_id=str(current_user.id)).delete()
        return jsonify({'success': True, 'message': 'Chat history cleared.'})

    @app.route('/api/chat/connect/jira', methods=['POST'])
    @login_required
    def chat_connect_jira():
        data = request.get_json(silent=True) or request.form
        jira_url = (data.get('jira_url') or '').strip().rstrip('/')
        email = (data.get('jira_email') or '').strip()
        api_token = (data.get('jira_api_token') or '').strip()
        confirm = str(data.get('confirm', '')).lower() in ['1', 'true', 'yes', 'on']

        if not confirm:
            return jsonify({'success': False, 'error': 'Please confirm Jira connection first.'}), 400
        if not all([jira_url, email, api_token]):
            return jsonify({'success': False, 'error': 'All Jira fields are required.'}), 400
        if not jira_url.startswith('https://') or not jira_url.endswith('.atlassian.net'):
            return jsonify({'success': False, 'error': 'Invalid Jira URL. Use https://your-domain.atlassian.net'}), 400

        try:
            test_client = JIRA(server=jira_url, basic_auth=(email, api_token))
            test_client.server_info()

            creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
            if not creds:
                creds = JiraCredentials(user_id=str(current_user.id))

            creds.jira_url = jira_url
            creds.email = email
            creds.api_token = api_token
            creds.save()

            send_integration_success_email(current_user.email, current_user.username, 'Jira')
            return jsonify({'success': True, 'message': 'Jira connected successfully and confirmation email sent.'})
        except Exception as exc:
            return jsonify({'success': False, 'error': f'Jira connection failed: {str(exc)}'}), 400

    @app.route('/api/chat/connect/trello', methods=['POST'])
    @login_required
    def chat_connect_trello():
        data = request.get_json(silent=True) or request.form
        token = (data.get('trello_token') or '').strip()
        confirm = str(data.get('confirm', '')).lower() in ['1', 'true', 'yes', 'on']

        if not confirm:
            return jsonify({'success': False, 'error': 'Please confirm Trello connection first.'}), 400
        if not token:
            return jsonify({'success': False, 'error': 'Trello token is required.'}), 400
        if not TRELLO_API_KEY or not TRELLO_API_SECRET:
            return jsonify({'success': False, 'error': 'Trello API key/secret missing in server environment.'}), 400

        try:
            client = TrelloClient(api_key=TRELLO_API_KEY, api_secret=TRELLO_API_SECRET, token=token)
            member = client.get_member('me')

            creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
            if not creds:
                creds = TrelloCredentials(user_id=str(current_user.id))

            creds.token = token
            creds.trello_username = member.full_name
            creds.save()

            send_integration_success_email(current_user.email, current_user.username, 'Trello')
            return jsonify({'success': True, 'message': 'Trello connected successfully and confirmation email sent.'})
        except Exception as exc:
            return jsonify({'success': False, 'error': f'Trello connection failed: {str(exc)}'}), 400

    @app.route('/api/chat/disconnect/trello', methods=['POST'])
    @login_required
    def chat_disconnect_trello():
        creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        if not creds:
            return jsonify({'success': False, 'error': 'Trello is not connected.'}), 404

        creds.delete()
        return jsonify({'success': True, 'message': 'Trello disconnected successfully.'})

    # --- TRELLO ROUTES (Unchanged) ---
    @app.route('/trello/connect')
    @login_required
    def trello_connect():
        # ... (unchanged) ...
        app_name = "AI Agent";
        expiration = "never";
        scope = "read,write"
        if not TRELLO_API_KEY or not TRELLO_API_SECRET:
            return redirect(url_for('integrations'))
        auth_url = f"https://trello.com/1/authorize?key={TRELLO_API_KEY}&name={app_name}&expiration={expiration}&response_type=token&scope={scope}"
        return render_template('connect_trello.html', auth_url=auth_url)

    @app.route('/trello/save_token', methods=['GET', 'POST'])
    @login_required
    def trello_save_token():
        if request.method == 'GET':
            return redirect(url_for('trello_connect'))

        access_token = (
            request.form.get('pin') or
            request.form.get('token') or
            request.form.get('trello_token') or
            ''
        ).strip()

        if not access_token:
            flash('Token required.', 'danger')
            return redirect(url_for('trello_connect'))

        result = connect_trello_with_token(current_user, access_token)
        if result.get('success'):
            flash('Trello connected successfully! Confirmation email sent.', 'success')
            return redirect(url_for('integrations'))

        flash(result.get('reply') or 'Trello connection failed.', 'danger')
        return redirect(url_for('trello_connect'))

    @app.route('/trello/disconnect', methods=['GET', 'POST'])
    @login_required
    def trello_disconnect():
        # ... (unchanged) ...
        creds = TrelloCredentials.objects(user_id=str(current_user.id)).first()
        if creds: 
            creds.delete()
            flash('Trello disconnected.', 'success')
        return redirect(url_for('integrations'))

    # --- SLACK ROUTES (Unchanged) ---
    @app.route('/slack/connect', methods=['POST'])
    @login_required
    def slack_connect():
        # ... (unchanged) ...
        if not current_user.team_id: 
            flash('Must be in team.', 'danger')
            return redirect(url_for('integrations'))
        
        webhook_url = request.form.get('slack_webhook_url')
        if not webhook_url or not webhook_url.startswith('https://hooks.slack.com/services/'):
            flash('Invalid Slack URL.', 'danger')
            return redirect(url_for('integrations'))
        
        user_team = Team.objects(id=current_user.team_id).first()
        if user_team:
            user_team.slack_webhook_url = webhook_url
            user_team.save()
            
            # Send integration success email
            send_integration_success_email(current_user.email, current_user.username, 'Slack')
            
            flash('Slack connected successfully! Confirmation email sent.', 'success')
        else:
            flash('Team not found.', 'danger')
        return redirect(url_for('integrations'))

    @app.route('/slack/disconnect', methods=['GET', 'POST'])
    @login_required
    def slack_disconnect():
        # ... (unchanged) ...
        if current_user.team_id:
            user_team = Team.objects(id=current_user.team_id).first()
            if user_team and user_team.slack_webhook_url:
                user_team.slack_webhook_url = None
                user_team.save()
                flash('Slack disconnected.', 'success')
            else:
                flash('Slack not connected.', 'warning')
        else:
            flash('Slack not connected.', 'warning')
        return redirect(url_for('integrations'))

    # --- JIRA ROUTES (Unchanged) ---
    @app.route('/jira/connect', methods=['POST'])
    @login_required
    def jira_connect():
        # ... (unchanged) ...
        jira_url, email, api_token = request.form.get('jira_url'), request.form.get('jira_email'), request.form.get('jira_api_token')
        
        if not all([jira_url, email, api_token]): 
            flash('All Jira fields required.', 'danger')
            return redirect(url_for('integrations'))
        
        if not jira_url.startswith('https://') or not jira_url.endswith('.atlassian.net'):
            flash('Invalid Jira URL.', 'danger')
            return redirect(url_for('integrations'))
        
        # Check if credentials already exist
        creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        if not creds:
            creds = JiraCredentials(user_id=str(current_user.id))
        
        creds.jira_url = jira_url.rstrip('/')
        creds.email = email
        creds.api_token = api_token
        
        try:
            creds.save()
            # Send integration success email
            send_integration_success_email(current_user.email, current_user.username, 'Jira')
            flash('Jira connected successfully! Confirmation email sent.', 'success')
        except Exception as e:
            flash(f'Jira save failed: {e}', 'danger')
        return redirect(url_for('integrations'))

    @app.route('/jira/disconnect', methods=['GET', 'POST'])
    @login_required
    def jira_disconnect():
        # ... (unchanged) ...
        creds = JiraCredentials.objects(user_id=str(current_user.id)).first()
        if creds:
            try:
                creds.delete()
                flash('Jira disconnected.', 'success')
            except Exception as e:
                flash(f'Jira disconnect failed: {e}', 'danger')
        else:
            flash('Jira not connected.', 'warning')
        return redirect(url_for('integrations'))

    @app.route('/docs')
    def docs():
        """Documentation page for the application"""
        return render_template('docs.html')

    @app.route('/assets/<path:filename>')
    def frontend_assets(filename):
        if os.path.exists(os.path.join(frontend_assets_dir, filename)):
            return send_from_directory(frontend_assets_dir, filename)
        return jsonify({'success': False, 'error': 'Asset not found'}), 404

    @app.route('/<path:path>')
    def frontend_fallback(path):
        # Skip API/static-like paths that should not resolve to SPA shell.
        blocked_prefixes = ('api/', 'static/', 'trello/', 'jira/', 'slack/')
        if path.startswith(blocked_prefixes):
            return jsonify({'success': False, 'error': 'Not found'}), 404

        candidate = os.path.join(frontend_dist_dir, path)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return send_from_directory(frontend_dist_dir, path)
        return serve_frontend_app()

    return app


if __name__ == '__main__':
    app = create_app()
    print("AI Meeting Agent ready")
    app.run(debug=True)
