"""Vercel serverless entry point for AI Meeting Agent.

This module keeps cold starts resilient by loading the heavy backend app lazily,
and serving static SPA routes directly when possible.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

# Ensure repository root is importable.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"

_backend_app = None
_backend_error: Exception | None = None


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
    )


def _get_backend_app():
    global _backend_app, _backend_error
    if _backend_app is not None or _backend_error is not None:
        return _backend_app

    try:
        from main_app import create_app

        _backend_app = create_app()
    except Exception as exc:
        _backend_error = exc
        _backend_app = None

    return _backend_app


def _error_response(path: str, start_response):
    detail = str(_backend_error) if _backend_error else "Backend initialization failed"
    payload = {
        "ok": False,
        "error": "Application failed to initialize",
        "detail": detail,
        "path": path,
    }
    body = json.dumps(payload).encode("utf-8")
    start_response(
        "500 INTERNAL SERVER ERROR",
        [("Content-Type", "application/json"), ("Content-Length", str(len(body)))],
    )
    return [body]


frontend_app = Flask(__name__)


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
