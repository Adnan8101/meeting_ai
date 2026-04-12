"""Vercel serverless entry point for AI Meeting Agent."""

import os
import sys
from flask import Flask, jsonify

# Ensure repository root is importable.
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

def _fallback_app(error: Exception) -> Flask:
    app = Flask(__name__)

    @app.route("/api/health")
    @app.route("/health")
    def health_check():
        return jsonify({
            "ok": False,
            "status": "degraded",
            "error": "Application failed to initialize",
            "detail": str(error),
        }), 500

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def all_routes(path: str):
        return jsonify({
            "ok": False,
            "error": "Application failed to initialize",
            "detail": str(error),
            "path": f"/{path}",
        }), 500

    return app

try:
    from main_app import create_app

    app = create_app()
except Exception as exc:
    app = _fallback_app(exc)
