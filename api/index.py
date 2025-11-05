"""
Vercel serverless function entry point
"""
import sys
import os
from flask import Flask, jsonify

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Create a simple Flask app for error reporting
error_app = Flask(__name__)

@error_app.route('/')
@error_app.route('/<path:path>')
def catch_all(path=''):
    return jsonify({
        "error": "App initialization failed",
        "message": "Check function logs for details",
        "path": path
    }), 500

try:
    print("[*] Starting app initialization...")
    print(f"[*] Python version: {sys.version}")
    print(f"[*] Current directory: {os.getcwd()}")
    print(f"[*] sys.path: {sys.path[:3]}")
    
    # Check environment variables
    env_status = {
        "FLASK_SECRET_KEY": bool(os.environ.get("FLASK_SECRET_KEY")),
        "GEMINI_API_KEY": bool(os.environ.get("GEMINI_API_KEY")),
        "TRELLO_API_KEY": bool(os.environ.get("TRELLO_API_KEY")),
    }
    print(f"[*] Environment variables: {env_status}")
    
    from main_app import create_app
    print("[*] main_app imported successfully")
    
    # Create the Flask app instance
    app = create_app()
    print("[*] App created successfully")
    
    # Initialize database for serverless
    with app.app_context():
        try:
            from extensions import db
            # Only create tables if using SQLite (development)
            if 'sqlite' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
                db.create_all()
                print("[*] Database tables created")
        except Exception as e:
            print(f"[WARN] Database init: {e}")
    
    print("[*] Flask app initialized successfully for Vercel")
    
except Exception as e:
    print(f"[ERROR] Failed to initialize app: {e}")
    import traceback
    traceback.print_exc()
    
    # Use error app if main app fails
    app = error_app
    
    @app.route('/')
    @app.route('/<path:path>')
    def error_handler(path=''):
        return jsonify({
            "error": "Application initialization failed",
            "details": str(e),
            "type": type(e).__name__,
            "env_check": {
                "FLASK_SECRET_KEY": "Set" if os.environ.get("FLASK_SECRET_KEY") else "MISSING",
                "GEMINI_API_KEY": "Set" if os.environ.get("GEMINI_API_KEY") else "MISSING",
            }
        }), 500



