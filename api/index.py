"""Vercel serverless entry point for AI Meeting Agent.

This module keeps cold starts resilient by loading the heavy backend app lazily,
and serving static SPA routes directly when possible.

VERBOSE LOGGING: All errors print to stderr so they appear in Vercel Function Logs.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

# ---------------------------------------------------------------------------
# Always force startup diagnostics to stderr (Vercel captures stderr).
# ---------------------------------------------------------------------------
def _log(msg: str) -> None:
    print(f"[VERCEL-ENTRY] {msg}", file=sys.stderr, flush=True)


_log("api/index.py loaded")

# Ensure repository root is importable.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"

_backend_app = None
_backend_error: Exception | None = None
_backend_traceback: str = ""


def _is_backend_path(path: str) -> bool:
    exact_paths = {
        "/check_username",
        "/register",
        "/login",
        "/forget-password",
        "/verify_reset_code",
        "/trello/connect",
        "/trello/save_token",
        "/jira/connect",
    }
    return (
        path.startswith("/api/")
        or path in exact_paths
        or path.startswith("/verify_email/")
        or path.startswith("/verify_reset_code/")
        or path.startswith("/assistant/")
        or path.startswith("/get_lists/")
        or path.startswith("/get_jira_projects")
        or path.startswith("/get_jira_issue_types/")
        or path.startswith("/resend_verification/")
    )


def _get_backend_app():
    global _backend_app, _backend_error, _backend_traceback
    if _backend_app is not None or _backend_error is not None:
        return _backend_app

    try:
        _log("Importing main_app.create_app ...")
        from main_app import create_app

        _log("Calling create_app() ...")
        _backend_app = create_app()
        _log("create_app() succeeded ✓")
    except Exception as exc:
        _backend_error = exc
        _backend_traceback = traceback.format_exc()
        _backend_app = None
        _log(f"create_app() FAILED: {type(exc).__name__}: {exc}")
        _log(f"Full traceback:\n{_backend_traceback}")

    return _backend_app


def _error_response(path: str, start_response):
    detail = str(_backend_error) if _backend_error else "Backend initialization failed"
    payload = {
        "ok": False,
        "error": "Application failed to initialize",
        "detail": detail,
        "traceback": _backend_traceback if os.environ.get("VERCEL_DEBUG") else "(set VERCEL_DEBUG=1 to see traceback)",
        "path": path,
        "python_version": sys.version,
        "cwd": os.getcwd(),
    }
    body = json.dumps(payload, indent=2).encode("utf-8")
    start_response(
        "500 INTERNAL SERVER ERROR",
        [("Content-Type", "application/json"), ("Content-Length", str(len(body)))],
    )
    return [body]


frontend_app = Flask(__name__)


@frontend_app.route("/_debug/startup")
def startup_debug():
    """Diagnostic endpoint — shows why the backend failed to boot."""
    backend = _get_backend_app()
    env_status = {
        key: ("SET" if os.environ.get(key) else "MISSING")
        for key in [
            "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL",
            "GEMINI_API_KEY", "FLASK_SECRET_KEY",
            "GMAIL_USER", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
            "TRELLO_API_KEY", "VERCEL",
        ]
    }
    return jsonify({
        "backend_loaded": backend is not None,
        "error": str(_backend_error) if _backend_error else None,
        "traceback": _backend_traceback if _backend_traceback else None,
        "python_version": sys.version,
        "cwd": os.getcwd(),
        "sys_path": sys.path[:5],
        "env_status": env_status,
        "frontend_dist_exists": FRONTEND_DIST_DIR.is_dir(),
    })


@frontend_app.route("/", defaults={"path": ""})
@frontend_app.route("/<path:path>")
def serve_frontend(path: str):
    path = (path or "").lstrip("/")

    if path:
        candidate = FRONTEND_DIST_DIR / path
        if candidate.is_file():
            response = send_from_directory(str(FRONTEND_DIST_DIR), path)
            if path.startswith("assets/"):
                response.cache_control.max_age = 31536000
            return response

    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.is_file():
        response = send_from_directory(str(FRONTEND_DIST_DIR), "index.html", max_age=0)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    return jsonify({"ok": False, "error": "Frontend build not found"}), 503


def app(environ, start_response):
    path = environ.get("PATH_INFO", "/")

    if _is_backend_path(path):
        backend = _get_backend_app()
        if backend is not None:
            return backend.wsgi_app(environ, start_response)
        return _error_response(path, start_response)

    return frontend_app.wsgi_app(environ, start_response)
