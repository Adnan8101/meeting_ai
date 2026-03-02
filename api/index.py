"""
Vercel serverless function entry point for AI Meeting Agent
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
    print("[*] Starting AI Meeting Agent initialization...")
    print(f"[*] Python version: {sys.version}")
    print(f"[*] Current directory: {os.getcwd()}")
    
    # Check environment variables
    env_vars = ["FLASK_SECRET_KEY", "GEMINI_API_KEY", "TRELLO_API_KEY", "MONGO_URI", "SENDER_EMAIL"]
    env_status = {}
    for var in env_vars:
        value = os.environ.get(var)
        env_status[var] = "SET" if value else "MISSING"
        if var == "GEMINI_API_KEY" and value:
            print(f"[*] {var}: {value[:20]}...")
        else:
            print(f"[*] {var}: {env_status[var]}")
    
    # Import and create the Flask app
    from main_app import create_app
    print("[*] main_app imported successfully")
    
    # Create the Flask app instance
    app = create_app()
    print("[*] Flask app created successfully")
    
    print("[*] AI Meeting Agent initialized successfully for Vercel")
    
except ImportError as e:
    print(f"[ERROR] Import failed: {e}")
    import traceback
    traceback.print_exc()
    
    # Create error response with import details
    app = error_app
    
    @app.route('/')
    @app.route('/<path:path>')
    def import_error_handler(path=''):
        return jsonify({
            "error": "Import Error",
            "details": str(e),
            "message": "Failed to import required modules",
            "path": path
        }), 500

except Exception as e:
    print(f"[ERROR] App initialization failed: {e}")
    import traceback
    error_traceback = traceback.format_exc()
    print(error_traceback)
    
    # Store detailed error for debugging
    init_error = {
        "error": "Application initialization failed",
        "details": str(e),
        "type": type(e).__name__,
        "traceback": error_traceback.split('\n')[-10:],  # Last 10 lines
        "env_status": {
            "FLASK_SECRET_KEY": "SET" if os.environ.get("FLASK_SECRET_KEY") else "MISSING",
            "GEMINI_API_KEY": "SET" if os.environ.get("GEMINI_API_KEY") else "MISSING", 
            "MONGO_URI": "SET" if os.environ.get("MONGO_URI") else "MISSING",
            "TRELLO_API_KEY": "SET" if os.environ.get("TRELLO_API_KEY") else "MISSING",
            "SENDER_EMAIL": "SET" if os.environ.get("SENDER_EMAIL") else "MISSING"
        },
        "python_version": sys.version,
        "cwd": os.getcwd()
    }
    
    # Use error app if main app fails
    app = error_app
    
    @app.route('/')
    @app.route('/<path:path>')  
    def error_handler(path=''):
        return jsonify(init_error), 500

# Export the app for Vercel
def handler(request):
    """Vercel serverless handler"""
    return app(request.environ, lambda status, headers: None)

# Also make app available for direct import
__all__ = ['app', 'handler']



